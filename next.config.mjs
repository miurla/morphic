import { withBotId } from 'botid/next/config'

// BotID needs Vercel's OIDC token, so it only runs on Vercel. VERCEL is set
// at build time there; env inlines the result into the client bundle too.
const botIdEnabled = process.env.VERCEL === '1'

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { BOTID_ENABLED: botIdEnabled ? 'true' : 'false' },
  skipTrailingSlashRedirect: true,
  experimental: {
    staleTimes: { dynamic: 300 }
  },
  async headers() {
    return [
      {
        // Only the auth pages carry one-time credentials in ?token=
        // (invitations, password resets, bootstrap). no-referrer on those
        // pages keeps the token-bearing URL out of Referer headers on
        // outbound and same-origin requests — including requests the
        // /relay PostHog proxy route makes upstream — while the rest of
        // the site keeps normal referrer data for analytics.
        source: '/auth/:path*',
        headers: [
          {
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

export default botIdEnabled ? withBotId(nextConfig) : nextConfig
