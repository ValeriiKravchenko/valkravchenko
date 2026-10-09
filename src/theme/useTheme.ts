import { useCallback, useEffect, useRef, useState } from 'react'
import { DARK_QUERY, isTheme, resolveTheme, THEME_STORAGE_KEY, type Theme } from './resolveTheme'

function readStored(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage is unavailable: the choice just is not remembered.
  }
}

function systemMedia(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null
}

export interface UseTheme {
  theme: Theme
  toggle: () => void
}

/**
 * Current theme and a toggle. Until the visitor picks a theme the hook follows
 * the system one; after that the choice is kept in storage.
 */
export function useTheme(): UseTheme {
  const [theme, setTheme] = useState<Theme>(() =>
    resolveTheme(readStored(), systemMedia()?.matches ?? false),
  )
  const chosen = useRef<boolean | null>(null)
  if (chosen.current === null) chosen.current = isTheme(readStored())

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const media = systemMedia()
    if (!media) return
    const onChange = (event: MediaQueryListEvent) => {
      if (!chosen.current) setTheme(resolveTheme(null, event.matches))
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const toggle = useCallback(() => {
    const next: Theme = theme === 'day' ? 'night' : 'day'
    chosen.current = true
    setTheme(next)
    writeStored(next)
  }, [theme])

  return { theme, toggle }
}
