// ============================================================
// Раздел 7 git-тренажёра («Эффективная работа»): сопоставитель правил `.gitignore`.
//
// Чистые функции без состояния: на входе текст файла и путь, на выходе вердикт. Правила
// разбираются при каждой команде заново (target.md, часть IX, «Движок»: правила игнорирования —
// это содержимое файла `.gitignore` в рабочем каталоге, отдельно их не хранят).
//
// Что воспроизводится (сверено на наборах П7.1–П7.20, section7-git-runs.txt):
// - пустые строки и строки из пробелов пропускаются, но номер строки считается по файлу; `#` в
//   начале — комментарий; хвостовые пробелы отбрасываются (П7.15);
// - `\#` и `\!` в начале — буквальные `#` и `!` (П7.16); `!` в начале — исключение;
// - `/` в конце — только каталоги; `/` в начале или в середине привязывает шаблон к корню; без
//   `/` шаблон сверяется с именем на любом уровне (П7.2–П7.5, П7.10);
// - `*` — любые символы, кроме `/`; `?` — один символ; `[…]` — один символ из перечня (П7.13,
//   П7.14); `**/` в начале и `/**/` в середине — любое число каталогов, `/**` в конце — всё
//   внутри (П7.11, П7.12);
// - `[` без пары — шаблон ни с чем не совпадает, ошибки нет, следующие правила работают (П7.17);
// - путь проверяется сверху вниз по каталогам. Если игнорируется каталог на пути, игнорируется
//   всё внутри, и `!` для файла внутри его не вернёт (П7.8). Иначе к файлу применяется последнее
//   совпавшее правило (П7.6, П7.7).
//
// Правило «к отслеживаемым файлам (есть в индексе) правила не применяются» (П7.23) относится к
// состоянию репозитория, а не к правилам, поэтому здесь его нет: его проверяет вызывающий код.
//
// Классы символов: реализованы перечни, диапазоны, отрицание (`!` и `^`) и классы `[:alpha:]` …;
// прогонами из них сверены только перечни (П7.13, П7.14) — остальное следует документации
// wildmatch и в отчёте названо несверенным.
// ============================================================

/** Имя файла правил — так оно печатается в `git check-ignore -v` (П7.1: `.gitignore:1:*.log`). */
export const GITIGNORE_FILE = '.gitignore'

/** Одно правило файла `.gitignore`. */
export interface IgnoreRule {
  /** Номер строки в файле, с 1; считаются и пустые строки, и комментарии (П7.15). */
  line: number
  /** Шаблон так, как он напечатан в `check-ignore -v`: строка файла без хвостовых пробелов, со знаком `!`, `/` в начале и в конце. */
  source: string
  /** Правило с `!` в начале: снимает игнорирование. */
  negated: boolean
  /** `/` в конце шаблона: подходит только каталогам. */
  dirOnly: boolean
  /** Шаблон привязан к корню (есть `/` в начале или в середине) и сверяется с путём целиком, иначе — с именем. */
  anchored: boolean
  /**
   * Регулярное выражение шаблона; `null` — шаблон не разобран (непарная `[`, обрывающая `\`):
   * такое правило ни с чем не совпадает (П7.17).
   */
  regex: RegExp | null
}

/** Вердикт по одному файлу. */
export interface IgnoreVerdict {
  /** Файл игнорируется правилами (без учёта индекса). */
  ignored: boolean
  /**
   * Правило, которое решило дело, — то, что печатает `check-ignore -v`. Для файла внутри
   * игнорируемого каталога это правило каталога (П7.8). `null` — ни одно правило не совпало.
   * У правила с `negated` вердикт обратный: файл не игнорируется (П7.6).
   */
  rule: IgnoreRule | null
  /**
   * Путь, который назвал бы `git add` в отказе: сам файл либо самый верхний игнорируемый
   * каталог на пути (П7.22: `build` для `build/bundle.js`). `null`, если файл не игнорируется.
   */
  ignoredPath: string | null
  /**
   * Файл внутри игнорируемого каталога, к которому при этом подходит правило `!`: оно не
   * действует, пока игнорируется каталог (П7.8). Нужно речи тренажёра; в выводе git этого нет.
   */
  negationBlockedBy: IgnoreRule | null
}

// ---------- разбор шаблона ----------

const POSIX_CLASSES: Readonly<Record<string, string>> = {
  alpha: 'A-Za-z',
  digit: '0-9',
  alnum: 'A-Za-z0-9',
  upper: 'A-Z',
  lower: 'a-z',
  space: ' \\t\\n\\r\\f\\v',
  blank: ' \\t',
  punct: '!-\\/:-@\\[-`{-~',
  xdigit: '0-9A-Fa-f',
}

function escapeLiteral(ch: string): string {
  return /[\\^$.*+?()[\]{}|/-]/.test(ch) ? `\\${ch}` : ch
}

function escapeInClass(ch: string): string {
  return /[\\\]^[-]/.test(ch) ? `\\${ch}` : ch
}

/**
 * Разбирает `[…]` с позиции `start` (там стоит `[`). Возвращает регулярное выражение для
 * одного символа и индекс после `]`; `null`, если закрывающей `]` нет.
 */
