import type { Metadata } from 'next'
import { Inter, Geist } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
// Geist Sans — usada em headings (h1/h2/h3) e KPIs via --font-display.
// Visual mais geométrico/moderno vs Inter (humanista). Inter segue no body.
const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

// Favicon + banner env-aware (dev=amarelo, homolog=vermelho, prod=sem banner)
const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV
const ICON_HREF =
  APP_ENV === 'dev'     ? '/favicon-dev.svg' :
  APP_ENV === 'homolog' ? '/favicon-homolog.svg' :
                          '/favicon-prod.svg'

// Banner env-aware. DEFAULT = null → produção (NEXT_PUBLIC_APP_ENV não setado)
// NUNCA mostra faixa (fix do vazamento, PR prod #8). 'local' = Replica.
const BANNER =
  APP_ENV === 'homolog' ? { label: 'HOMOLOG', bg: 'linear-gradient(90deg, #dc2626 0%, #ef4444 50%, #dc2626 100%)', fg: '#ffffff' }
  : APP_ENV === 'dev'   ? { label: 'DESENV1', bg: 'linear-gradient(90deg, #ea580c 0%, #f97316 50%, #ea580c 100%)', fg: '#ffffff' }
  : APP_ENV === 'local' ? { label: 'REPLICA LOCAL — DADOS COPIADOS DE PROD • localhost:3001 • NÃO É PRODUÇÃO', bg: 'repeating-linear-gradient(45deg, #facc15 0px, #facc15 14px, #1a1a1a 14px, #1a1a1a 28px)', fg: '#0a0a0a' }
  : null

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
    <html lang="pt-BR" className={`${inter.variable} ${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="h-full">
        {BANNER && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              background: BANNER.bg,
              color: BANNER.fg,
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.15em',
              textAlign: 'center',
              padding: '4px 8px',
              fontFamily: 'var(--font-inter), sans-serif',
              textShadow: BANNER.fg === '#0a0a0a' ? '0 1px 0 rgba(255,255,255,0.4)' : 'none',
              pointerEvents: 'none',
            }}
          >
            {BANNER.label}
          </div>
        )}
        <div style={{ paddingTop: BANNER ? 24 : 0 }}>
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  )
}
