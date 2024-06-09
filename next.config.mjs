/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        reactCompiler: {
          compilationMode: 'annotation',
        },
      },
};

export default nextConfig;
