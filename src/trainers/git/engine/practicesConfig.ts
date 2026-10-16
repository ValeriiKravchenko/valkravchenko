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
// Формы:
//   запись   git config [--global] alias.<имя> <значение>;  git config set --global alias.<имя> <значение>
//   чтение   git config --global alias.<имя>;  --get;  git config get --global alias.<имя>
//   regexp   git config --global --get-regexp <шаблон>
//   список   git config --global --list | -l;  git config list --global
//   удаление git config --global --unset alias.<имя>;  git config unset --global alias.<имя>
// ============================================================
import type { ConfigEntry, PracticesState } from './practicesTypes'
import { exited, refuse, type Outcome } from './practicesOutcome'
import { isRealGitCommand } from './practicesScope'
import { ru } from '../locales/ru'

const pc = ru.practices.config
const pcx = ru.practices.explain

export type ConfigScope = 'global' | 'local'

/** Имя алиаса, допустимое и сверенное прогонами: `st`, `lg`, `q`, `zz`, `st-short` (П7.25). Заглавные и другие знаки прогонами не проверялись. */
const ALIAS_NAME = /^[a-z][a-z0-9-]*$/

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

/** Запись ключа: новая — в конец, существующая — значение меняется на месте. */
export function setConfigEntry(entries: readonly ConfigEntry[], key: string, value: string): ConfigEntry[] {
  return entries.some((e) => e.key === key) ? entries.map((e) => (e.key === key ? { key, value } : e)) : [...entries, { key, value }]
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

/** Где записан алиас. Одно имя в обоих конфигах — отдельный случай: прогонами не сверен (target.md, «Что НЕ входит»). */
export function lookupAlias(state: PracticesState, name: string): AliasLookup {
  const key = `alias.${name}`
  const inGlobal = state.globalConfig.find((e) => e.key === key)
  const inLocal = state.localConfig.find((e) => e.key === key)
  if (inGlobal && inLocal) return { kind: 'ambiguous' }
  if (inGlobal) return { kind: 'found', value: inGlobal.value, scope: 'global' }
  if (inLocal) return { kind: 'found', value: inLocal.value, scope: 'local' }
  return { kind: 'none' }
}

// ---------- ключ ----------

type KeyCheck = { kind: 'ok'; name: string } | { kind: 'invalid' } | { kind: 'other' }

/**
 * `ok` — имя сверено (`alias.st`); `invalid` — git отвечает `error: invalid key` (имя начинается с цифры или `_`
 * либо содержит пробел или `!`, П7.25); `other` — всё остальное: другие ключи, заглавные, точки в имени — отказ области.
 */
function checkAliasKey(key: string): KeyCheck {
  if (!key.startsWith('alias.')) return { kind: 'other' }
  const name = key.slice('alias.'.length)
  if (ALIAS_NAME.test(name)) return { kind: 'ok', name }
  if (name.length > 0 && (/^[0-9_]/.test(name) || /[ !]/.test(name))) return { kind: 'invalid' }
  return { kind: 'other' }
}

// ---------- разбор команды ----------

interface ParsedConfig {
  sub: Subcommand | null
  global: boolean
  action: 'get' | 'getRegexp' | 'unset' | 'list' | null
  positionals: string[]
}

type ParseResult = { kind: 'parsed'; parsed: ParsedConfig } | { kind: 'unknownOption'; option: string } | { kind: 'refused'; form: string; words?: readonly string[] }

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
  let splitByShell = false
  const setAction = (next: NonNullable<ParsedConfig['action']>, arg: string) => {
    if (flags.action !== null) refusedForm ??= arg
    flags.action = next
  }
  for (const arg of rest) {
    if (arg === '--global') {
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
      else if (positionals.length > 0) splitByShell = true
      else unknownOption ??= arg.slice(2)
    } else if (arg.startsWith('-') && arg.length > 1) refusedForm ??= arg
    else positionals.push(arg)
  }
  // Слова значения, которые шелл разбил и которые похожи на опции (`log --oneline`): что git с ними сделает, прогоны не показывают (место 13).
  if (splitByShell) return { kind: 'refused', form: args.join(' '), words: args }
  // Неизвестную длинную опцию git обнаруживает при разборе опций, раньше любого смысла команды.
  if (unknownOption !== null && sub === null) return { kind: 'unknownOption', option: unknownOption }
  if (unknownOption !== null) return { kind: 'refused', form: `--${unknownOption}` }
  if (refusedForm !== null) return { kind: 'refused', form: refusedForm }
  if (sub !== null && flags.action !== null) return { kind: 'refused', form: `${sub} --${flags.action}` }
  return { kind: 'parsed', parsed: { sub, global: flags.global, action: flags.action, positionals } }
}

// ---------- обработчик ----------

