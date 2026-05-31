import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Morphic',
    short_name: 'Morphic',
    description: 'A fully open-source AI-powered answer engine with a generative UI.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fafafa',
    theme_color: '#fafafa',
    categories: ['productivity', 'utilities', 'education'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  }
}
