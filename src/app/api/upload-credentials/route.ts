import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const TOKEN_COOKIE = 'minutor_token'

// Credenciais para upload DIRETO no backend (ex.: api.minutor.com.br), evitando o
// limite de body (~4.5MB) da borda da Vercel no caminho /api/v1 (middleware + rewrite).
// O backend aceita até 20MB (PHP) e o CORS já libera o domínio do app.
// Só responde para a sessão autenticada (cookie httpOnly minutor_token) — devolve
// o token DESSA sessão para o JS usar como Bearer no upload direto.
export async function GET() {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value
  if (!token) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 })
  }
  const apiBase = process.env.BACKEND_URL ?? 'http://localhost:8000'
  return NextResponse.json({ token, apiBase })
}
