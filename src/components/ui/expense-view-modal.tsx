'use client'

import { useState } from 'react'
import {
  X, Receipt, Pencil, Calendar, Building2, FolderOpen,
  Tag, CreditCard, Paperclip, FileText, Eye, Download,
} from 'lucide-react'
import type { Expense } from '@/types'
import { toRelativePath } from '@/lib/api'

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

const EXP_STATUS_CONF: Record<string, { bg: string; color: string; label: string }> = {
  pending:              { bg: 'rgba(234,179,8,0.12)',  color: '#EAB308', label: 'Pendente' },
  approved:             { bg: 'rgba(34,197,94,0.12)',  color: '#22C55E', label: 'Aprovado' },
  rejected:             { bg: 'rgba(239,68,68,0.12)',  color: '#EF4444', label: 'Rejeitado' },
  adjustment_requested: { bg: 'rgba(249,115,22,0.12)', color: '#F97316', label: 'Ajuste Solicitado' },
}

const EXP_TYPE_LABEL: Record<string, string> = {
  reimbursement:  'Reembolso',
  advance:        'Adiantamento',
  corporate_card: 'Cartão Corporativo',
}

const PAYMENT_LABEL_MAP: Record<string, string> = {
  pix:           'PIX',
  credit_card:   'Cartão de Crédito',
  debit_card:    'Cartão de Débito',
  cash:          'Dinheiro',
  bank_transfer: 'Transferência Bancária',
}

async function fetchAndOpenFile(url: string, download = false) {
  const res = await fetch(toRelativePath(url), { credentials: 'same-origin' })
  if (!res.ok) throw new Error('not_found')
  const blob = await res.blob()
  const cd = res.headers.get('content-disposition') ?? ''
  const match = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
  const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'pdf'
  const filename = match?.[1]?.replace(/['"]/g, '') ?? `comprovante.${ext}`
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  if (download) { a.download = filename } else { a.target = '_blank'; a.rel = 'noopener noreferrer' }
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
}

function ReceiptLink({ url }: { url: string }) {
  const [loading, setLoading] = useState(false)
  const handle = async (download: boolean) => {
    setLoading(true)
    try { await fetchAndOpenFile(url, download) }
    catch { alert(download ? 'Erro ao baixar comprovante' : 'Erro ao abrir comprovante') }
    finally { setLoading(false) }
  }
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => handle(false)} disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        style={{ background: 'rgba(0,245,255,0.08)', color: 'var(--brand-primary)', border: '1px solid rgba(0,245,255,0.15)' }}>
        <Eye size={11} /> {loading ? 'Carregando...' : 'Visualizar'}
      </button>
      <button type="button" onClick={() => handle(true)} disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--brand-subtle)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <Download size={11} /> Baixar
      </button>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, children, last }: {
  icon: React.ElementType; label: string; value?: string | null
  children?: React.ReactNode; last?: boolean
}) {
  return (
    <div className={`flex items-start gap-4 px-5 py-4 ${!last ? 'border-b' : ''}`}
      style={!last ? { borderColor: 'var(--brand-border)' } : undefined}>
      <span className="mt-0.5 shrink-0 p-2 rounded-lg"
        style={{ background: 'rgba(0,245,255,0.06)', color: 'var(--brand-primary)' }}>
        <Icon size={14} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-widest mb-1" style={{ color: 'var(--brand-subtle)' }}>{label}</p>
        {children ?? <p className="text-sm font-medium" style={{ color: 'var(--brand-text)' }}>{value ?? '—'}</p>}
      </div>
    </div>
  )
}

export function ExpenseViewModal({
  expense, onClose, onEdit,
}: {
  expense: Expense
  onClose: () => void
  onEdit?: () => void
}) {
  const sc = EXP_STATUS_CONF[expense.status] ?? { bg: 'rgba(113,113,122,0.12)', color: '#71717A', label: expense.status }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="relative w-full max-w-2xl mt-8 rounded-2xl shadow-2xl"
        style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)' }}>
        <button onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg hover:bg-white/5 transition-colors"
          style={{ color: 'var(--brand-subtle)' }}>
          <X size={18} />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-5 flex items-start gap-4">
          <div className="p-3 rounded-2xl shrink-0"
            style={{ background: 'rgba(0,245,255,0.08)', color: 'var(--brand-primary)' }}>
            <Receipt size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--brand-text)' }}>Detalhes da Despesa</h3>
            <p className="text-xs mt-1" style={{ color: 'var(--brand-subtle)' }}>
              #{expense.id} · {formatDate(expense.expense_date)}
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Status + Categoria */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: sc.bg, color: sc.color }}>
              {sc.label}
            </span>
            {expense.category?.name && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--brand-muted)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Tag size={11} /> {expense.category.name}
              </span>
            )}
          </div>

          {/* Valor hero */}
          <div className="rounded-2xl px-5 py-5"
            style={{ background: 'rgba(0,245,255,0.06)', border: '1px solid rgba(0,245,255,0.15)' }}>
            <p className="text-[11px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--brand-subtle)' }}>Valor Total</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--brand-primary)' }}>{formatCurrency(expense.amount)}</p>
          </div>

          {/* Info card */}
          <div className="rounded-xl overflow-hidden"
            style={{ background: 'var(--brand-bg)', border: '1px solid var(--brand-border)' }}>
            <InfoRow icon={Calendar} label="Data" value={formatDate(expense.expense_date)} />
            {expense.user?.name && (
              <InfoRow icon={Building2} label="Colaborador" value={expense.user.name} />
            )}
            {expense.project?.customer?.name && (
              <InfoRow icon={Building2} label="Cliente" value={expense.project.customer.name} />
            )}
            <InfoRow icon={FolderOpen} label="Projeto" value={expense.project?.name} />
            <InfoRow icon={Tag} label="Tipo" value={EXP_TYPE_LABEL[expense.expense_type] ?? expense.expense_type} />
            {expense.payment_method && (
              <InfoRow icon={CreditCard} label="Pagamento" value={PAYMENT_LABEL_MAP[expense.payment_method] ?? expense.payment_method} />
            )}
            <InfoRow icon={Paperclip} label="Comprovante" last>
              {expense.receipt_url
                ? <ReceiptLink url={expense.receipt_url} />
                : <span className="text-sm" style={{ color: 'var(--brand-subtle)' }}>Sem comprovante</span>
              }
            </InfoRow>
          </div>

          {/* Descrição */}
          {expense.description && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--brand-bg)', border: '1px solid var(--brand-border)' }}>
              <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: '1px solid var(--brand-border)' }}>
                <FileText size={14} style={{ color: 'var(--brand-primary)' }} />
                <span className="text-[11px] uppercase tracking-widest font-medium" style={{ color: 'var(--brand-subtle)' }}>Descrição</span>
              </div>
              <p className="px-5 py-4 text-sm leading-relaxed" style={{ color: 'var(--brand-muted)' }}>
                {expense.description}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            {onEdit && (
              <button onClick={onEdit}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/5"
                style={{ color: 'var(--brand-muted)', border: '1px solid var(--brand-border)' }}>
                <Pencil size={14} /> Editar
              </button>
            )}
            <button onClick={onClose}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/5"
              style={{ color: 'var(--brand-subtle)', border: '1px solid var(--brand-border)' }}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
