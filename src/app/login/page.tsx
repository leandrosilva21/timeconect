'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { ApiError } from '@/lib/api'

import { TimeConectIcon as SharedTimeConectIcon } from '@/components/branding/TimeConectIcon'

function TimeConectIcon({ size = 52 }: { size?: number }) {
  return <SharedTimeConectIcon size={size} variant="splash" />
}

function LoginForm() {
  const { login } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const passwordChanged = searchParams.get('senha_alterada') === '1'
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPassword, setShowPass] = useState(false)
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { requiresPasswordChange } = await login(email.trim(), password.trim())
      router.replace(requiresPasswordChange ? '/alterar-senha' : '/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Credenciais inválidas')
    } finally {
      setLoading(false)
    }
  }

  const inputBase: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    color: '#0F172A',
    borderRadius: 12,
    width: '100%',
    padding: '13px 16px',
    fontSize: 14,
    outline: 'none',
    transition: 'border 0.15s, box-shadow 0.15s, background 0.15s',
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {passwordChanged && (
        <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 12, background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', color: '#15803d' }}>
          Senha alterada com sucesso. Faça login com a nova senha.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748B' }}>
          E-mail
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value.toLowerCase())}
          placeholder="seu@email.com"
          required
          style={{ ...inputBase, caretColor: '#F97316' }}
          className="login-input"
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748B' }}>
          Senha
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={{ ...inputBase, paddingRight: 44, caretColor: '#F97316' }}
            className="login-input"
          />
          <button
            type="button"
            onClick={() => setShowPass(v => !v)}
            tabIndex={-1}
            style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="login-btn"
        style={{
          width: '100%',
          padding: '15px',
          borderRadius: 14,
          fontSize: 15,
          fontWeight: 700,
          color: 'white',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
          background: 'linear-gradient(160deg, #C2410C 0%, #EA580C 60%, #F97316 100%)',
          boxShadow: '0 8px 24px rgba(249,115,22,0.30), 0 2px 6px rgba(249,115,22,0.18)',
          transition: 'all 0.2s',
          letterSpacing: '0.02em',
        }}
      >
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg style={{ animation: 'spin 0.8s linear infinite' }} width={14} height={14} viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="10" strokeLinecap="round" />
            </svg>
            Entrando...
          </span>
        ) : 'Entrar'}
      </button>

      <div style={{ textAlign: 'center' }}>
        <Link href="/esqueci-senha" style={{ fontSize: 13, color: '#64748B', textDecoration: 'none', transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#F97316')}
          onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
        >
          Esqueceu a senha?
        </Link>
      </div>
    </form>
  )
}

const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV
const ENV_BANNER =
  APP_ENV === 'dev'
    ? { bg: '#FACC15', fg: '#000', text: '⚠ AMBIENTE DE DESENVOLVIMENTO — DADOS DESCARTÁVEIS ⚠' }
    : APP_ENV === 'homolog'
    ? { bg: '#DC2626', fg: '#fff', text: '⚠ AMBIENTE DE HOMOLOGAÇÃO — NÃO USE DADOS REAIS ⚠' }
    : null

export default function LoginPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F7F9FC', position: 'relative', overflow: 'hidden' }}>

      {ENV_BANNER && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: ENV_BANNER.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 0' }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.25em', color: ENV_BANNER.fg, textTransform: 'uppercase', fontFamily: 'monospace' }}>
            {ENV_BANNER.text}
          </span>
        </div>
      )}

      {/* Glow laranja sutil no canto superior */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 800, height: 500, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(249,115,22,0.10) 0%, transparent 65%)', filter: 'blur(60px)' }} />
      </div>

      <div style={{ animation: 'fadeUp 0.45s ease both', width: '100%', maxWidth: 460, padding: '0 20px', position: 'relative' }}>
        <div style={{
          borderRadius: 20,
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 50px rgba(15,23,42,0.08), 0 4px 12px rgba(15,23,42,0.04)',
          overflow: 'hidden',
        }}>

          <div style={{ padding: '36px 40px 32px', borderBottom: '1px solid #F1F5F9' }}>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
              <Image
                src="/logo.png"
                alt="HD Think"
                width={140}
                height={52}
                style={{ objectFit: 'contain' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
              <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 9, background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TimeConectIcon size={19} />
              </div>
              <div>
                <h1 className="login-title" style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: '#0F172A', lineHeight: 1.05 }}>
                  TimeConect
                </h1>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B', fontWeight: 400, letterSpacing: 0 }}>
                  Controle de horas e contratos em um só lugar
                </p>
              </div>
            </div>

          </div>

          <div style={{ padding: '32px 40px 36px' }}>
            <p style={{ margin: '0 0 24px', fontSize: 13, fontWeight: 600, color: '#475569', letterSpacing: '0.01em' }}>
              Acesse sua conta
            </p>
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#94A3B8', letterSpacing: '0.02em' }}>
          © {new Date().getFullYear()} HD Think · Todos os direitos reservados
        </p>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .login-input::placeholder { color: #94A3B8; }
        .login-input:focus {
          border: 1px solid rgba(249,115,22,0.55) !important;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.10) !important;
          background: #FFFFFF !important;
        }
        .login-btn:hover:not(:disabled) {
          box-shadow: 0 12px 32px rgba(249,115,22,0.40), 0 2px 6px rgba(249,115,22,0.20);
          transform: translateY(-1px);
        }
        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }
      `}</style>
    </div>
  )
}
