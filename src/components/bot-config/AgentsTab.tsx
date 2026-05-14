'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, ChevronDown, ChevronRight, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { listAgents, listProviders, updateAgent } from '@/lib/bot-config'
import { Skeleton } from '@/components/ui/skeleton'
import type { BotAgent } from '@/types/bot'

const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const

const input = 'w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500'

function AgentCard({ agent }: { agent: BotAgent }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState(agent.name)
  const [active, setActive] = useState(agent.active)
  const [priority, setPriority] = useState(agent.priority)
  const [minSev, setMinSev] = useState(agent.min_severity)
  const [cooldown, setCooldown] = useState(agent.cooldown_minutes)
  const [maxPerDay, setMaxPerDay] = useState(agent.max_per_day)
  const [modelOverride, setModelOverride] = useState(agent.model_override ?? '')
  const [tempOverride, setTempOverride] = useState(agent.temperature_override?.toString() ?? '')
  const [prompt, setPrompt] = useState(agent.system_prompt)

  useEffect(() => setDirty(true), [name, active, priority, minSev, cooldown, maxPerDay, modelOverride, tempOverride, prompt])
  useEffect(() => setDirty(false), [agent])

  const save = async () => {
    setBusy(true)
    try {
      await updateAgent(agent.id, {
        name,
        active,
        priority,
        min_severity: minSev,
        cooldown_minutes: cooldown,
        max_per_day: maxPerDay,
        model_override: modelOverride || null,
        temperature_override: tempOverride === '' ? null : Number(tempOverride),
        system_prompt: prompt,
      })
      await qc.invalidateQueries({ queryKey: ['bot-agents'] })
      toast.success('Agent atualizado')
      setDirty(false)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-zinc-800 rounded-md bg-zinc-900/30">
      <div className="flex items-start gap-3 p-4">
        <div className="w-10 h-10 rounded-md bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 ring-1 ring-emerald-500/30">
          <Bot size={17} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-zinc-100">{agent.name}</h3>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{agent.slug}</span>
          </div>
          {agent.role_description && (
            <p className="text-[11px] text-zinc-500 mt-1">{agent.role_description}</p>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200"
          >
            {expanded ? <ChevronDown size={11}/> : <ChevronRight size={11}/>} {expanded ? 'fechar configuração' : 'configurar'}
          </button>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={active}
            onChange={e => setActive(e.target.checked)}
            className="accent-emerald-500"
          />
          {active ? 'Ativo' : 'Inativo'}
        </label>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-zinc-800/50 pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider">Prioridade</label>
              <input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))} className={input} />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider">Severidade mín.</label>
              <select value={minSev} onChange={e => setMinSev(e.target.value)} className={input}>
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider">Cooldown (min)</label>
              <input type="number" min={0} value={cooldown} onChange={e => setCooldown(Number(e.target.value))} className={input} />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider">Máx./dia</label>
              <input type="number" min={1} value={maxPerDay} onChange={e => setMaxPerDay(Number(e.target.value))} className={input} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider">Modelo (override)</label>
              <input value={modelOverride} onChange={e => setModelOverride(e.target.value)} className={input} placeholder="(usa o padrão)" />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider">Temperatura (override)</label>
              <input value={tempOverride} onChange={e => setTempOverride(e.target.value)} className={input} placeholder="(usa o padrão)" />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-zinc-500 uppercase tracking-wider">System Prompt</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={8}
              className={`${input} font-mono leading-relaxed`}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[10px] text-zinc-600">trigger_conditions: <code>{JSON.stringify(agent.trigger_conditions)}</code></p>
            <button
              type="button"
              onClick={save}
              disabled={busy || !dirty}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-emerald-500 text-zinc-950 text-xs font-semibold hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={12}/> Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function AgentsTab() {
  const { data, isLoading } = useQuery({ queryKey: ['bot-agents'], queryFn: listAgents })

  if (isLoading) return <Skeleton className="h-40 bg-zinc-800" />
  const items = data?.data ?? []

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Agents executam em ordem de prioridade. Cooldown e máx./dia protegem contra ruído e custo de IA.
      </p>
      {items.map(a => <AgentCard key={a.id} agent={a} />)}
    </div>
  )
}
