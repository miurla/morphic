/** @type {import('next').NextConfig} */
const nextConfig = {
  // Reverse proxy for PostHog to reduce tracking-blocker interception.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: '/relay/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*'
      },
      {
        source: '/relay/array/:path*',
        destination: 'https://us-assets.i.posthog.com/array/:path*'
      },
      {
        source: '/relay/:path*',
        destination: 'https://us.i.posthog.com/:path*'
      }
    ]
  },
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
      },
      {
        protocol: 'https',
        hostname: 'www.google.com',
        port: '',
        pathname: '/s2/favicons/**' // Google Favicon API
      }
    ]
  }
}

export default nextConfig