/** Значение, которое раздел записывает: без кавычек и обратной косой черты внутри (target.md, «Что НЕ входит»). */
function valueSupported(value: string): boolean {
  return !/["'\\]/.test(value)
}

function readKey(state: PracticesState, key: string): { ok: true; name: string } | { ok: false; outcome: Outcome } {
  const check = checkAliasKey(key)
  if (check.kind === 'ok') return { ok: true, name: check.name }
  return { ok: false, outcome: refuse(state, check.kind === 'invalid' ? pc.keyReadForm(key) : pc.keyOutOfScope(key)) }
}

function handleWrite(state: PracticesState, scope: ConfigScope, key: string, value: string, extra: readonly string[]): Outcome {
  if (extra.length > 0) return refuse(state, pc.extraWords([key, value, ...extra]))
  const check = checkAliasKey(key)
  if (check.kind === 'invalid') return exited(state, `error: invalid key: ${key}`, 1, pc.invalidKeyNote)
  if (check.kind === 'other') return refuse(state, pc.keyOutOfScope(key))
  if (!valueSupported(value)) return refuse(state, pc.valueForm(value))
  const next = withEntries(state, scope, setConfigEntry(configEntries(state, scope), key, value))
  return exited(next, '', 0, writeExplanation(scope, key, check.name, value))
}

/** Речь тренажёра после записи: куда попала запись и что с ней будет при вызове (места 14, 15, 17, 18). */
function writeExplanation(scope: ConfigScope, key: string, name: string, value: string): string {
  const parts = [scope === 'global' ? pcx.writtenGlobal(key) : pcx.writtenLocal(key)]
  if (isRealGitCommand(name)) parts.push(pcx.shadowsCommand(name))
  if (value.startsWith('!')) parts.push(pcx.shellAlias(name))
  else if (value.trim() === '') parts.push(pcx.emptyAlias(name))
  return parts.join(' ')
}

function handleRead(state: PracticesState, key: string, subForAbsent: Subcommand | null): Outcome {
  const keyed = readKey(state, key)
  if (!keyed.ok) return keyed.outcome
  const entry = state.globalConfig.find((e) => e.key === key)
  if (entry) return exited(state, entry.value, 0)
  // П7.25: чтение отсутствующего ключа — пусто, код 1. Для `git config get` код прогонами не сверен.
  if (subForAbsent !== null) return refuse(state, pc.absentKeyForm(subForAbsent))
  return exited(state, '', 1)
}

function handleGetRegexp(state: PracticesState, pattern: string): Outcome {
  if (pattern === '') return refuse(state, pc.formRefused('--get-regexp ""'))
  let regexp: RegExp
  try {
    regexp = new RegExp(pattern)
  } catch {
    // П7.25: `--get-regexp "["` → `error: invalid key pattern: [`, код 6 (шаблон разбирается как JavaScript-regexp, упрощение).
    return exited(state, `error: invalid key pattern: ${pattern}`, 6)
  }
  const lines = state.globalConfig.filter((e) => regexp.test(e.key)).map((e) => `${e.key} ${e.value}`)
  return exited(state, lines.join('\n'), lines.length > 0 ? 0 : 1)
}

function handleUnset(state: PracticesState, key: string, subForAbsent: Subcommand | null): Outcome {
  const keyed = readKey(state, key)
  if (!keyed.ok) return keyed.outcome
  if (!state.globalConfig.some((e) => e.key === key)) {
    // П7.25: `--unset` отсутствующего ключа — пусто, код 5. Для `git config unset` код прогонами не сверен.
    if (subForAbsent !== null) return refuse(state, pc.absentKeyForm(subForAbsent))
    return exited(state, '', 5)
  }
  return exited({ ...state, globalConfig: state.globalConfig.filter((e) => e.key !== key) }, '', 0, pcx.unset(key))
}

/** Выполняет `git config …`; `args` — слова после `config`. */
export function handleConfig(state: PracticesState, args: readonly string[]): Outcome {
  const form = args.join(' ')
  const result = parseConfigArgs(args)
  if (result.kind === 'unknownOption') {
    // П7.25: ``error: unknown option `foo'`` и полный usage, код 129.
    return exited(state, [`error: unknown option \`${result.option}'`, ...CONFIG_USAGE_LINES, ''].join('\n'), 129)
  }
  if (result.kind === 'refused') return refuse(state, result.words ? pc.extraWords(result.words) : pc.formRefused(result.form))
  const { sub, global, action, positionals } = result.parsed
  const need = (n: number) => positionals.length === n

  // П7.25: `git config --global` без действия — `error: no action specified`, код 129.
  if (sub === null && action === null && positionals.length === 0) {
    return global ? exited(state, 'error: no action specified', 129) : refuse(state, pc.formRefused(form))
  }

  if (sub === 'set') {
    if (!global || positionals.length < 2) return refuse(state, pc.formRefused(form))
    return handleWrite(state, 'global', positionals[0], positionals[1], positionals.slice(2))
  }

  if (sub === null && action === null) {
    if (positionals.length === 1) return global ? handleRead(state, positionals[0], null) : refuse(state, pc.scopeRequired(form))
    return handleWrite(state, global ? 'global' : 'local', positionals[0], positionals[1], positionals.slice(2))
  }

  // Чтение, список и удаление — только в ~/.gitconfig (--global); без него прогонов нет.
  if (!global) return refuse(state, pc.scopeRequired(form))
  const act = sub === 'get' ? 'get' : sub === 'unset' ? 'unset' : sub === 'list' ? 'list' : action
  const absent = sub // 'get' | 'unset' | null — для отказа по отсутствующему ключу
  switch (act) {
    case 'get':
      return need(1) ? handleRead(state, positionals[0], absent) : refuse(state, pc.formRefused(form))
    case 'unset':
      return need(1) ? handleUnset(state, positionals[0], absent) : refuse(state, pc.formRefused(form))
    case 'getRegexp':
      return need(1) ? handleGetRegexp(state, positionals[0]) : refuse(state, pc.formRefused(form))
    default:
      // П7.25: `--list`, `-l`, `git config list --global` — `ключ=значение` по порядку записи.
      return need(0) ? exited(state, state.globalConfig.map((e) => `${e.key}=${e.value}`).join('\n'), 0) : refuse(state, pc.formRefused(form))
  }
}
