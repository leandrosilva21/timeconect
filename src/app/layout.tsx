import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

// Favicon env-aware: cores das faixas (dev=amarelo, homolog=vermelho, prod=cyan original)
const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV
const ICON_HREF =
  APP_ENV === 'dev'     ? '/favicon-dev.svg' :
  APP_ENV === 'homolog' ? '/favicon-homolog.svg' :
                          '/favicon-prod.svg'

export const metadata: Metadata = {
  title: 'Minutor',
  icons: { icon: [{ url: ICON_HREF, type: 'image/svg+xml' }] },
  description: 'Gestão de horas e despesas',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Minutor',
  },
  other: {
    'apple-touch-icon': '/apple-touch-icon.png',
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
