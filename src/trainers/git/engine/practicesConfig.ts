// ============================================================
// Раздел 7 git-тренажёра: `git config` для ключей `alias.<имя>` (target.md, часть IX, «Что входит»,
// места 13–17; прогон П7.25 в docs/git-trainer/reports/section7-git-runs.txt).
//
// Модель: два упорядоченных списка «ключ → значение» — `~/.gitconfig` (global) и `.git/config`
// (local). Повторная запись ключа меняет значение на месте (П7.25: `alias.lg` остался первым).
//
// Воспроизводятся только формы, сверенные прогонами; всё остальное получает честный отказ области
// (часть III, правило 1) без кода возврата. Строки `error: …`, `usage: …` — буквальный вывод git
// 2.53.0 из протокола, не переводятся (часть III, правило 2); речь тренажёра — в ru.practices.
//
// Поправки g18b3 (section7-config-alias-fixes-git-runs.txt, П7.60–П7.80): опции читаются только до первого слова,
// остальные слова — значение и шаблон значения (POSIX ERE); имя алиаса без учёта регистра, имя в файле как набрано;
// --get-regexp: шаблон в нижнем регистре, POSIX ERE; пустое значение читается как одна пустая строка; классы ключей
// (`invalid key`, `key does not contain variable name`); удаление без --global — это .git/config.
//
// Формы:
//   запись   git config [--global] alias.<имя> <значение> [<шаблон значения>];  git config set --global alias.<имя> <значение>
//   чтение   git config --global alias.<имя>;  --get [<шаблон значения>];  git config get --global alias.<имя>
//   regexp   git config --global --get-regexp <шаблон>
//   список   git config --global --list | -l;  git config list --global
//   удаление git config [--global] --unset alias.<имя> [<шаблон значения>];  git config unset [--global] alias.<имя>
// ============================================================
import type { ConfigEntry, PracticesState } from './practicesTypes'
import { exited, refuse, type Outcome } from './practicesOutcome'
import { isRealGitCommand } from './practicesScope'
import { ru } from '../locales/ru'

const pc = ru.practices.config
const pcx = ru.practices.explain

export type ConfigScope = 'global' | 'local'

/**
 * Имя алиаса, которое git принимает: латинская буква, затем буквы, цифры и дефис (`st`, `ST`, `st-short`, `x-`,
 * `A-1`). Регистр не важен: имя в ключе читается без учёта регистра (П7.60 и далее, section7-config-alias-fixes-git-runs.txt:
 * П7.67, П7.69, П7.80). Остальное git отвергает как `invalid key` (П7.79).
 */
const ALIAS_NAME = /^[A-Za-z][A-Za-z0-9-]*$/

/** Буквальный usage git 2.53.0 на неизвестную длинную опцию (П7.25, `git config --global --foo`, section7-git-runs.txt:1232–1291). */
const CONFIG_USAGE_LINES = [
  'usage: git config list [<file-option>] [<display-option>] [--includes]',
  '   or: git config get [<file-option>] [<display-option>] [--includes] [--all] [--regexp] [--value=<pattern>] [--fixed-value] [--default=<default>] [--url=<url>] <name>',
  '   or: git config set [<file-option>] [--type=<type>] [--all] [--value=<pattern>] [--fixed-value] <name> <value>',
  '   or: git config unset [<file-option>] [--all] [--value=<pattern>] [--fixed-value] <name>',
  '   or: git config rename-section [<file-option>] <old-name> <new-name>',
  '   or: git config remove-section [<file-option>] <name>',
  '   or: git config edit [<file-option>]',
  '   or: git config [<file-option>] --get-colorbool <name> [<stdout-is-tty>]',
  '',
  'Config file location',
  '    --[no-]global         use global config file',
  '    --[no-]system         use system config file',
  '    --[no-]local          use repository config file',
  '    --[no-]worktree       use per-worktree config file',
  '    -f, --[no-]file <file>',
  '                          use given config file',
  '    --[no-]blob <blob-id> read config from given blob object',
  '',
  'Action',
  '    --get                 get value: name [<value-pattern>]',
  '    --get-all             get all values: key [<value-pattern>]',
  '    --get-regexp          get values for regexp: name-regex [<value-pattern>]',
  '    --get-urlmatch        get value specific for the URL: section[.var] URL',
  '    --replace-all         replace all matching variables: name value [<value-pattern>]',
  '    --add                 add a new variable: name value',
  '    --unset               remove a variable: name [<value-pattern>]',
  '    --unset-all           remove all matches: name [<value-pattern>]',
  '    --rename-section      rename section: old-name new-name',
  '    --remove-section      remove a section: name',
  '    -l, --list            list all',
  '    -e, --edit            open an editor',
  '    --get-color           find the color configured: slot [<default>]',
  '    --get-colorbool       find the color setting: slot [<stdout-is-tty>]',
  '',
  'Display options',
  '    -z, --[no-]null       terminate values with NUL byte',
  '    --[no-]name-only      show variable names only',
  '    --[no-]show-origin    show origin of config (file, standard input, blob, command line)',
  '    --[no-]show-scope     show scope of config (worktree, local, global, system, command)',
  '    --[no-]show-names     show config keys in addition to their values',
  '',
  'Type',
  '    -t, --[no-]type <type>',
  '                          value is given this type',
  '    --bool                value is "true" or "false"',
  '    --int                 value is decimal number',
  '    --bool-or-int         value is --bool or --int',
  '    --bool-or-str         value is --bool or string',
  '    --path                value is a path (file or directory name)',
  '    --expiry-date         value is an expiry date',
  '',
  'Other',
  '    --[no-]default <value>',
  '                          with --get, use default value when missing entry',
  '    --[no-]comment <value>',
  '                          human-readable comment string (# will be prepended as needed)',
  '    --[no-]fixed-value    use string equality when comparing values to value pattern',
  '    --[no-]includes       respect include directives on lookup',
]

