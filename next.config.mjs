/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const buildWithDocker = process.env.DOCKER === 'true';

const nextConfig = {
  compress: isProd,
  output: buildWithDocker ? 'standalone' : undefined,
};

export default nextConfig;
