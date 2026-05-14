'use client'

import { useState } from 'react'
import { Bot } from 'lucide-react'
import { AppLayout } from '@/components/layout/app-layout'
import { GeneralTab } from '@/components/bot-config/GeneralTab'
import { ProvidersTab } from '@/components/bot-config/ProvidersTab'
import { AgentsTab } from '@/components/bot-config/AgentsTab'
import { SkillsTab } from '@/components/bot-config/SkillsTab'
import { RulesTab } from '@/components/bot-config/RulesTab'

type TabKey = 'general' | 'providers' | 'agents' | 'skills' | 'rules'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'general',   label: 'Geral' },
  { key: 'providers', label: 'Providers IA' },
  { key: 'agents',    label: 'Agents' },
  { key: 'skills',    label: 'Skills' },
  { key: 'rules',     label: 'Notificações' },
]

export default function BotMinutorConfigPage() {
  const [tab, setTab] = useState<TabKey>('general')

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-6">
        <header className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Bot size={18} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-100">BOT Minutor</h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                Configurações de provedores IA, agents, skills e regras de notificação.
              </p>
            </div>
          </div>
        </header>

        <nav className="flex gap-1 border-b border-zinc-800 mb-5">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={[
                'px-4 py-2 text-sm font-medium transition-colors border-b-2',
                tab === t.key
                  ? 'text-emerald-300 border-emerald-500'
                  : 'text-zinc-400 border-transparent hover:text-zinc-200',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === 'general'   && <GeneralTab />}
        {tab === 'providers' && <ProvidersTab />}
        {tab === 'agents'    && <AgentsTab />}
        {tab === 'skills'    && <SkillsTab />}
        {tab === 'rules'     && <RulesTab />}
      </div>
    </AppLayout>
  )
}
