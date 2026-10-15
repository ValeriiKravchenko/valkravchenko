// ============================================================
// Раздел 7 git-тренажёра («Эффективная работа»), поток g18a: git-сторона разбора командной
// строки для `git status`, `git check-ignore` и `git add`. Остальное (`git config`, алиасы,
// `git log`, `git help`) добавит g18b в этот же диспетчер.
//
// Строки вида «fatal: …», «The following paths are ignored…», «hint: …» — буквальный вывод
// git 2.53.0 из docs/git-trainer/reports/section7-git-runs.txt (П7.22, П7.23), не
// переводятся и в словарь не идут. Всё, что говорит сам тренажёр, лежит в ru.practices и
// начинается с метки [тренажёр] (target.md, часть III, правило 2).
//
// Граница области (часть III, правило 1). Разбор строгий: воспроизводятся только формы,
// сверенные прогонами; любая другая получает честный отказ области без кода возврата и без
// выдуманного сообщения git. Ошибки игрока, которые git воспроизводит сам (отказ `git add`,
// «no path specified»), возвращаются результатом с кодом возврата, не исключением.
// ============================================================
import type { CommandResult, PracticesState } from './practicesTypes'
import { formatStatusNoCommits, type StatusEntry, type StatusOptions } from './sectionsCommon'
import { GITIGNORE_FILE } from './practicesGitignore'
import { ignoreVerdict, isTracked, listWorkingFiles } from './practicesRepo'
import { findShellRefusal, shellRefusalText, shellTokenize } from './shell'
import { gitNotACommand, isGlobalGitOption, REAL_GIT_COMMANDS } from './branchScope'
import { has } from './util'
import { ru } from '../locales/ru'

const pe = ru.practices.errors
const px = ru.practices.explain

type Outcome = { state: PracticesState; result: CommandResult }

/** Результат с кодом возврата git: `ok` — это код 0. */
function exited(state: PracticesState, output: string, exitCode: number, explanation: string | null = null): Outcome {
  return { state, result: { ok: exitCode === 0, output, explanation, exitCode } }
}

/** Честный отказ области: код возврата не задаётся, потому что git здесь ничего не печатал. */
function refuse(state: PracticesState, output: string): Outcome {
  return { state, result: { ok: false, output, explanation: null } }
}

function appendCommand(state: PracticesState, rawInput: string, result: CommandResult): PracticesState {
  return {
    ...state,
    history: [...state.history, { kind: 'command', input: rawInput, ok: result.ok, output: result.output, explanation: result.explanation }],
  }
}

/** Команды, которые раздел 7 в потоке g18a выполняет. */
const HANDLED = ['status', 'check-ignore', 'add'] as const

/** Настоящие команды git вне `REAL_GIT_COMMANDS` раздела 1, которые встречаются в разделе 7 (`check-ignore` из прогонов П7.23). */
const EXTRA_REAL_COMMANDS: ReadonlySet<string> = new Set(['check-ignore'])

/** Имена верхнего уровня рабочего каталога — на них раскрывается голая `*` (файлы и каталоги, как у bash; без скрытых). */
function topLevelNames(state: PracticesState): string[] {
  const names = new Set<string>()
  for (const path of Object.keys(state.working)) names.add(path.split('/')[0])
  return [...names]
}

// ---------- git status ----------

