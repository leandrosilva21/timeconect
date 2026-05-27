'use client'

// Tabela das horas mensais incrementadas de um projeto Banco de Horas Mensal —
// mesmo conceito do histórico de aportes, mas mostrando o acúmulo automático do
// banco (sold_hours por mês de vigência). Puramente derivada de start_date +
// horas/mês + acumulado (que já congela no encerramento). Usada no modal de
// Aportes do projeto e no perfil do cliente (dashboard mensal), acima dos aportes.

interface MonthlyAccrualTableProps {
  startDate?: string | null
  hoursPerMonth: number
  /** Total acumulado (já congelado no encerramento). Define o nº de meses. */
  accumulated?: number | null
  /** Encerramento — usado só no fallback quando não há acumulado. */
  endDate?: string | null
  variant?: 'brand' | 'default'
}

function tokens(variant: 'brand' | 'default') {
  return variant === 'brand'
    ? { surface: 'var(--brand-surface)', border: 'var(--brand-border)', text: 'var(--brand-text)', muted: 'var(--brand-muted)', subtle: 'var(--brand-subtle)' }
    : { surface: 'var(--surface)', border: 'var(--border)', text: 'var(--text)', muted: 'var(--text-muted)', subtle: 'var(--text-light)' }
}

export function MonthlyAccrualTable({ startDate, hoursPerMonth, accumulated, endDate, variant = 'default' }: MonthlyAccrualTableProps) {
  const t = tokens(variant)

  // Nº de meses: preferir o acumulado (congela no encerramento); senão, do
  // início até hoje (ou até o encerramento, se informado).
  let months = 0
  if (hoursPerMonth > 0) {
    if (accumulated != null && accumulated > 0) {
      months = Math.max(0, Math.round(accumulated / hoursPerMonth))
    } else if (startDate) {
      const start = new Date(startDate + 'T00:00:00')
      const end = endDate ? new Date(endDate + 'T00:00:00') : new Date()
      months = Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1)
    }
  }

  if (!startDate || hoursPerMonth <= 0 || months <= 0) return null

  const start = new Date(startDate + 'T00:00:00')
  const rows = Array.from({ length: months }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    return { label: `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`, hours: hoursPerMonth }
  })
  const total = rows.reduce((s, r) => s + r.hours, 0)

  return (
    <div className="rounded-xl overflow-clip" style={{ border: `1px solid ${t.border}`, background: t.surface }}>
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: t.border }}>
        <h3 className="text-sm font-bold" style={{ color: t.text }}>Horas Mensais Incrementadas</h3>
        <span className="text-xs" style={{ color: t.subtle }}>{rows.length} {rows.length === 1 ? 'mês' : 'meses'} · {total}h</span>
      </div>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10" style={{ background: t.surface }}>
            <tr style={{ borderBottom: `1px solid ${t.border}` }}>
              <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: t.subtle }}>Mês</th>
              <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: t.subtle }}>Horas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${t.border}` }}>
                <td className="px-4 py-2 tabular-nums" style={{ color: t.muted }}>{r.label}</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold" style={{ color: t.text }}>{r.hours}h</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `1px solid ${t.border}` }}>
              <td className="px-4 py-2.5 text-right text-[13px] font-bold" style={{ color: t.text }}>Total</td>
              <td className="px-4 py-2.5 text-right tabular-nums font-bold" style={{ color: t.text }}>{total}h</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