function parseBracket(pattern: string, start: number): { source: string; next: number } | null {
  let i = start + 1
  let negate = false
  if (pattern[i] === '!' || pattern[i] === '^') {
    negate = true
    i++
  }
  let body = ''
  let first = true
  while (i < pattern.length) {
    const c = pattern[i]
    if (c === ']' && !first) {
      const cls = negate ? `[^/${body}]` : `(?!/)[${body}]`
      return { source: body === '' && !negate ? '(?!)' : cls, next: i + 1 }
    }
    first = false
    if (c === '[' && pattern[i + 1] === ':') {
      const close = pattern.indexOf(':]', i + 2)
      if (close > 0) {
        const name = pattern.slice(i + 2, close)
        const set = POSIX_CLASSES[name]
        if (set === undefined) return null
        body += set
        i = close + 2
        continue
      }
    }
    let lo = c
    if (c === '\\') {
      if (i + 1 >= pattern.length) return null
      lo = pattern[i + 1]
      i++
    }
    // диапазон `a-z`; `-` перед `]` — обычный символ
    if (pattern[i + 1] === '-' && i + 2 < pattern.length && pattern[i + 2] !== ']') {
      let hi = pattern[i + 2]
      let step = 3
      if (hi === '\\') {
        if (i + 3 >= pattern.length) return null
        hi = pattern[i + 3]
        step = 4
      }
      body += `${escapeInClass(lo)}-${escapeInClass(hi)}`
      i += step
      continue
    }
    body += escapeInClass(lo)
    i++
  }
  return null
}

/**
 * Шаблон (без `!` в начале, без `/` в конце, у привязанного — без `/` в начале) в регулярное
 * выражение. `null` — шаблон не разобран.
 */
function compilePattern(pattern: string, anchored: boolean): RegExp | null {
  let out = ''
  let i = 0
  const n = pattern.length
  while (i < n) {
    const c = pattern[i]
    if (c === '\\') {
      if (i + 1 >= n) return null
      out += escapeLiteral(pattern[i + 1])
      i += 2
      continue
    }
    if (c === '*') {
      let end = i
      while (end < n && pattern[end] === '*') end++
      const run = end - i
      const boundedLeft = i === 0 || pattern[i - 1] === '/'
      const boundedRight = end === n || pattern[end] === '/'
      if (anchored && run >= 2 && boundedLeft && boundedRight) {
        if (end === n) {
          out += '.*'
          i = end
        } else {
          out += '(?:.*/)?'
          i = end + 1
        }
        continue
      }
      out += '[^/]*'
      i = end
      continue
    }
    if (c === '?') {
      out += '[^/]'
      i++
      continue
    }
    if (c === '[') {
      const bracket = parseBracket(pattern, i)
      if (bracket === null) return null
      out += bracket.source
      i = bracket.next
      continue
    }
    out += escapeLiteral(c)
    i++
  }
  try {
    return new RegExp(`^${out}$`)
  } catch {
    return null
  }
}

/** Хвостовые пробелы отбрасываются, кроме экранированных обратной косой (`\ `). */
function trimTrailingSpaces(line: string): string {
  let end = line.length
  while (end > 0 && line[end - 1] === ' ' && line[end - 2] !== '\\') end--
  return line.slice(0, end)
}

/** Разбирает текст `.gitignore` в правила (в порядке файла). Ничего не бросает. */
export function parseGitignore(content: string): IgnoreRule[] {
  const rules: IgnoreRule[] = []
  const lines = content.split('\n')
  lines.forEach((raw, index) => {
    const source = trimTrailingSpaces(raw)
    if (source === '' || source.startsWith('#')) return
    let body = source
    const negated = body.startsWith('!')
    if (negated) body = body.slice(1)
    const dirOnly = body.endsWith('/')
    if (dirOnly) body = body.slice(0, -1)
    if (body === '') return
    const anchored = body.includes('/')
    if (body.startsWith('/')) body = body.slice(1)
    rules.push({ line: index + 1, source, negated, dirOnly, anchored, regex: compilePattern(body, anchored) })
  })
  return rules
}

// ---------- сопоставление ----------

/** Последнее правило, совпавшее с элементом пути (`rel` — путь от корня, `isDir` — это каталог); `null`, если таких нет. */
function lastMatch(rules: readonly IgnoreRule[], rel: string, isDir: boolean): IgnoreRule | null {
  const base = rel.slice(rel.lastIndexOf('/') + 1)
  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i]
    if (rule.regex === null) continue
    if (rule.dirOnly && !isDir) continue
    if (rule.regex.test(rule.anchored ? rel : base)) return rule
  }
  return null
}

/**
 * Вердикт по файлу `path` (путь от корня без `./` и без `/` в конце). Проход сверху вниз по
 * каталогам: игнорируемый каталог на пути решает дело сразу (П7.8), иначе действует последнее
 * совпавшее правило для самого файла (П7.6, П7.7).
 */
export function evaluatePath(rules: readonly IgnoreRule[], path: string): IgnoreVerdict {
  const parts = path.split('/')
  for (let depth = 1; depth < parts.length; depth++) {
    const dir = parts.slice(0, depth).join('/')
    const rule = lastMatch(rules, dir, true)
    if (rule !== null && !rule.negated) {
      const fileRule = lastMatch(rules, path, false)
      return { ignored: true, rule, ignoredPath: dir, negationBlockedBy: fileRule !== null && fileRule.negated ? fileRule : null }
    }
  }
  const rule = lastMatch(rules, path, false)
  if (rule === null) return { ignored: false, rule: null, ignoredPath: null, negationBlockedBy: null }
  if (rule.negated) return { ignored: false, rule, ignoredPath: null, negationBlockedBy: null }
  return { ignored: true, rule, ignoredPath: path, negationBlockedBy: null }
}