function handleStatus(state: PracticesState, args: readonly string[]): Outcome {
  const options: StatusOptions = { short: false, ignored: false, uall: false }
  const paths: string[] = []
  for (const arg of args) {
    let key: keyof StatusOptions | null = null
    if (arg === '-s' || arg === '--short') key = 'short'
    else if (arg === '--ignored') key = 'ignored'
    else if (arg === '-uall') key = 'uall'
    else if (arg.startsWith('-')) return refuse(state, pe.statusForm(arg))
    if (key === null) {
      paths.push(arg)
      continue
    }
    // Повтор ключа (`-s --short`) прогонами не сверен.
    if (options[key]) return refuse(state, pe.statusForm(arg))
    options[key] = true
  }

  // П7.22: `git status --short debug.log` после `git add -f debug.log` → `A  debug.log`.
  if (paths.length > 0) {
    const onlyShort = options.short && !options.ignored && !options.uall
    if (onlyShort && paths.length === 1 && isTracked(state, paths[0])) return exited(state, `A  ${paths[0]}`, 0)
    return refuse(state, pe.statusPathspec(paths))
  }

  // С файлом в индексе вывод status (раздел «Changes to be committed», порядок строк) прогонами не сверен.
  if (Object.keys(state.index).length > 0) return refuse(state, pe.statusStaged)

  const entries: StatusEntry[] = listWorkingFiles(state).map((path) => ({
    path,
    kind: ignoreVerdict(state, path).ignored ? 'ignored' : 'untracked',
  }))
  const formatted = formatStatusNoCommits(state.branch, entries, options)
  if (!formatted.ok) {
    if (formatted.reason === 'unverifiedCombo') return refuse(state, pe.statusForm(args.join(' ')))
    if (formatted.reason === 'noUntracked') return refuse(state, pe.statusNoUntracked)
    return refuse(state, pe.statusLayout)
  }
  const blocked = entries.map((e) => ignoreVerdict(state, e.path)).find((v) => v.negationBlockedBy !== null)
  const explanation = blocked && blocked.negationBlockedBy && blocked.ignoredPath ? px.negationInsideIgnoredDir(blocked.negationBlockedBy.source, blocked.ignoredPath) : null
  return exited(state, formatted.output, 0, explanation)
}

// ---------- git check-ignore ----------

function handleCheckIgnore(state: PracticesState, args: readonly string[]): Outcome {
  // П7.23: `git check-ignore` без аргументов.
  if (args.length === 0) return exited(state, 'fatal: no path specified', 128)

  let verbose = false
  let nonMatching = false
  const paths: string[] = []
  for (const arg of args) {
    if (arg === '-v' || arg === '--verbose') {
      if (verbose) return refuse(state, pe.checkIgnoreForm(arg))
      verbose = true
    } else if (arg === '--non-matching') {
      if (nonMatching) return refuse(state, pe.checkIgnoreForm(arg))
      nonMatching = true
    } else if (arg.startsWith('-')) {
      return refuse(state, pe.checkIgnoreForm(arg))
    } else {
      paths.push(arg)
    }
  }
  if (!verbose) return refuse(state, pe.checkIgnoreNoVerbose)
  if (paths.length === 0) return refuse(state, pe.checkIgnoreNoPath)
  for (const path of paths) {
    if (!has(state.working, path)) return refuse(state, pe.pathNotFile('check-ignore', path))
    if (isTracked(state, path)) return refuse(state, pe.checkIgnoreTracked(path))
  }

  const verdicts = paths.map((path) => ({ path, verdict: ignoreVerdict(state, path) }))
  if (!nonMatching) {
    const negatedOnly = verdicts.find((v) => v.verdict.rule !== null && v.verdict.rule.negated)
    if (negatedOnly) return refuse(state, pe.checkIgnoreNegatedNeedsNonMatching(negatedOnly.path))
  }
  // Код возврата, когда игнорируемых путей нет, а правило с `!` совпало, прогонами не сверен (П7.6 — с игнорируемыми путями).
  const anyIgnored = verdicts.some((v) => v.verdict.ignored)
  const anyNegated = verdicts.some((v) => v.verdict.rule !== null && v.verdict.rule.negated)
  if (!anyIgnored && anyNegated) return refuse(state, pe.checkIgnoreNegatedOnlyExit)

  const lines: string[] = []
  for (const { path, verdict } of verdicts) {
    if (verdict.rule !== null) lines.push(`${GITIGNORE_FILE}:${verdict.rule.line}:${verdict.rule.source}\t${path}`)
    else if (nonMatching) lines.push(`::\t${path}`)
  }

  const negated = verdicts.find((v) => v.verdict.rule !== null && v.verdict.rule.negated)
  const blocked = verdicts.find((v) => v.verdict.negationBlockedBy !== null)
  let explanation: string | null = null
  if (blocked && blocked.verdict.negationBlockedBy && blocked.verdict.ignoredPath) {
    explanation = px.negationInsideIgnoredDir(blocked.verdict.negationBlockedBy.source, blocked.verdict.ignoredPath)
  } else if (negated && negated.verdict.rule) {
    explanation = px.negatedRule(negated.verdict.rule.source)
  }
  return exited(state, lines.join('\n'), anyIgnored ? 0 : 1, explanation)
}

