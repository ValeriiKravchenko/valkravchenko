export type Theme = 'day' | 'night'

export const THEME_STORAGE_KEY = 'sky-os.theme'
export const DARK_QUERY = '(prefers-color-scheme: dark)'

export function isTheme(value: unknown): value is Theme {
  return value === 'day' || value === 'night'
}

/**
 * The saved choice wins when it is valid, otherwise follow the system.
 * Keep in sync with public/theme-init.js.
 */
export function resolveTheme(stored: string | null | undefined, prefersDark: boolean): Theme {
  if (isTheme(stored)) return stored
  return prefersDark ? 'night' : 'day'
}
