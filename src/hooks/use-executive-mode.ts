'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'minutor.executive_mode'
const EVENT = 'minutor:executive-mode-change'

function read(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(STORAGE_KEY) === '1'
}

/**
 * Modo executivo — esconde elementos de "ruído" no board operacional
 * (health dots, contagens granulares, chips secundários). Mantém só
 * nome, status macro, % progresso, risco e horas totais.
 *
 * Estado persistido em localStorage e sincronizado entre abas/componentes
 * via CustomEvent.
 */
export function useExecutiveMode(): [boolean, (next?: boolean) => void] {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(read())

    function onChange() { setEnabled(read()) }
    window.addEventListener(EVENT, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(EVENT, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  const toggle = useCallback((next?: boolean) => {
    const value = typeof next === 'boolean' ? next : !read()
    if (value) window.localStorage.setItem(STORAGE_KEY, '1')
    else       window.localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new CustomEvent(EVENT))
  }, [])

  return [enabled, toggle]
}
