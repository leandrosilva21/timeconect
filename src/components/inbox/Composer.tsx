'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sendMessage } from '@/lib/inbox'

interface ComposerProps {
  conversationId: number
  placeholder?: string
  autoFocus?: boolean
}

export function Composer({ conversationId, placeholder, autoFocus = true }: ComposerProps) {
  const qc = useQueryClient()
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLTextAreaElement | null>(null)

  // Auto-focus quando troca de conversa
  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus()
  }, [conversationId, autoFocus])

  const submit = async () => {
    const body = value.trim()
    if (!body || busy) return

    setBusy(true)
    try {
      await sendMessage(conversationId, body)
      setValue('')
      await qc.invalidateQueries({ queryKey: ['inbox-messages', conversationId] })
      await qc.invalidateQueries({ queryKey: ['inbox-conversations'] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="border-t border-zinc-800 bg-zinc-950/60 px-4 py-3">
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <textarea
          ref={ref}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          aria-label="Escrever mensagem"
          placeholder={placeholder ?? 'Escreva uma mensagem... (Enter envia, Shift+Enter quebra linha)'}
          className="flex-1 resize-none bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
        />
        <button
          type="button"
          disabled={busy || !value.trim()}
          onClick={submit}
          aria-label="Enviar mensagem"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-emerald-500 text-zinc-950 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={14} /> Enviar
        </button>
      </div>
    </div>
  )
}
