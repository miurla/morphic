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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            // Auth links (invitations, password resets, bootstrap) carry
            // one-time credentials in ?token=. no-referrer keeps those
            // URLs out of Referer headers on outbound and same-origin
            // requests, including the /relay PostHog proxy above, which
            // would otherwise forward a token-bearing Referer upstream.
            key: 'Referrer-Policy',
            value: 'no-referrer'
          }
        ]
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
      }
    ]
  }
}

export default nextConfig
