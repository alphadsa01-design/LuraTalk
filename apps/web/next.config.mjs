/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@luratalk/types"],
  async rewrites() {
    if (backendUrl && !backendUrl.includes('localhost') && !backendUrl.includes('127.0.0.1')) {
      const cleanUrl = backendUrl.replace(/\/+$/, '');
      return [
        {
          source: '/api/v1/:path*',
          destination: `${cleanUrl}/api/v1/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
