package security

import (
	"net"
	"testing"
)

func TestSSRFIsPrivateIP(t *testing.T) {
	testCases := []struct {
		ip       string
		expected bool
	}{
		{"127.0.0.1", true},
		{"127.0.1.1", true},
		{"10.0.0.5", true},
		{"172.16.0.1", true},
		{"172.31.255.255", true},
		{"192.168.1.1", true},
		{"169.254.169.254", true}, // Cloud Metadata
		{"0.0.0.0", true},
		{"::1", true},
		{"fe80::1", true},
		{"8.8.8.8", false},       // Google Public DNS
		{"1.1.1.1", false},       // Cloudflare Public DNS
		{"142.250.190.46", false}, // Google.com
	}

	for _, tc := range testCases {
		ip := net.ParseIP(tc.ip)
		result := IsPrivateIP(ip)
		if result != tc.expected {
			t.Errorf("IsPrivateIP(%s) = %v; expected %v", tc.ip, result, tc.expected)
		}
	}
}

func TestSSRFFetchURLForbiddenSchemes(t *testing.T) {
	forbiddenURLs := []string{
		"file:///etc/passwd",
		"gopher://127.0.0.1:70",
		"dict://127.0.0.1:11211",
		"ftp://ftp.example.com",
		"http://169.254.169.254/latest/meta-data",
		"http://localhost:8080",
		"http://127.0.0.1:8080",
		"http://10.0.0.1/admin",
		"http://192.168.0.1/router",
		"http://metadata.google.internal/computeMetadata/v1",
	}

	for _, target := range forbiddenURLs {
		_, err := SafeFetchURL(target, 1024*1024)
		if err == nil {
			t.Errorf("Expected SSRF protection error for '%s', but request succeeded!", target)
		}
	}
}
