'use client'

import { useMemo, useState } from 'react'

export type SortDir = 'asc' | 'desc'
export interface SortState { key: string; dir: SortDir }

/**
 * Ordenação client-side de tabelas (sobre os dados já carregados na tela).
 *
 * Clicar num cabeçalho ordena asc; clicar de novo no mesmo inverte (desc);
 * clicar em outra coluna reinicia em asc. Nulos vão para o fim.
 *
 * Uso:
 *   const { sorted, thProps } = useTableSort(rows)
 *   <Th {...thProps('nome')}>Cliente</Th>
 *   {sorted.map(...)}
 *
 * Para valores que não são campos diretos da linha (ex.: vindos de um Map),
 * passe um `accessor(row, key)` — mantenha-o estável (useCallback) se inline.
 */
export function useTableSort<T>(
  rows: T[],
  accessor?: (row: T, key: string) => unknown,
  initial?: SortState,
) {
  const [sort, setSort] = useState<SortState | null>(initial ?? null)

  const requestSort = (key: string) =>
    setSort(prev => (prev?.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' }))

  const sorted = useMemo(() => {
    if (!sort) return rows
    const get = accessor ?? ((row: T, key: string) => (row as Record<string, unknown>)[key])
    const mul = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = get(a, sort.key)
      const bv = get(b, sort.key)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul
      return String(av).localeCompare(String(bv), 'pt-BR', { numeric: true, sensitivity: 'base' }) * mul
    })
  }, [rows, sort, accessor])

  /** Props para o <Th> do DS: `<Th {...thProps('nome')}>Cliente</Th>`. */
  const thProps = (key: string) => ({
    sortable: true,
    active: sort?.key === key,
    dir: sort?.key === key ? sort.dir : undefined,
    onClick: () => requestSort(key),
  })

  return { sorted, sort, requestSort, thProps }
}
