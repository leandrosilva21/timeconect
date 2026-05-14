'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Key, X } from 'lucide-react'
import { toast } from 'sonner'
import { listProviders, updateProvider } from '@/lib/bot-config'
import { Skeleton } from '@/components/ui/skeleton'

export function ProvidersTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['bot-providers'],
    queryFn: listProviders,
  })

  if (isLoading) {
    return <Skeleton className="h-40 bg-zinc-800" />
  }

  const items = data?.data ?? []

  const toggle = async (id: number, enabled: boolean) => {
    try {
      await updateProvider(id, { enabled: !enabled })
      await qc.invalidateQueries({ queryKey: ['bot-providers'] })
      toast.success(enabled ? 'Provider desativado' : 'Provider ativado')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        A chave da API <strong>nunca</strong> é salva no banco. O campo <code>api_key_env</code> guarda apenas o nome
        da variável de ambiente que o servidor lê em runtime.
      </p>

      {items.map(p => (
        <div key={p.id} className="border border-zinc-800 rounded-md p-4 bg-zinc-900/30">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-100">{p.name}</h3>
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{p.slug}</span>
                {p.has_key
                  ? <span className="text-[10px] inline-flex items-center gap-1 text-emerald-400"><Check size={11}/> key configurada</span>
                  : <span className="text-[10px] inline-flex items-center gap-1 text-amber-400"><Key size={11}/> sem key</span>}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                ENV: <code>{p.api_key_env}</code> · modelo padrão: <code>{p.default_model}</code>
              </p>
              <p className="text-[11px] text-zinc-600 mt-0.5 truncate">{p.base_url}</p>
            </div>
            <button
              type="button"
              onClick={() => toggle(p.id, p.enabled)}
              className={[
                'text-xs px-3 py-1.5 rounded border transition-colors shrink-0',
                p.enabled
                  ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20'
                  : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800',
              ].join(' ')}
            >
              {p.enabled ? 'Ativo' : 'Inativo'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
