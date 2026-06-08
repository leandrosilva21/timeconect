'use client'

import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export type KpiAccent = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

interface KpiCardProps {
  /** Texto pequeno superior (uppercase, 12px). */
  label: string
  /** Valor principal exibido em destaque (24px / 600). */
  value: string | number
  /** Sufixo do valor — ex: "h", "%", "R$". Renderizado discreto após o valor. */
  unit?: string
  /** Texto auxiliar abaixo do valor (11px / muted). */
  hint?: string
  /** Ícone Lucide (ou similar). Quando informado, é renderizado em um chip com cor do accent. */
  icon?: React.ElementType
  /** Cor semântica do ícone e (opcionalmente) do valor. */
  accent?: KpiAccent
  /** Quando true, esconde o valor e mostra um Skeleton. */
  loading?: boolean
  /** Click handler — habilita estado clicável (cursor + hover lift). */
  onClick?: () => void
  /** Slot à direita do header — útil pra filtros inline tipo Mês/Ano. */
  action?: React.ReactNode
  /** Classes Tailwind extras pro container. */
  className?: string
}

const ACCENT_COLOR: Record<KpiAccent, string> = {
  default: 'var(--text)',
  primary: 'var(--primary)',
  success: 'var(--success-border)',
  warning: 'var(--warning-border)',
  danger:  'var(--danger-border)',
  info:    'var(--info-border)',
}

const ACCENT_SOFT_BG: Record<KpiAccent, string> = {
  default: 'var(--surface-hover)',
  primary: 'var(--primary-soft)',
  success: 'var(--success-bg)',
  warning: 'var(--warning-bg)',
  danger:  'var(--danger-bg)',
  info:    'var(--info-bg)',
}

/**
 * Cartão de KPI canônico do TimeConect.
 *
 * Tipografia (spec light theme — Set/2026):
 *  - Label: 12px / 500 / uppercase / tracking 0.04em / var(--text-muted)
 *  - Valor: 24px / 600 / leading-none / var(--text) (ou accent)
 *  - Hint:  11px / 500 / var(--text-light)
 *
 * Visual:
 *  - bg var(--surface) / border var(--border) / rounded-xl / p-4
 *  - shadow-xs default, shadow-sm em hover quando onClick
 *  - Ícone (opcional) em chip 28×28 com soft-bg do accent
 *
 * Cores no value:
 *  - accent='default' → var(--text) (preto)
 *  - accent='primary' → var(--primary) (cyan)
 *  - accent='success/warning/danger/info' → respectivo *-border
 */
export function KpiCard({
  label, value, unit, hint, icon: Icon, accent = 'default',
  loading, onClick, action, className = '',
}: KpiCardProps) {
  const valueColor = ACCENT_COLOR[accent]
  const iconBg = ACCENT_SOFT_BG[accent]
  const iconColor = ACCENT_COLOR[accent]
  const clickable = !!onClick

  return (
    <div
      onClick={onClick}
      className={`rounded-xl p-4 flex flex-col gap-2 transition-all duration-150 ${clickable ? 'cursor-pointer hover:-translate-y-px' : ''} ${className}`}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-xs, var(--brand-card-shadow))',
      }}
      onMouseEnter={clickable ? (e) => (e.currentTarget.style.boxShadow = 'var(--shadow-sm, var(--brand-card-shadow-md))') : undefined}
      onMouseLeave={clickable ? (e) => (e.currentTarget.style.boxShadow = 'var(--shadow-xs, var(--brand-card-shadow))') : undefined}
    >
      {/* Header — ícone + label + ação à direita */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: iconBg, color: iconColor }}
            >
              <Icon size={13} />
            </span>
          )}
          <span className="ds-text-label truncate">{label}</span>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* Valor */}
      <div className="flex items-end gap-1.5">
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <>
            <span className="ds-text-kpi ds-text-numeric" style={{ color: valueColor }}>{value}</span>
            {unit && (
              <span className="ds-text-body-sm mb-0.5" style={{ color: 'var(--text-muted)' }}>{unit}</span>
            )}
          </>
        )}
      </div>

      {/* Hint opcional */}
      {hint && (
        <span className="ds-text-caption mt-1" style={{ color: 'var(--text-light)' }}>{hint}</span>
      )}
    </div>
  )
}
