'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { listSkills, updateSkill } from '@/lib/bot-config'
import { Skeleton } from '@/components/ui/skeleton'
import type { BotSkill } from '@/types/bot'

const SEV_STYLE: Record<string, string> = {
  info:     'bg-blue-500/15 text-blue-300 border-blue-500/30',
  low:      'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  medium:   'bg-amber-500/15 text-amber-300 border-amber-500/30',
  high:     'bg-orange-500/15 text-orange-300 border-orange-500/30',
  critical: 'bg-red-500/15 text-red-300 border-red-500/30',
}

const OP_LABEL: Record<string, string> = {
  '>':  'maior que',
  '>=': 'maior ou igual a',
  '<':  'menor que',
  '<=': 'menor ou igual a',
  '=':  'igual a',
  '==': 'igual a',
  '!=': 'diferente de',
}

function RuleClause({ skill }: { skill: BotSkill }) {
  const cfg = skill.config as Record<string, unknown>

  if (skill.rule_type === 'threshold') {
    const metric = cfg.metric as string | undefined
    const operator = cfg.operator as string | undefined
    const value = cfg.value
    const and = cfg.and as Record<string, unknown> | undefined

    return (
      <div className="font-mono text-[11px] text-zinc-300 leading-relaxed">
        <div>
          <span className="text-zinc-500">IF</span>{' '}
          <span className="text-emerald-300">{metric}</span>{' '}
          <span className="text-amber-300">{operator}</span>{' '}
          <span className="text-violet-300">{String(value)}</span>
          {and && (
            <>
              {'  '}
              <span className="text-zinc-500">AND</span>{' '}
              <span className="text-emerald-300">{String(and.metric)}</span>{' '}
              <span className="text-amber-300">{String(and.operator)}</span>{' '}
              <span className="text-violet-300">{String(and.value)}</span>
            </>
          )}
        </div>
        <div className="mt-1">
          <span className="text-zinc-500">THEN</span>{' '}
          <span className="text-zinc-200">severity</span>{' '}
          <span className="text-amber-300">=</span>{' '}
          <span className="text-red-300">{skill.severity}</span>
        </div>
      </div>
    )
  }

  if (skill.rule_type === 'sql') {
    return (
      <pre className="font-mono text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
        {String(cfg.sql ?? '(sem SQL definido)')}
      </pre>
    )
  }

  if (skill.rule_type === 'event') {
    return (
      <div className="font-mono text-[11px] text-zinc-300 leading-relaxed">
        <span className="text-zinc-500">ON event</span>{' '}
        <span className="text-emerald-300">{String(cfg.event_class ?? '?')}</span>
      </div>
    )
  }

  return null
}

export function SkillsTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['bot-skills'], queryFn: listSkills })

  if (isLoading) return <Skeleton className="h-40 bg-zinc-800" />
  const items = data?.data ?? []

  const toggle = async (id: number, active: boolean) => {
    try {
      await updateSkill(id, { active: !active })
      await qc.invalidateQueries({ queryKey: ['bot-skills'] })
      toast.success(active ? 'Skill desativada' : 'Skill ativada')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-zinc-900/40 border border-zinc-800 p-3">
        <div className="flex items-center gap-2 text-zinc-300 text-sm font-medium">
          <Zap size={14} /> Rule Engine
        </div>
        <p className="text-xs text-zinc-500 mt-1">
          Skills são regras determinísticas. A classificação acontece <strong>antes</strong> de chamar IA — agents só rodam se uma skill disparar.
        </p>
      </div>

      {items.map(s => (
        <div key={s.id} className="border border-zinc-800 rounded-md bg-zinc-900/30 overflow-hidden">
          <div className="flex items-start gap-3 p-4">
            <div className="w-10 h-10 rounded-md bg-zinc-800 text-amber-300 flex items-center justify-center shrink-0 ring-1 ring-amber-500/30">
              <Zap size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-zinc-100">{s.name}</h3>
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{s.slug}</span>
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">{s.rule_type}</span>
                <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${SEV_STYLE[s.severity] ?? 'border-zinc-700 text-zinc-400'}`}>
                  → {s.severity}
                </span>
              </div>
              {s.description && (
                <p className="text-[11px] text-zinc-500 mt-1">{s.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => toggle(s.id, s.active)}
              className={[
                'text-xs px-3 py-1.5 rounded border transition-colors shrink-0',
                s.active
                  ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20'
                  : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800',
              ].join(' ')}
            >
              {s.active ? 'Ativa' : 'Inativa'}
            </button>
          </div>

          <div className="bg-zinc-950/60 border-t border-zinc-800/60 px-4 py-3">
            <RuleClause skill={s} />
          </div>
        </div>
      ))}
    </div>
  )
}
