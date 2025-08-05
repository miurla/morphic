/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    'react-markdown',
    'remark-gfm',
    'remark-math',
    'rehype-katex',
    'rehype-external-links',
    'decode-named-character-reference',
    'character-entities',
    'mdast-util-from-markdown',
    'micromark',
    'remark-parse'
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
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.mjs': ['.mjs', '.mts'],
      '.cjs': ['.cjs', '.cts']
    }
    return config
  }
}

export default nextConfig