/** Длинные опции из usage П7.25: настоящие, но в разделе не разбираются (и их сокращения тоже). */
const KNOWN_LONG_OPTIONS = [
  'global', 'system', 'local', 'worktree', 'file', 'blob', 'get', 'get-all', 'get-regexp', 'get-urlmatch', 'replace-all', 'add',
  'unset', 'unset-all', 'rename-section', 'remove-section', 'list', 'edit', 'get-color', 'get-colorbool', 'null', 'name-only',
  'show-origin', 'show-scope', 'show-names', 'type', 'bool', 'int', 'bool-or-int', 'bool-or-str', 'path', 'expiry-date', 'default',
  'comment', 'fixed-value', 'includes', 'all', 'regexp', 'value', 'url', 'help',
]

/** Настоящая ли это длинная опция (или её начало): да — отказ области, нет — `unknown option` с usage. */
function isKnownLongOption(name: string): boolean {
  return KNOWN_LONG_OPTIONS.some((o) => o.startsWith(name) || `no-${o}`.startsWith(name))
}

const SUPPORTED_SUBCOMMANDS = ['get', 'set', 'unset', 'list'] as const
type Subcommand = (typeof SUPPORTED_SUBCOMMANDS)[number]
const OTHER_SUBCOMMANDS = ['rename-section', 'remove-section', 'edit']

// ---------- модель конфигов ----------

export function configEntries(state: PracticesState, scope: ConfigScope): ConfigEntry[] {
  return scope === 'global' ? state.globalConfig : state.localConfig
}

function withEntries(state: PracticesState, scope: ConfigScope, entries: ConfigEntry[]): PracticesState {
  return scope === 'global' ? { ...state, globalConfig: entries } : { ...state, localConfig: entries }
}

