'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'
import { listRules, updateRule } from '@/lib/bot-config'
import { Skeleton } from '@/components/ui/skeleton'

export function RulesTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['bot-rules'], queryFn: listRules })

  if (isLoading) return <Skeleton className="h-40 bg-zinc-800" />
  const items = data?.data ?? []

  const toggle = async (id: number, active: boolean) => {
    try {
      await updateRule(id, { active: !active })
      await qc.invalidateQueries({ queryKey: ['bot-rules'] })
      toast.success(active ? 'Regra desativada' : 'Regra ativada')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Regras definem PARA QUEM e POR QUAL canal cada evento é entregue. Exemplo: severity ≥ high vai para Inbox dos admins.
      </p>

      {items.map(r => (
        <div key={r.id} className="border border-zinc-800 rounded-md p-4 bg-zinc-900/30">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-zinc-800 text-zinc-300 flex items-center justify-center shrink-0">
              <Bell size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-zinc-100">{r.name}</h3>
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                <span><strong className="text-zinc-300">trigger:</strong> {r.trigger_event}</span>
                <span><strong className="text-zinc-300">severity ≥</strong> {r.severity_min}</span>
                <span><strong className="text-zinc-300">para:</strong> {r.target_type}{r.target_value ? `:${r.target_value}` : ''}</span>
                <span><strong className="text-zinc-300">canal:</strong> {r.channel}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => toggle(r.id, r.active)}
              className={[
                'text-xs px-3 py-1.5 rounded border transition-colors shrink-0',
                r.active
                  ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20'
                  : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800',
              ].join(' ')}
            >
              {r.active ? 'Ativa' : 'Inativa'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
