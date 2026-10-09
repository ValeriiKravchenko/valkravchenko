import { useCallback, useSyncExternalStore } from 'react'
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
  try {
    return typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null
  } catch {
    // matchMedia is unavailable or throws: behave as without it (day theme).
    return null
  }
}

function readInitial(): Theme {
  return resolveTheme(readStored(), systemMedia()?.matches ?? false)
}

function applyAttribute(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

/**
 * One theme store for the whole app (no provider needed). While at least one
 * component listens, the state lives here; with no listeners it is re-read
 * from storage and the system, so every mount starts from a clean slate.
 */
let current: Theme = 'day'
let chosen = false
let active = false
let media: MediaQueryList | null = null
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

function onSystemChange(event: MediaQueryListEvent): void {
  if (chosen) return
  current = resolveTheme(null, event.matches)
  applyAttribute(current)
  emit()
}

function start(): void {
  current = readInitial()
  chosen = isTheme(readStored())
  active = true
  applyAttribute(current)
  media = systemMedia()
  media?.addEventListener('change', onSystemChange)
}

function stop(): void {
  media?.removeEventListener('change', onSystemChange)
  media = null
  active = false
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) start()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) stop()
  }
}

function getSnapshot(): Theme {
  return active ? current : readInitial()
}

function setThemeValue(next: Theme): void {
  chosen = true
  current = next
  applyAttribute(next)
  writeStored(next)
  emit()
}

export interface UseTheme {
  theme: Theme
  toggle: () => void
  /** Explicit choice of a theme (the window menu). */
  setTheme: (theme: Theme) => void
}

/**
 * Current theme, a toggle and an explicit setter. Until the visitor picks a
 * theme the hook follows the system one; after that the choice is kept in storage.
 * All callers share one state.
 */
export function useTheme(): UseTheme {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => 'day' as Theme)

  const toggle = useCallback(() => {
    setThemeValue(getSnapshot() === 'day' ? 'night' : 'day')
  }, [])

  const setTheme = useCallback((next: Theme) => setThemeValue(next), [])

  return { theme, toggle, setTheme }
}
