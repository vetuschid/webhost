/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '50mb' },
  },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
