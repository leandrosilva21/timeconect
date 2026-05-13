'use client'

import { useState, useEffect, useRef } from 'react'
import { MoreVertical } from 'lucide-react'

export interface RowMenuItem {
  label: string
  icon: React.ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

export function RowMenu({ items }: { items: RowMenuItem[] }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const ref    = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const open   = pos !== null

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setPos(null)
    }
    document.addEventListener('mousedown', handler)
    // Fecha em ESC; scroll NÃO fecha mais (era hostil quando o dropdown
    // tem muitos itens e a página rola um pixel só de mover o mouse).
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setPos(null) }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (items.length === 0) return null

  function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (open) { setPos(null); return }
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const vh = window.innerHeight
    const vw = window.innerWidth
    const W  = 200
    const margin = 8
    // Altura desejada limitada a 70vh — itens em excesso ganham scroll interno.
    const desiredH = items.length * 36 + 8
    const maxH     = Math.floor(vh * 0.7)
    const dropH    = Math.min(desiredH, maxH)
    // Vertical: abre embaixo do botão se couber, senão acima; sempre cola no botão.
    const spaceBelow = vh - r.bottom - margin
    const spaceAbove = r.top - margin
    let top: number
    if (spaceBelow >= dropH || spaceBelow >= spaceAbove) {
      top = r.bottom + 4
    } else {
      top = Math.max(margin, r.top - dropH - 4)
    }
    // Horizontal: à direita do botão; se estourar, alinha à esquerda do botão.
    let left = r.right + 4
    if (left + W > vw - margin) left = Math.max(margin, r.left - W - 4)
    setPos({ left, top })
  }

  return (
    <div ref={ref}>
      <button
        ref={btnRef}
        onClick={toggle}
        className={`p-1.5 rounded transition-colors ${
          open ? 'text-zinc-200 bg-zinc-700' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
        }`}
      >
        <MoreVertical size={14} />
      </button>
      {pos && (
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, maxHeight: '70vh' }}
          className="min-w-[160px] bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl py-1 overflow-y-auto"
        >
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => { if (!item.disabled) { item.onClick(); setPos(null) } }}
              disabled={item.disabled}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed ${
                item.danger
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
