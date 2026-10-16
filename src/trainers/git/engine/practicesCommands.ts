// ============================================================
// Раздел 7 git-тренажёра («Эффективная работа»): git-сторона разбора командной строки.
// Поток g18a: `git status`, `git check-ignore`, `git add`. Поток g18b2 добавил в диспетчер
// `git config` (practicesConfig.ts), `git help` и вызов алиасов (practicesAlias.ts),
// `git log` (practicesLog.ts), `git commit -m` (practicesCommit.ts).
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
import { exited, refuse, type Outcome } from './practicesOutcome'
import { handleConfig } from './practicesConfig'
import { handleHelp, planAlias } from './practicesAlias'
import { handleLog } from './practicesLog'
import { handleCommit } from './practicesCommit'
import { isHandledCommand, isRealGitCommand, type HandledCommand } from './practicesScope'
import { markAliasRun } from './practicesMissions'
import { formatStatusNoCommits, type StatusEntry, type StatusOptions } from './sectionsCommon'
import { GITIGNORE_FILE } from './practicesGitignore'
import { ignoreVerdict, isTracked, listWorkingFiles } from './practicesRepo'
import { findShellRefusal, shellRefusalText, shellTokenize } from './shell'
import { gitNotACommand, isGlobalGitOption } from './branchScope'
import { has } from './util'
import { ru } from '../locales/ru'

const pe = ru.practices.errors
const px = ru.practices.explain

function appendCommand(state: PracticesState, rawInput: string, result: CommandResult): PracticesState {
  return {
    ...state,
    history: [...state.history, { kind: 'command', input: rawInput, ok: result.ok, output: result.output, explanation: result.explanation }],
  }
}

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
  const explanation = blocked && blocked.negationBlockedBy && blocked.ignoredPath && blocked.rule ? px.negationInsideIgnoredDir(blocked.negationBlockedBy.source, blocked.ignoredPath, blocked.rule.source) : null
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
  if (paths.length === 0) return refuse(state, pe.checkIgnoreNoPath)
  // П7.52: `git check-ignore --non-matching app.js` без -v — fatal, код 128.
  if (nonMatching && !verbose) return exited(state, 'fatal: --non-matching is only valid with --verbose', 128)
  for (const path of paths) {
    if (!has(state.working, path)) return refuse(state, pe.pathNotFile('check-ignore', path))
    if (isTracked(state, path)) return refuse(state, pe.checkIgnoreTracked(path))
  }

  const verdicts = paths.map((path) => ({ path, verdict: ignoreVerdict(state, path) }))
  // Код возврата (П7.51): с -v — 0, если у какого-либо пути совпало любое правило, включая «!»;
  // без -v — 0, только если игнорируется какой-либо путь.
  const anyIgnored = verdicts.some((v) => v.verdict.ignored)
  const anyMatched = verdicts.some((v) => v.verdict.rule !== null)
  const exitCode = (verbose ? anyMatched : anyIgnored) ? 0 : 1

  const lines: string[] = []
  for (const { path, verdict } of verdicts) {
    // П7.51, П7.52: без -v git печатает только сами игнорируемые пути.
    if (!verbose) {
      if (verdict.ignored) lines.push(path)
    } else if (verdict.rule !== null) lines.push(`${GITIGNORE_FILE}:${verdict.rule.line}:${verdict.rule.source}\t${path}`)
    else if (nonMatching) lines.push(`::\t${path}`)
  }

  const negated = verdicts.find((v) => v.verdict.rule !== null && v.verdict.rule.negated)
  const blocked = verdicts.find((v) => v.verdict.negationBlockedBy !== null)
  let explanation: string | null = null
  if (blocked && blocked.verdict.negationBlockedBy && blocked.verdict.ignoredPath && blocked.verdict.rule) {
    explanation = px.negationInsideIgnoredDir(blocked.verdict.negationBlockedBy.source, blocked.verdict.ignoredPath, blocked.verdict.rule.source)
  } else if (verbose && negated && negated.verdict.rule) {
    explanation = px.negatedRule(negated.verdict.rule.source)
  }
  return exited(state, lines.join('\n'), exitCode, explanation)
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

/** Выполняет команду из списка `HANDLED_COMMANDS`. */
function runHandled(state: PracticesState, sub: HandledCommand, args: readonly string[], usedStar: boolean): Outcome {
  // Справка (`-h`, `--help`, …) и разделитель `--` тренажёр не разбирает: попадают в общий отказ формы.
  switch (sub) {
    case 'status':
      return handleStatus(state, args)
    case 'check-ignore':
      return handleCheckIgnore(state, args)
    case 'add':
      return handleAdd(state, args, usedStar)
    case 'config':
      return handleConfig(state, args)
    case 'help':
      return handleHelp(state, args)
    case 'log':
      return handleLog(state, args)
    case 'commit':
      return handleCommit(state, args)
  }
}

/** Прибавляет речь тренажёра к пояснению результата (после речи самой команды). */
function withExplanation(outcome: Outcome, speech: string): Outcome {
  const explanation = outcome.result.explanation === null ? speech : `${speech} ${outcome.result.explanation}`
  return { state: outcome.state, result: { ...outcome.result, explanation } }
}

/**
 * Вызов алиаса `git <имя> [аргументы]`: git подставляет значение и дописывает аргументы, затем
 * выполняет получившуюся команду (П7.25). Раскрытая команда проходит через тот же разбор, что и
 * введённая руками; вне области раздела — отказ области, а речь называет, во что раскрылся алиас.
 * Миссия 4 засчитывается, если команда выполнена с кодом 0.
 */
function runAlias(state: PracticesState, name: string, args: readonly string[], usedStar: boolean): Outcome | null {
  const plan = planAlias(state, name, args)
  if (plan === null) return null
  if (plan.kind === 'answer') return plan.outcome
  const [target, ...targetArgs] = plan.words
  const expansion = `git ${plan.words.join(' ')}`
  if (isGlobalGitOption(target)) return withExplanation(refuse(state, pe.commandOutOfScope(target)), px.aliasExpanded(name, expansion))
  if (!isHandledCommand(target)) {
    // Настоящая команда вне области раздела — отказ области. Несуществующая команда в значении прогоном не сверена.
    const outcome = isRealGitCommand(target) ? refuse(state, pe.commandOutOfScope(target)) : refuse(state, ru.practices.alias.unknownTarget(name, target))
    return withExplanation(outcome, px.aliasExpanded(name, expansion))
  }
  const inner = runHandled(state, target, targetArgs, usedStar)
  const done = withExplanation(inner, px.aliasExpanded(name, expansion))
  return inner.result.ok && inner.result.exitCode === 0 ? { state: markAliasRun(done.state), result: done.result } : done
}

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

  const args = words.slice(2)
  const usedStar = tokens.slice(2).some((t) => t.star !== undefined)

  if (isHandledCommand(sub)) return respond(runHandled(state, sub, args, usedStar))
  // У настоящей команды приоритет над одноимённым алиасом (П7.25).
  if (isRealGitCommand(sub)) return respond(refuse(state, pe.commandOutOfScope(sub)))

  const aliased = runAlias(state, sub, args, usedStar)
  if (aliased !== null) return respond(aliased)
  // П7.25: `git st` без алиаса; список похожих команд не печатается (target.md, место 20).
  return respond(exited(state, gitNotACommand(sub), 1))
}
