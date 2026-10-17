// ============================================================
// Раздел 8 git-тренажёра: чистые помощники над именами ссылок. Порядок байтов, допустимость
// имени (правила check-ref-format, сверено прогонами П8.2 и П8.27–П8.28) и маска имён
// (`git tag -l <маска>`, раскрытие `*` шеллом). Состояния нет.
// ============================================================

const encoder = new TextEncoder()

/** Сравнение по байтам UTF-8, как сортирует имена ссылок git (не по кодовым единицам UTF-16). */
export function compareBytes(a: string, b: string): number {
  const x = encoder.encode(a)
  const y = encoder.encode(b)
  const n = Math.min(x.length, y.length)
  for (let i = 0; i < n; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1
  return x.length - y.length
}

/** Имена в порядке байтов, по возрастанию. */
export function sortBytes(names: readonly string[]): string[] {
  return [...names].sort(compareBytes)
}

const FORBIDDEN_CHARS = ' ~^:?*[\\'

/**
 * Имя ссылки допустимо по правилам git (git-check-ref-format): не пустое, без `..`, `@{`, `//`,
 * пробела, управляющих знаков и знаков `~ ^ : ? * [ \`, не начинается и не кончается на `/`, не
 * кончается на `.`, ни одна часть между `/` не начинается с `.` и не кончается на `.lock`.
 * Сверено прогонами: `a b`, `v1..2`, `x~1`, `v1.lock`, `a:b`, пустое имя, `.x`, `x.`, `x/`,
 * `/x`, `a//b`, `a@{1}`, `a^b`, `a?b`, `a[b` (П8.28), `x.lock` (П8.27). Правила, отличающие ветку
 * от тега (`HEAD`, начало с `-`), здесь не проверяются.
 */
export function isValidRefName(name: string): boolean {
  if (name === '') return false
  if (name.includes('..') || name.includes('@{') || name.includes('//')) return false
  if (name.startsWith('/') || name.endsWith('/') || name.endsWith('.')) return false
  for (const ch of name) {
    const code = ch.codePointAt(0) as number
    if (code <= 0x20 || code === 0x7f || FORBIDDEN_CHARS.includes(ch)) return false
  }
  return name.split('/').every((part) => !part.startsWith('.') && !part.endsWith('.lock'))
}

/** Допустимое имя тега: правила ссылок и не `HEAD`, не начинается с `-` (П8.2, П8.28). */
export function isValidTagName(name: string): boolean {
  return isValidRefName(name) && name !== 'HEAD' && !name.startsWith('-')
}

/** Допустимое имя ветки: правила ссылок и не `HEAD`, не начинается с `-` (П8.27). */
export function isValidBranchName(name: string): boolean {
  return isValidRefName(name) && name !== 'HEAD' && !name.startsWith('-')
}

// ---------- маска ----------

type GlobPart = { kind: 'literal'; ch: string } | { kind: 'any' } | { kind: 'one' } | { kind: 'class'; negated: boolean; items: readonly (string | [string, string])[] }

function parseClass(chars: readonly string[], start: number): { part: GlobPart; next: number } | null {
  let i = start + 1
  let negated = false
  if (chars[i] === '!' || chars[i] === '^') {
    negated = true
    i++
  }
  const items: (string | [string, string])[] = []
  let first = true
  while (i < chars.length) {
    const ch = chars[i]
    if (ch === ']' && !first) return { part: { kind: 'class', negated, items }, next: i + 1 }
    // Классы вида [:alpha:] и экранирование не разбираются.
    if (ch === '\\' || (ch === '[' && chars[i + 1] === ':')) return null
    first = false
    if (chars[i + 1] === '-' && i + 2 < chars.length && chars[i + 2] !== ']') {
      items.push([ch, chars[i + 2]])
      i += 3
    } else {
      items.push(ch)
      i++
    }
  }
  return null
}

function parseGlob(pattern: string): GlobPart[] | null {
  const chars = Array.from(pattern)
  const parts: GlobPart[] = []
  let i = 0
  while (i < chars.length) {
    const ch = chars[i]
    if (ch === '\\') return null
    if (ch === '*') {
      parts.push({ kind: 'any' })
      i++
    } else if (ch === '?') {
      parts.push({ kind: 'one' })
      i++
    } else if (ch === '[') {
      const parsed = parseClass(chars, i)
      if (parsed === null) return null
      parts.push(parsed.part)
      i = parsed.next
    } else {
      parts.push({ kind: 'literal', ch })
      i++
    }
  }
  return parts
}

function classMatches(part: Extract<GlobPart, { kind: 'class' }>, ch: string): boolean {
  const hit = part.items.some((item) => (typeof item === 'string' ? item === ch : item[0] <= ch && ch <= item[1]))
  return hit !== part.negated
}

/**
 * Совпадает ли имя с маской. `*` — любая последовательность (в том числе пустая и с `/`), `?` —
 * один знак, `[…]` — класс со знаком `!` или `^` для отрицания и диапазонами. `null`, если в
 * маске есть то, что модуль не разбирает: обратная косая и классы вида `[:alpha:]`.
 * `hiddenLiteral` — правило раскрытия имён шеллом: имя с точки в начале совпадает, только если
 * точка стоит в маске буквально.
 */
export function globMatches(pattern: string, text: string, options: { hiddenLiteral?: boolean } = {}): boolean | null {
  const parts = parseGlob(pattern)
  if (parts === null) return null
  const chars = Array.from(text)
  if (options.hiddenLiteral && chars[0] === '.' && !(parts[0]?.kind === 'literal' && parts[0].ch === '.')) return false
  const memo = new Map<number, boolean>()
  const walk = (pi: number, ti: number): boolean => {
    const key = pi * (chars.length + 1) + ti
    const cached = memo.get(key)
    if (cached !== undefined) return cached
    let result: boolean
    if (pi === parts.length) {
      result = ti === chars.length
    } else {
      const part = parts[pi]
      if (part.kind === 'any') result = walk(pi + 1, ti) || (ti < chars.length && walk(pi, ti + 1))
      else if (ti >= chars.length) result = false
      else if (part.kind === 'one') result = walk(pi + 1, ti + 1)
      else if (part.kind === 'literal') result = part.ch === chars[ti] && walk(pi + 1, ti + 1)
      else result = classMatches(part, chars[ti]) && walk(pi + 1, ti + 1)
    }
    memo.set(key, result)
    return result
  }
  return walk(0, 0)
}
