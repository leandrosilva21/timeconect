'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Bot, Send } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { botQuery, sendMessage } from '@/lib/inbox'

interface ComposerProps {
  conversationId: number
  placeholder?: string
  autoFocus?: boolean
}

const BOT_PREFIX = /^@bot\b/i

export function Composer({ conversationId, placeholder, autoFocus = true }: ComposerProps) {
  const qc = useQueryClient()
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [botThinking, setBotThinking] = useState(false)
  const ref = useRef<HTMLTextAreaElement | null>(null)

  const isBotQuery = BOT_PREFIX.test(value.trimStart())

  // Auto-focus quando troca de conversa
  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus()
  }, [conversationId, autoFocus])

  const submit = async () => {
    const body = value.trim()
    if (!body || busy) return

    const asBot = BOT_PREFIX.test(body)

    setBusy(true)
    if (asBot) setBotThinking(true)
    try {
      if (asBot) {
        await botQuery(conversationId, body)
      } else {
        await sendMessage(conversationId, body)
      }
      setValue('')
      await qc.invalidateQueries({ queryKey: ['inbox-messages', conversationId] })
      await qc.invalidateQueries({ queryKey: ['inbox-conversations'] })
    } catch (e) {
      const msg = (e as Error).message
      toast.error(msg.includes('429') ? 'Aguarde alguns segundos antes de perguntar de novo ao BOT.' : msg)
    } finally {
      setBusy(false)
      setBotThinking(false)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="border-t border-[var(--brand-border)] bg-[var(--surface)] px-4 py-3">
      <div className="max-w-4xl mx-auto space-y-1.5">
        {(isBotQuery || botThinking) && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
            <Bot size={12} className={botThinking ? 'animate-pulse' : ''} />
            {botThinking
              ? 'BOT consultando o Minutor… isso pode levar alguns segundos'
              : 'O BOT vai responder esta mensagem consultando dados do Minutor'}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={ref}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            disabled={botThinking}
            aria-label="Escrever mensagem"
            placeholder={placeholder ?? 'Mensagem... Use @bot para perguntar algo ao BOT (ex.: @bot projetos da VEDAMOTORS)'}
            className={[
              'flex-1 resize-none border rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-light)] focus:outline-none transition-colors disabled:opacity-60',
              isBotQuery
                ? 'bg-emerald-500/5 border-emerald-500/40 focus:border-emerald-500'
                : 'bg-[var(--bg)] border-[var(--brand-border)] focus:border-emerald-500',
            ].join(' ')}
          />
          <button
            type="button"
            disabled={busy || !value.trim()}
            onClick={submit}
            aria-label={isBotQuery ? 'Perguntar ao BOT' : 'Enviar mensagem'}
            className={[
              'inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              isBotQuery
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'bg-emerald-500 text-white hover:bg-emerald-400',
            ].join(' ')}
          >
            {isBotQuery ? <Bot size={14} /> : <Send size={14} />}
            {isBotQuery ? 'Perguntar' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
