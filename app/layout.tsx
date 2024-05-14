import type { Metadata, Viewport } from 'next'
import { Inter as FontSans } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'
import { ThemeProvider } from '@/components/theme-provider'
import Header from '@/components/header'
import Footer from '@/components/footer'
import { Sidebar } from '@/components/sidebar'
import { Toaster } from '@/components/ui/sonner'

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans'
})

const title = 'Moss - 动态、复杂、高维数据的智能分析'
const description =
  '基于先进的数据+AI一体化引擎，赋能企业对运营生产动态的实时监控与掌握，实现生产经营的降本增益！'

export const metadata: Metadata = {
  metadataBase: new URL('https://demo.txz.tech'),
  title,
  description,
  openGraph: {
    title,
    description,
    siteName: title,
    type: 'website',
    images: [
      {
        url: `/opengraph-image.png`, // Must be an absolute URL
        width: 512,
        height: 512,
        alt: 'Moss'
      }
    ]
  }
  // twitter: {
  //   title,
  //   description,
  //   card: 'summary_large_image',
  //   creator: '@miiura'
  // }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('font-sans antialiased', fontSans.variable)}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Header />
          {children}
          <Sidebar />
          <Footer />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
