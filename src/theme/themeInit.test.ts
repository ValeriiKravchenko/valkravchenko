import source from '../../public/theme-init.js?raw'
import { resolveTheme } from './resolveTheme'

interface Env {
  stored?: string | null
  dark?: boolean
  storageThrows?: boolean
  mediaThrows?: boolean
}

/** Runs public/theme-init.js against fake browser objects and returns the data-theme it set. */
function runInit({ stored = null, dark = false, storageThrows = false, mediaThrows = false }: Env) {
  const attributes: Record<string, string> = {}
  const localStorage = {
    getItem: (key: string) => {
      if (storageThrows) throw new Error('blocked')
      return key === 'sky-os.theme' ? stored : null
    },
  }
  const matchMedia = (query: string) => {
    if (mediaThrows) throw new Error('no media')
    return { matches: query.includes('dark') && dark }
  }
  const document = {
    documentElement: {
      setAttribute: (name: string, value: string) => {
        attributes[name] = value
      },
    },
  }
  new Function('localStorage', 'matchMedia', 'document', source)(localStorage, matchMedia, document)
  return attributes['data-theme']
}

describe('public/theme-init.js', () => {
  it.each([
    ['day', true, 'day'],
    ['night', false, 'night'],
  ])('uses the saved %s theme (system dark: %s)', (stored, dark, expected) => {
    expect(runInit({ stored, dark })).toBe(expected)
  })

  it('ignores garbage in storage and follows the system', () => {
    expect(runInit({ stored: 'purple', dark: false })).toBe('day')
    expect(runInit({ stored: 'purple', dark: true })).toBe('night')
  })

  it('follows the system when nothing is saved', () => {
    expect(runInit({ stored: null, dark: false })).toBe('day')
    expect(runInit({ stored: null, dark: true })).toBe('night')
  })

  it('does not break when storage throws', () => {
    expect(runInit({ storageThrows: true, dark: false })).toBe('day')
    expect(runInit({ storageThrows: true, dark: true })).toBe('night')
  })

  it('falls back to day when matchMedia throws', () => {
    expect(runInit({ mediaThrows: true })).toBe('day')
  })

  it('gives the same result as resolveTheme', () => {
    for (const stored of ['day', 'night', 'junk', null]) {
      for (const dark of [true, false]) {
        expect(runInit({ stored, dark })).toBe(resolveTheme(stored, dark))
      }
    }
  })
})
