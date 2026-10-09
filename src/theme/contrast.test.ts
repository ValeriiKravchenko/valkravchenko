/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// The CSS plugin is off in tests, so `?raw` would be empty: read the file directly.
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

type Rgb = [number, number, number]
type Rgba = [number, number, number, number]
type Tokens = Record<string, string>

/** Reads custom properties per rule from the stylesheet (comments removed). */
function readRules(source: string): { selector: string; vars: Tokens }[] {
  const plain = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: { selector: string; vars: Tokens }[] = []
  for (const match of plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const vars: Tokens = {}
    for (const decl of match[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      vars[decl[1].slice(2)] = decl[2].trim()
    }
    if (Object.keys(vars).length > 0) rules.push({ selector: match[1].split(';').pop()!.trim(), vars })
  }
  return rules
}

const rules = readRules(css)
const common = rules.find((rule) => rule.selector === ':root')!.vars
const themes: Record<'day' | 'night', Tokens> = {
  day: { ...common, ...rules.find((r) => r.selector.includes('[data-theme="day"]'))!.vars },
  night: { ...common, ...rules.find((r) => r.selector === ':root[data-theme="night"]')!.vars },
}

function parseColor(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
  }
  const rgba = /^rgba?\(([^)]+)\)$/.exec(value)
  if (rgba) {
    const [r, g, b, a = '1'] = rgba[1].split(',').map((part) => part.trim())
    return [Number(r), Number(g), Number(b), Number(a)]
  }
  throw new Error(`Cannot parse color: ${value}`)
}

function channel(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function ratio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Mixes a translucent color over an opaque backdrop. */
function over([r, g, b, a]: Rgba, backdrop: Rgb): Rgb {
  return [r * a + backdrop[0] * (1 - a), g * a + backdrop[1] * (1 - a), b * a + backdrop[2] * (1 - a)]
}

const DESK = ['desk-1', 'desk-2', 'desk-3']

/** Day: translucent surfaces sit on the lightest desk color; night: on the darkest. */
function backdrop(theme: 'day' | 'night'): Rgb {
  const colors = DESK.map((name) => parseColor(themes[theme][name]).slice(0, 3) as Rgb)
  const sorted = [...colors].sort((a, b) => luminance(a) - luminance(b))
  return theme === 'day' ? sorted[sorted.length - 1] : sorted[0]
}

function solid(theme: 'day' | 'night', name: string): Rgb {
  return over(parseColor(themes[theme][name]), backdrop(theme))
}

const MIN = 4.5

// [text token, background token(s)]
const PAIRS: [string, string][] = [
  ['bar-ink', 'bar'],
  ['bar-muted', 'bar'],
  ['logo', 'bar'],
  ['bar-ink', 'toggle'],
  ['ink', 'window'],
  ['muted', 'window'],
  ['title-ink', 'title-from'],
  ['title-ink', 'title-to'],
  ['window-menu', 'title-from'],
  ['window-menu', 'title-to'],
  ['on-accent', 'accent'],
  ['on-accent', 'accent-hover'],
  ['accent', 'window'],
  ['accent-hover', 'window'],
  ['accent', 'accent-soft'],
  ['accent', 'chip'],
  ['muted', 'chip'],
  ['accent', 'chip-line'],
  ['teal', 'window'],
  ['term-ink', 'term'],
  ['term-prompt', 'term'],
  ['term-dim', 'term'],
  ['accent', 'tile'],
  ['label-ink', 'label-bg'],
  ['bar-ink', 'desk-1'],
  ['bar-ink', 'desk-2'],
  ['bar-ink', 'desk-3'],
]

describe('theme contrast (WCAG)', () => {
  it('reads both themes from the stylesheet', () => {
    expect(themes.day.bar).toBe('rgba(255, 255, 255, 0.86)')
    expect(themes.night.bar).toBe('#081c2e')
    expect(themes.day['bar-ink']).not.toBe(themes.night['bar-ink'])
  })

  for (const theme of ['day', 'night'] as const) {
    describe(theme, () => {
      it.each(PAIRS)('%s on %s is at least 4.5:1', (fg, bg) => {
        const value = ratio(solid(theme, fg), solid(theme, bg))
        expect(value, `${fg} on ${bg} = ${value.toFixed(2)}`).toBeGreaterThanOrEqual(MIN)
      })
    })
  }

  // Focus ring and the active dot sit on the dock. The dock may be translucent,
  // so check them on every surface that can be under it: the desk colors and a window.
  describe('dock focus ring and active dot (non-text, 3:1)', () => {
    const NON_TEXT_MIN = 3
    const underlays = [...DESK, 'window']
    const surfaces = (theme: 'day' | 'night') =>
      underlays.map((name) => ({
        name,
        color: over(parseColor(themes[theme].dock), parseColor(themes[theme][name]).slice(0, 3) as Rgb),
      }))

    for (const theme of ['day', 'night'] as const) {
      it.each([
        ['focus-outer', 'focus ring'],
        ['logo', 'active dot'],
      ])(`${theme}: %s (%s) on the dock over every underlay`, (token) => {
        const fg = parseColor(themes[theme][token]).slice(0, 3) as Rgb
        for (const { name, color } of surfaces(theme)) {
          const value = ratio(fg, color)
          expect(value, `${token} on dock over ${name} = ${value.toFixed(2)}`).toBeGreaterThanOrEqual(NON_TEXT_MIN)
        }
      })
    }

    it('the night dock does not let a white window through', () => {
      const alpha = parseColor(themes.night.dock)[3]
      expect(alpha).toBeGreaterThanOrEqual(0.95)
    })
  })

  it('the contrast helper is correct on known values', () => {
    expect(ratio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5)
    expect(ratio([255, 255, 255], [255, 255, 255])).toBeCloseTo(1, 5)
  })
})
