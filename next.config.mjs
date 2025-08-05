/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    'react-markdown',
    'remark-gfm',
    'remark-math',
    'rehype-katex',
    'rehype-external-links',
    'decode-named-character-reference'
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '/vi/**'
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/a/**' // Google user content often follows this pattern
      },
      {
        protocol: 'https',
        hostname: 'imgs.search.brave.com',
        port: '',
        pathname: '/**' // Brave search cached images
      }
    ]
  }
}

export default nextConfig
