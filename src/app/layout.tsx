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

// Nome do ambiente exibido na faixa. Cada base seta NEXT_PUBLIC_ENV_LABEL no
// seu .env.local (ex: DESENVOLVIMENTO, REPLICA). Fallback genérico se ausente.
const ENV_LABEL = process.env.NEXT_PUBLIC_ENV_LABEL ?? 'AMBIENTE LOCAL'

// Banner env-aware. DEFAULT = null → produção (NEXT_PUBLIC_APP_ENV não setado)
// NUNCA mostra faixa (fix do vazamento, PR prod #8). 'local' = base local (desenv/replica).
// pillFg = cor do texto na caixa sólida central (legível sobre as listras/gradiente).
const BANNER =
  APP_ENV === 'homolog' ? { label: 'HOMOLOG — AMBIENTE DE VALIDAÇÃO', bg: 'linear-gradient(90deg, #dc2626 0%, #ef4444 50%, #dc2626 100%)', pillFg: '#fca5a5' }
  : APP_ENV === 'dev'   ? { label: 'DESENV1 — DADOS COPIADOS DE PROD', bg: 'linear-gradient(90deg, #ea580c 0%, #f97316 50%, #ea580c 100%)', pillFg: '#fdba74' }
  // 'local' = desenv/replica. Cor por ENV_LABEL pra NÃO confundir as duas:
  // DESENVOLVIMENTO = azul listrado, REPLICA (e demais) = amarelo listrado.
  : APP_ENV === 'local' ? (ENV_LABEL === 'DESENVOLVIMENTO'
      ? { label: `${ENV_LABEL} — DADOS COPIADOS DE PROD • NÃO É PRODUÇÃO`, bg: 'repeating-linear-gradient(45deg, #2563eb 0px, #2563eb 14px, #1a1a1a 14px, #1a1a1a 28px)', pillFg: '#93c5fd' }
      : { label: `${ENV_LABEL} — DADOS COPIADOS DE PROD • NÃO É PRODUÇÃO`, bg: 'repeating-linear-gradient(45deg, #facc15 0px, #facc15 14px, #1a1a1a 14px, #1a1a1a 28px)', pillFg: '#fde047' })
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
      <body className="h-full" style={{ '--banner-h': BANNER ? '28px' : '0px' } as React.CSSProperties}>
        {BANNER && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              background: BANNER.bg,
              minHeight: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3px 8px',
              fontFamily: 'var(--font-inter), sans-serif',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                background: 'rgba(0,0,0,0.82)',
                color: BANNER.pillFg,
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: '0.12em',
                padding: '3px 18px',
                borderRadius: 5,
                whiteSpace: 'nowrap',
                maxWidth: '94vw',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              ⚠ {BANNER.label}
            </span>
          </div>
        )}
        <div style={{ paddingTop: BANNER ? 28 : 0 }}>
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  )
}
