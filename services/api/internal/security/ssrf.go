package security

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"syscall"
	"time"
)

// Private and reserved IP CIDRs that must be blocked for SSRF prevention
var privateIPBlocks []*net.IPNet

func init() {
	privateCIDRs := []string{
		"127.0.0.0/8",          // IPv4 loopback
		"10.0.0.0/8",           // RFC1918 private
		"172.16.0.0/12",        // RFC1918 private
		"192.168.0.0/16",       // RFC1918 private
		"169.254.0.0/16",       // IPv4 Link-local / Cloud Metadata (AWS/GCP/Azure: 169.254.169.254)
		"100.64.0.0/10",        // Carrier-grade NAT
		"198.18.0.0/15",        // Benchmark testing
		"0.0.0.0/8",            // Current network
		"::1/128",              // IPv6 loopback
		"fc00::/7",             // IPv6 Unique Local Address (ULA)
		"fe80::/10",            // IPv6 Link-local
	}

	for _, cidr := range privateCIDRs {
		_, block, err := net.ParseCIDR(cidr)
		if err == nil {
			privateIPBlocks = append(privateIPBlocks, block)
		}
	}
}

// IsPrivateIP checks if a resolved IP address belongs to internal networks or cloud metadata
func IsPrivateIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	for _, block := range privateIPBlocks {
		if block.Contains(ip) {
			return true
		}
	}
	return ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsPrivate() || ip.IsUnspecified()
}

// SafeDialContext performs pre-dial DNS resolution and blocks connections to private IPs
func SafeDialContext(ctx context.Context, network, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, fmt.Errorf("invalid address format: %w", err)
	}

	// Block AWS / GCP / Azure metadata hostnames explicitly
	lowerHost := strings.ToLower(host)
	if lowerHost == "metadata.google.internal" || lowerHost == "169.254.169.254" || lowerHost == "localhost" {
		return nil, errors.New("SSRF: access to internal metadata or localhost is forbidden")
	}

	// Resolve IP addresses
	ips, err := net.DefaultResolver.LookupIP(ctx, "ip", host)
	if err != nil {
		return nil, fmt.Errorf("DNS lookup failed for %s: %w", host, err)
	}

	if len(ips) == 0 {
		return nil, fmt.Errorf("no IP resolved for host %s", host)
	}

	// Verify all resolved IPs against private CIDR blocklist
	for _, ip := range ips {
		if IsPrivateIP(ip) {
			return nil, fmt.Errorf("SSRF: destination %s resolved to private/cloud metadata IP (%s)", host, ip.String())
		}
	}

	dialer := &net.Dialer{
		Timeout:   3 * time.Second,
		KeepAlive: 30 * time.Second,
		Control: func(network, address string, c syscall.RawConn) error {
			return nil
		},
	}

	// Connect to the first validated public IP
	targetAddr := net.JoinHostPort(ips[0].String(), port)
	return dialer.DialContext(ctx, network, targetAddr)
}

// NewSafeHTTPClient creates an HTTP client strictly fortified against SSRF (OWASP API7)
func NewSafeHTTPClient(timeout time.Duration) *http.Client {
	transport := &http.Transport{
		DialContext:           SafeDialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          50,
		IdleConnTimeout:       30 * time.Second,
		TLSHandshakeTimeout:   3 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		ResponseHeaderTimeout: 4 * time.Second,
	}

	return &http.Client{
		Timeout:   timeout,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 3 {
				return errors.New("SSRF: maximum redirect limit (3) exceeded")
			}
			// Re-validate scheme on redirect
			if req.URL.Scheme != "http" && req.URL.Scheme != "https" {
				return fmt.Errorf("SSRF: forbidden protocol scheme on redirect: %s", req.URL.Scheme)
			}
			return nil
		},
	}
}

// SafeFetchURL downloads content with URL scheme validation, SSRF dialer, and strict response size limits
func SafeFetchURL(targetURL string, maxBytes int64) ([]byte, error) {
	parsed, err := url.Parse(targetURL)
	if err != nil {
		return nil, fmt.Errorf("invalid URL: %w", err)
	}

	// 1. Strict Scheme Whitelist
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, fmt.Errorf("forbidden URL scheme: '%s'. Only HTTP and HTTPS are permitted", parsed.Scheme)
	}

	// 2. Prohibit user-info (e.g. http://user:pass@internal-host)
	if parsed.User != nil {
		return nil, errors.New("URLs with user authentication components are forbidden")
	}

	client := NewSafeHTTPClient(5 * time.Second)
	req, err := http.NewRequestWithContext(context.Background(), "GET", targetURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "AuraVoice-SafeClient/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("safe request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("remote server returned HTTP %d", resp.StatusCode)
	}

	// 3. Strict Response Size Limiter (e.g. 512 KB)
	limitedReader := io.LimitReader(resp.Body, maxBytes)
	body, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, fmt.Errorf("failed reading response body: %w", err)
	}

	return body, nil
}