/** Один и тот же ключ: имя в ключе читается без учёта регистра (П7.67). */
export function sameConfigKey(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * Запись ключа: новая — в конец, существующая — значение меняется на месте, а имя в файле становится таким,
 * как набрано (П7.67: `alias.St log` заменила `st = status` на `St = log`; П7.69).
 */
export function setConfigEntry(entries: readonly ConfigEntry[], key: string, value: string): ConfigEntry[] {
  return entries.some((e) => sameConfigKey(e.key, key)) ? entries.map((e) => (sameConfigKey(e.key, key) ? { key, value } : e)) : [...entries, { key, value }]
}

/**
 * Текст файла конфига, как его печатает `cat` (П7.25): секции по порядку, запись `\t<имя> = <значение>`.
 * Пустое значение — `q = ` (с пробелом), значение с пробелами по краям — в кавычках: `q2 = "  "`.
 * Секция `[core]` в локальном конфиге стоит первой и в список не входит (`withCore`).
 */
export function formatConfigFile(entries: readonly ConfigEntry[], withCore: boolean): string {
  const lines: string[] = []
  if (withCore) lines.push('[core]', '\trepositoryformatversion = 0', '\tfilemode = true', '\tbare = false', '\tlogallrefupdates = true')
  if (entries.length > 0) {
    lines.push('[alias]')
    for (const e of entries) {
      const name = e.key.slice('alias.'.length)
      const quoted = e.value !== e.value.trim()
      lines.push(`\t${name} = ${quoted ? `"${e.value}"` : e.value}`)
    }
  }
  return lines.length === 0 ? '' : `${lines.join('\n')}\n`
}

export type AliasLookup = { kind: 'none' } | { kind: 'ambiguous' } | { kind: 'found'; value: string; scope: ConfigScope }

/** Где записан алиас; имя ищется без учёта регистра (П7.68: `git ST` при `alias.st`). Одно имя в обоих конфигах — отдельный случай: прогонами не сверен (target.md, «Что НЕ входит»). */
export function lookupAlias(state: PracticesState, name: string): AliasLookup {
  const key = `alias.${name}`
  const inGlobal = state.globalConfig.find((e) => sameConfigKey(e.key, key))
  const inLocal = state.localConfig.find((e) => sameConfigKey(e.key, key))
  if (inGlobal && inLocal) return { kind: 'ambiguous' }
  if (inGlobal) return { kind: 'found', value: inGlobal.value, scope: 'global' }
  if (inLocal) return { kind: 'found', value: inLocal.value, scope: 'local' }
  return { kind: 'none' }
}

// ---------- ключ ----------

type KeyCheck =
  | { kind: 'ok'; name: string }
  | { kind: 'invalid' }
  | { kind: 'noVariable' }
  | { kind: 'subsection' }
  | { kind: 'other' }

/**
 * `ok` — `alias.<имя>`; `invalid` — git отвечает `error: invalid key` (П7.79: `_`, `@`, `/`, пробел, `!`, не-ASCII,
 * цифра или дефис в начале); `noVariable` — `alias.` без имени (П7.79); `subsection` — точка в имени
 * (`alias.a.b` это секция `[alias "a"]`, П7.80, в разделе не разбирается); `other` — любой другой ключ.
 */
function checkAliasKey(key: string): KeyCheck {
  if (!key.startsWith('alias.')) return { kind: 'other' }
  const name = key.slice('alias.'.length)
  if (name === '') return { kind: 'noVariable' }
  if (name.includes('.')) return { kind: 'subsection' }
  return ALIAS_NAME.test(name) ? { kind: 'ok', name } : { kind: 'invalid' }
}

/** Ответ git на плохой ключ или отказ области. `noVariableCode`: чтение 1, запись и удаление 2 (П7.79). */
function keyProblem(state: PracticesState, key: string, check: Exclude<KeyCheck, { kind: 'ok' }>, noVariableCode: number): Outcome {
  if (check.kind === 'invalid') return exited(state, `error: invalid key: ${key}`, 1, pc.invalidKeyNote)
  if (check.kind === 'noVariable') return exited(state, `error: key does not contain variable name: ${key}`, noVariableCode, pc.noVariableNote)
  return refuse(state, check.kind === 'subsection' ? pc.keySubsection(key) : pc.keyOutOfScope(key))
}

// ---------- POSIX ERE → RegExp ----------

type PatternResult = { kind: 'ok'; regexp: RegExp } | { kind: 'invalid' } | { kind: 'unsupported' }

class EreFailure extends Error {
  failure: 'invalid' | 'unsupported'
  constructor(failure: 'invalid' | 'unsupported') {
    super(failure)
    this.failure = failure
  }
}

/** Классы `[[:имя:]]`, сверенные прогонами (П7.71). */
const POSIX_CLASSES: Record<string, string> = {
  alpha: 'a-zA-Z',
  digit: '0-9',
  alnum: 'a-zA-Z0-9',
  lower: 'a-z',
  upper: 'A-Z',
  space: ' \\t\\n\\v\\f\\r',
  punct: '!-\\/:-@\\[-`{-~',
}
const UNVERIFIED_CLASSES = ['blank', 'cntrl', 'graph', 'print', 'xdigit']
const MAX_INTERVAL = 255

const escapeLiteral = (c: string) => c.replace(/[\\^$.*+?()[\]{}|/-]/g, '\\$&')
const escapeInClass = (c: string) => c.replace(/[\\\][^-]/g, '\\$&')

/**
 * Переводит POSIX ERE (glibc) в RegExp для проверки «есть ли совпадение». `invalid` — git отвечает ошибкой шаблона
 * (П7.71: `*a`, `+a`, `?a`, `(`, `[`, `a{2`, `a{2,1}`, `a{}`, `[z-a]`, `^*`, `st\`); `unsupported` — конструкция, которой
 * прогоны не покрывают (`\b`, `\<`, обратные ссылки, `[.x.]`, `[=x=]`, П7.72): честный отказ области.
 */
export function compileEre(pattern: string): PatternResult {
  let i = 0
  const n = pattern.length
  const fail = (kind: 'invalid' | 'unsupported'): never => {
    throw new EreFailure(kind)
  }

  function parseInterval(): string {
    const m = /^\{(\d*)(,?)(\d*)\}/.exec(pattern.slice(i))
    if (!m) return fail('invalid')
    const [whole, lo, comma, hi] = m
    if (lo === '' && comma === '') return fail('invalid')
    const min = lo === '' ? 0 : Number(lo)
    const max = hi === '' ? null : Number(hi)
    if (min > MAX_INTERVAL || (max !== null && max > MAX_INTERVAL)) return fail('unsupported')
    if (max !== null && min > max) return fail('invalid')
    i += whole.length
    if (comma === '') return `{${min}}`
    return max === null ? `{${min},}` : `{${min},${max}}`
  }

  function parseBracket(): string {
    let negate = false
    if (pattern[i] === '^') {
      negate = true
      i++
    }
    const rangeFollows = () => pattern[i] === '-' && i + 1 < n && pattern[i + 1] !== ']'
    let items = ''
    let first = true
    for (;;) {
      if (i >= n) return fail('invalid')
      const ch = pattern[i]
      if (ch === ']' && !first) {
        i++
        break
      }
      first = false
      if (ch === '[' && pattern[i + 1] === ':') {
        const end = pattern.indexOf(':]', i + 2)
        if (end < 0) return fail('invalid')
        const name = pattern.slice(i + 2, end)
        if (UNVERIFIED_CLASSES.includes(name)) return fail('unsupported')
        if (!Object.hasOwn(POSIX_CLASSES, name)) return fail('invalid')
        items += POSIX_CLASSES[name]
        i = end + 2
        if (rangeFollows()) return fail('invalid')
        continue
      }
      if (ch === '[' && (pattern[i + 1] === '.' || pattern[i + 1] === '=')) return fail('unsupported')
      i++
      if (rangeFollows()) {
        const hi = pattern[i + 1]
        if (hi === '[' && /[:.=]/.test(pattern[i + 2] ?? '')) return fail('unsupported')
        i += 2
        if (hi < ch) return fail('invalid')
        items += `${escapeInClass(ch)}-${escapeInClass(hi)}`
        if (rangeFollows()) return fail('invalid')
      } else {
        items += escapeInClass(ch)
      }
    }
    return `[${negate ? '^' : ''}${items}]`
  }

  interface Piece {
    kind: 'atom' | 'caret' | 'dollar'
    text: string
  }

  function parseBranch(depth: number): string {
    const pieces: Piece[] = []
    while (i < n) {
      const c = pattern[i]
      if (c === '|' || (c === ')' && depth > 0)) break
      i++
      if (c === '*' || c === '+' || c === '?' || c === '{') {
        const last = pieces[pieces.length - 1]
        if (last === undefined || last.kind === 'caret') return fail('invalid')
        if (last.kind === 'dollar') return fail('unsupported')
        let quantifier = c
        if (c === '{') {
          i--
          quantifier = parseInterval()
        }
        last.text = `(?:${last.text})${quantifier}`
      } else if (c === '^') pieces.push({ kind: 'caret', text: '^' })
      else if (c === '$') pieces.push({ kind: 'dollar', text: '$' })
      else if (c === '(') {
        const inner = parseExpr(depth + 1)
        if (pattern[i] !== ')') return fail('invalid')
        i++
        pieces.push({ kind: 'atom', text: `(?:${inner})` })
      } else if (c === '.') pieces.push({ kind: 'atom', text: '.' })
      else if (c === '[') pieces.push({ kind: 'atom', text: parseBracket() })
      else if (c === '\\') {
        if (i >= n) return fail('invalid')
        const e = pattern[i++]
        if (/[wWsS]/.test(e)) pieces.push({ kind: 'atom', text: `\\${e}` })
        else if (/[0-9bB<>`']/.test(e)) return fail('unsupported')
        else pieces.push({ kind: 'atom', text: escapeLiteral(e) })
      } else if (c === '}') return fail('unsupported')
      else pieces.push({ kind: 'atom', text: escapeLiteral(c) })
    }
    return pieces.map((p) => p.text).join('')
  }

  function parseExpr(depth: number): string {
    const branches = [parseBranch(depth)]
    while (pattern[i] === '|') {
      i++
      branches.push(parseBranch(depth))
    }
    return branches.join('|')
  }

  try {
    return { kind: 'ok', regexp: new RegExp(parseExpr(0)) }
  } catch (e) {
    return e instanceof EreFailure ? { kind: e.failure } : { kind: 'unsupported' }
  }
}

/** Шаблон значения (`--get`, `--unset`, третье слово записи): регистр важен; `!` в начале (отрицание) не разбирается. */
function compileValuePattern(state: PracticesState, pattern: string): { ok: true; regexp: RegExp } | { ok: false; outcome: Outcome } {
  if (pattern.startsWith('!')) return { ok: false, outcome: refuse(state, pc.valuePatternForm(pattern)) }
  const compiled = compileEre(pattern)
  // П7.65, П7.62: `error: invalid pattern: [`, код 6 (и при чтении, и при удалении, и при записи).
  if (compiled.kind === 'invalid') return { ok: false, outcome: exited(state, `error: invalid pattern: ${pattern}`, 6) }
  if (compiled.kind === 'unsupported') return { ok: false, outcome: refuse(state, pc.valuePatternForm(pattern)) }
  return { ok: true, regexp: compiled.regexp }
}

// ---------- разбор команды ----------

interface ParsedConfig {
  sub: Subcommand | null
  global: boolean
  action: 'get' | 'getRegexp' | 'unset' | 'list' | null
  positionals: string[]
}

type ParseResult = { kind: 'parsed'; parsed: ParsedConfig } | { kind: 'unknownOption'; option: string } | { kind: 'refused'; form: string }

/**
 * Git читает опции только до первого слова, которое не опция; всё дальше — слова (П7.60, П7.61, П7.65:
 * `alias.st --unset` пишет значение `--unset`). Это верно и после подкоманды (`set`, `get`, `unset`, `list`).
 */
function parseConfigArgs(args: readonly string[]): ParseResult {
  let rest = args
  let sub: Subcommand | null = null
  if (args.length > 0 && (SUPPORTED_SUBCOMMANDS as readonly string[]).includes(args[0])) {
    sub = args[0] as Subcommand
    rest = args.slice(1)
  } else if (args.length > 0 && OTHER_SUBCOMMANDS.includes(args[0])) {
    return { kind: 'refused', form: args[0] }
  }

  const flags: { global: boolean; action: ParsedConfig['action'] } = { global: false, action: null }
  const positionals: string[] = []
  let unknownOption: string | null = null
  let refusedForm: string | null = null
  const setAction = (next: NonNullable<ParsedConfig['action']>, arg: string) => {
    if (flags.action !== null) refusedForm ??= arg
    flags.action = next
  }
  for (const arg of rest) {
    if (positionals.length > 0) positionals.push(arg)
    else if (arg === '--global') {
      if (flags.global) refusedForm ??= arg
      flags.global = true
    } else if (arg === '--get') setAction('get', arg)
    else if (arg === '--get-regexp') setAction('getRegexp', arg)
    else if (arg === '--unset') setAction('unset', arg)
    else if (arg === '--list' || arg === '-l') setAction('list', arg)
    else if (arg === '--') refusedForm ??= arg
    else if (arg.startsWith('--')) {
      // `--foo=bar` прогонами не сверен: форма с `=` всегда отказ.
      if (arg.includes('=') || isKnownLongOption(arg.slice(2))) refusedForm ??= arg
      else unknownOption ??= arg.slice(2)
    } else if (arg.startsWith('-') && arg.length > 1) refusedForm ??= arg
    else positionals.push(arg)
  }
  // Неизвестную длинную опцию git обнаруживает при разборе опций, раньше любого смысла команды.
  if (unknownOption !== null && sub === null) return { kind: 'unknownOption', option: unknownOption }
  if (unknownOption !== null) return { kind: 'refused', form: `--${unknownOption}` }
  if (refusedForm !== null) return { kind: 'refused', form: refusedForm }
  if (sub !== null && flags.action !== null) return { kind: 'refused', form: `${sub} --${flags.action}` }
  return { kind: 'parsed', parsed: { sub, global: flags.global, action: flags.action, positionals } }
}

// ---------- обработчики ----------

/** Значение, которое раздел записывает: без кавычек и обратной косой черты внутри (target.md, «Что НЕ входит»). */
function valueSupported(value: string): boolean {
  return !/["'\\]/.test(value)
}

/** Запись; `pattern` — третье слово (шаблон значения, П7.62). */
function handleWrite(state: PracticesState, scope: ConfigScope, key: string, value: string, pattern?: string): Outcome {
  const check = checkAliasKey(key)
  if (check.kind !== 'ok') return keyProblem(state, key, check, 2)
  if (!valueSupported(value)) return refuse(state, pc.valueForm(value))
  if (pattern !== undefined) {
    const compiled = compileValuePattern(state, pattern)
    if (!compiled.ok) return compiled.outcome
    // П7.63: при существующем ключе git дописывает второе значение или заменяет подходящее — в модели такого нет.
    if (configEntries(state, scope).some((e) => sameConfigKey(e.key, key))) return refuse(state, pc.patternExisting(key))
  }
  const next = withEntries(state, scope, setConfigEntry(configEntries(state, scope), key, value))
  const note = pattern === undefined ? '' : ` ${pcx.valuePatternIgnored(pattern)}`
  return exited(next, '', 0, `${writeExplanation(scope, key, check.name, value)}${note}`)
}

/** Речь тренажёра после записи: куда попала запись и что с ней будет при вызове (места 14, 15, 17, 18). */
function writeExplanation(scope: ConfigScope, key: string, name: string, value: string): string {
  const parts = [scope === 'global' ? pcx.writtenGlobal(key) : pcx.writtenLocal(key)]
  if (isRealGitCommand(name)) parts.push(pcx.shadowsCommand(name))
  if (value.startsWith('!')) parts.push(pcx.shellAlias(name))
  else if (value.trim() === '') parts.push(pcx.emptyAlias(name))
  return parts.join(' ')
}

/** Чтение из ~/.gitconfig. П7.73: пустое значение — одна пустая строка (`\n`), код 0; нет ключа — код 1. */
function handleRead(state: PracticesState, key: string, pattern?: string): Outcome {
  const check = checkAliasKey(key)
  if (check.kind !== 'ok') return keyProblem(state, key, check, 1)
  let regexp: RegExp | null = null
  if (pattern !== undefined) {
    const compiled = compileValuePattern(state, pattern)
    if (!compiled.ok) return compiled.outcome
    regexp = compiled.regexp
  }
  const entry = state.globalConfig.find((e) => sameConfigKey(e.key, key))
  if (!entry || (regexp !== null && !regexp.test(entry.value))) return exited(state, '', 1)
  return exited(state, entry.value === '' ? '\n' : entry.value, 0)
}

/** Чтение без --global: git читает оба файла, раздел — нет; но плохой ключ git отвергает раньше (П7.66, П7.79). */
function handleReadWithoutScope(state: PracticesState, key: string, form: string): Outcome {
  const check = checkAliasKey(key)
  if (check.kind === 'invalid' || check.kind === 'noVariable') return keyProblem(state, key, check, 1)
  return refuse(state, pc.scopeRequired(form))
}

function handleGetRegexp(state: PracticesState, pattern: string): Outcome {
  if (pattern === '') return refuse(state, pc.formRefused('--get-regexp ""'))
  // П7.71: git приводит шаблон к нижнему регистру и применяет POSIX ERE; ключи в выводе тоже в нижнем регистре.
  const compiled = compileEre(pattern.toLowerCase())
  if (compiled.kind === 'invalid') return exited(state, `error: invalid key pattern: ${pattern}`, 6)
  if (compiled.kind === 'unsupported') return refuse(state, pc.keyPatternForm(pattern))
  const lines = state.globalConfig.filter((e) => compiled.regexp.test(e.key.toLowerCase())).map((e) => `${e.key.toLowerCase()} ${e.value}`)
  return exited(state, lines.join('\n'), lines.length > 0 ? 0 : 1)
}

/** Удаление; без --global — из .git/config (П7.65). Нет ключа или шаблон не подошёл — код 5. */
function handleUnset(state: PracticesState, scope: ConfigScope, key: string, pattern?: string): Outcome {
  const check = checkAliasKey(key)
  if (check.kind !== 'ok') return keyProblem(state, key, check, 2)
  let regexp: RegExp | null = null
  if (pattern !== undefined) {
    const compiled = compileValuePattern(state, pattern)
    if (!compiled.ok) return compiled.outcome
    regexp = compiled.regexp
  }
  const entries = configEntries(state, scope)
  const entry = entries.find((e) => sameConfigKey(e.key, key))
  if (!entry || (regexp !== null && !regexp.test(entry.value))) return exited(state, '', 5)
  const next = withEntries(
    state,
    scope,
    entries.filter((e) => e !== entry),
  )
  return exited(next, '', 0, scope === 'global' ? pcx.unset(entry.key) : pcx.unsetLocal(entry.key))
}

/** Выполняет `git config …`; `args` — слова после `config`. */
export function handleConfig(state: PracticesState, args: readonly string[]): Outcome {
  const form = args.join(' ')
  const result = parseConfigArgs(args)
  if (result.kind === 'unknownOption') {
    // П7.25: ``error: unknown option `foo'`` и полный usage, код 129.
    return exited(state, [`error: unknown option \`${result.option}'`, ...CONFIG_USAGE_LINES, ''].join('\n'), 129)
  }
  if (result.kind === 'refused') return refuse(state, pc.formRefused(result.form))
  const { sub, global, action, positionals } = result.parsed
  const n = positionals.length
  const scope: ConfigScope = global ? 'global' : 'local'

  if (sub === 'set') {
    if (!global || n !== 2) return refuse(state, pc.formRefused(form))
    return handleWrite(state, 'global', positionals[0], positionals[1])
  }

  if (sub === null && action === null) {
    // П7.25: `git config --global` без слов — `error: no action specified`, код 129.
    if (n === 0) return global ? exited(state, 'error: no action specified', 129) : refuse(state, pc.formRefused(form))
    // П7.64: четыре слова и больше — та же ошибка (шелл разбил значение на слова).
    if (n >= 4) return exited(state, 'error: no action specified', 129, pc.splitValueNote)
    if (n === 1) return global ? handleRead(state, positionals[0]) : handleReadWithoutScope(state, positionals[0], form)
    return handleWrite(state, scope, positionals[0], positionals[1], positionals[2])
  }

  const act = sub === 'get' ? 'get' : sub === 'unset' ? 'unset' : sub === 'list' ? 'list' : action
  // Подкоманды `get` и `unset` принимают ровно одно слово; с `--get`/`--unset` второе слово — шаблон значения.
  const maxWords = sub === null ? 2 : 1

  if (act === 'unset') {
    if (n < 1 || n > maxWords) return refuse(state, pc.formRefused(form))
    return handleUnset(state, scope, positionals[0], positionals[1])
  }

  // Чтение, список и regexp — только в ~/.gitconfig (--global); без него git читает оба файла, раздел не разбирает.
  if (!global) return act === 'get' && n >= 1 ? handleReadWithoutScope(state, positionals[0], form) : refuse(state, pc.scopeRequired(form))
  switch (act) {
    case 'get':
      return n >= 1 && n <= maxWords ? handleRead(state, positionals[0], positionals[1]) : refuse(state, pc.formRefused(form))
    case 'getRegexp':
      return n === 1 ? handleGetRegexp(state, positionals[0]) : refuse(state, pc.formRefused(form))
    default:
      // П7.25: `--list`, `-l`, `git config list --global` — `ключ=значение` по порядку записи, ключи в нижнем регистре (П7.67).
      return n === 0 ? exited(state, state.globalConfig.map((e) => `${e.key.toLowerCase()}=${e.value}`).join('\n'), 0) : refuse(state, pc.formRefused(form))
  }
}