// ---------- git add ----------

const ADD_IGNORED_HEADER = 'The following paths are ignored by one of your .gitignore files:'
const ADD_IGNORED_HINTS = ['hint: Use -f if you really want to add them.', 'hint: Disable this message with "git config set advice.addIgnoredFile false"']

function handleAdd(state: PracticesState, args: readonly string[], usedStar: boolean): Outcome {
  let force = false
  const paths: string[] = []
  for (const arg of args) {
    if (arg === '-f' || arg === '--force') {
      if (force) return refuse(state, pe.addForm(arg))
      force = true
    } else if (arg.startsWith('-')) {
      return refuse(state, pe.addForm(arg))
    } else {
      paths.push(arg)
    }
  }
  if (usedStar || paths.length !== 1) return refuse(state, pe.addForm(args.join(' ')))
  const path = paths[0]
  if (!has(state.working, path)) return refuse(state, pe.pathNotFile('add', path))
  if (isTracked(state, path)) return refuse(state, pe.addTracked(path))

  const verdict = ignoreVerdict(state, path)
  if (!verdict.ignored || verdict.ignoredPath === null) return refuse(state, pe.addNotIgnored(path))

  if (force) {
    // П7.22: `git add -f debug.log` молчит, код 0.
    const next: PracticesState = { ...state, index: { ...state.index, [path]: state.working[path] } }
    return exited(next, '', 0, px.addForced(path))
  }
  // П7.22: отказ называет сам файл или игнорируемый каталог на пути, код 1.
  const output = [ADD_IGNORED_HEADER, verdict.ignoredPath, ...ADD_IGNORED_HINTS].join('\n')
  return exited(state, output, 1, px.addRefused)
}

// ---------- диспетчер ----------

/**
 * Выполняет одну строку терминала раздела 7. Ничего не бросает: любой недопустимый ввод
 * превращается в предусмотренный результат (вывод git с кодом возврата либо отказ области).
 * Пустая строка не меняет состояние и возвращает `result === null`.
 */
export function executePracticesCommand(state: PracticesState, rawInput: string): { state: PracticesState; result: CommandResult | null } {
  if (!rawInput.trim()) return { state, result: null }

  function respond(outcome: Outcome) {
    return { state: appendCommand(outcome.state, rawInput, outcome.result), result: outcome.result }
  }

  const refusal = findShellRefusal(rawInput)
  if (refusal) return respond(refuse(state, shellRefusalText(refusal)))

  const tokens = shellTokenize(rawInput, topLevelNames(state))
  const words = tokens.map((t) => t.text)

  if (words[0] !== 'git') return respond(refuse(state, ru.errors.bashCommandNotFound(words[0] ?? '')))

  const badGlob = tokens.slice(1).find((t) => t.unsupportedGlob)
  if (badGlob) return respond(refuse(state, ru.errors.shellGlobUnsupported(badGlob.text)))

  const sub = words[1]
  if (sub === undefined) return respond(refuse(state, pe.gitUsageNoArgs))
  if (isGlobalGitOption(sub)) return respond(refuse(state, pe.commandOutOfScope(sub)))

  if (!(HANDLED as readonly string[]).includes(sub)) {
    if (REAL_GIT_COMMANDS.has(sub) || EXTRA_REAL_COMMANDS.has(sub)) return respond(refuse(state, pe.commandOutOfScope(sub)))
    // П7.25: `git st` без алиаса; список похожих команд не печатается (target.md, место 20).
    return respond(exited(state, gitNotACommand(sub), 1))
  }

  const args = words.slice(2)
  // Справка (`-h`, `--help`, …) и разделитель `--` тренажёр не разбирает: попадают в общий отказ формы.
  switch (sub) {
    case 'status':
      return respond(handleStatus(state, args))
    case 'check-ignore':
      return respond(handleCheckIgnore(state, args))
    default:
      return respond(handleAdd(state, args, tokens.slice(2).some((t) => t.star !== undefined)))
  }
}
