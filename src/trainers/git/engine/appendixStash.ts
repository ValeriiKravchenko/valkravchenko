// ============================================================
// Раздел 8 git-тренажёра, шаг A: команда `git stash` (target.md, часть X, места 7–12). Формы:
// `git stash`, `-m <сообщение>`, `push [-m <сообщение>]`, `save [<сообщение>…]`, `list`, `apply`,
// `pop`, `drop`, `clear`; ссылка на тайник — `stash@{n}` или `n`. Вывод git — английские литералы
// из протоколов (section8-git-runs.txt, П8.3, П8.14; appendix-g18e2-git-runs.txt, П8.41–П8.51), не
// переводится; речь тренажёра лежит в ru.appendix. Всё остальное (`show`, `branch`, `-u`, `-k`,
// `--index`, пути, `-q` и т. д.) получает отказ области (часть III, правило 1). Конфликт при применении
// входит (target.md, часть XI; conflicts-git-runs.txt, К4, К16): метки `Updated upstream` и `Stashed changes`, тайник
// остаётся в стопке, есть неслитые пути, операции нет; конфликт других видов (оба создали, изменение и удаление) — отказ области.
// Модель и правила: appendixStashModel.ts.
// ============================================================
import type { AppendixState, AppendixStash } from './appendixTypes'
import { exited, refuse, type Outcome } from './appendixOutcome'
import { markMission } from './appendixMissions'
import { conflictForm, hasUnmerged, refusalOutcome, stateStatus, statusRefusal } from './appendixConflicts'
import { resolveRevision } from './appendixRevisions'
import { hasRecreatedPath, hasTrackedChanges, planApply, removeStash, saveStash, stagingLost } from './appendixStashModel'
import { conflictOutput, enterConflict } from './conflicts'
import { stashLabel } from './detachedHead'
import { ru } from '../locales/ru'

const ae = ru.appendix.errors
const ax = ru.appendix.explain

/** Подкоманды `git stash` в git 2.53.0 (проверено прогоном П8.44, П8.45): слово не из списка git не считает подкомандой. */
const REAL_SUBCOMMANDS: ReadonlySet<string> = new Set(['push', 'save', 'list', 'show', 'apply', 'pop', 'drop', 'clear', 'branch', 'create', 'store', 'export', 'import'])

/** `git stash pop --abort` (К4.2): у тайника нет `--abort`; ключ неизвестен, код 129. Вывод кончается пустой строкой. */
const POP_ABORT_USAGE = [
  "error: unknown option `abort'",
  'usage: git stash pop [--index] [-q | --quiet] [<stash>]',
  '',
  '    -q, --[no-]quiet      be quiet, only report errors',
  '    --[no-]index          attempt to recreate the index',
  '',
].join('\n')

/** `git stash --abort` (К4.2): то же начало и полный usage `git stash`, код 129. Вывод кончается пустой строкой. */
const STASH_ABORT_USAGE = [
  "error: unknown option `abort'",
  'usage: git stash list [<log-options>]',
  '   or: git stash show [-u | --include-untracked | --only-untracked] [<diff-options>] [<stash>]',
  '   or: git stash drop [-q | --quiet] [<stash>]',
  '   or: git stash pop [--index] [-q | --quiet] [<stash>]',
  '   or: git stash apply [--index] [-q | --quiet] [<stash>]',
  '   or: git stash branch <branchname> [<stash>]',
  '   or: git stash [push [-p | --patch] [-S | --staged] [-k | --[no-]keep-index] [-q | --quiet]',
  '                 [-u | --include-untracked] [-a | --all] [(-m | --message) <message>]',
  '                 [--pathspec-from-file=<file> [--pathspec-file-nul]]',
  '                 [--] [<pathspec>...]]',
  '   or: git stash save [-p | --patch] [-S | --staged] [-k | --[no-]keep-index] [-q | --quiet]',
  '                 [-u | --include-untracked] [-a | --all] [<message>]',
  '   or: git stash clear',
  '   or: git stash create [<message>]',
  '   or: git stash store [(-m | --message) <message>] [-q | --quiet] <commit>',
  '   or: git stash export (--print | --to-ref <ref>) [<stash>...]',
  '   or: git stash import <commit>',
  '',
  '    -k, --[no-]keep-index keep index',
  '    -S, --[no-]staged     stash staged changes only',
  '    -p, --[no-]patch      stash in patch mode',
  '    -U, --unified <n>     generate diffs with <n> lines context',
  '    --inter-hunk-context <n>',
  '                          show context between diff hunks up to the specified number of lines',
  '    -q, --[no-]quiet      quiet mode',
  '    -u, --[no-]include-untracked',
  '                          include untracked files in stash',
  '    -a, --[no-]all        include ignore files',
  '    -m, --[no-]message <message>',
  '                          stash message',
  '    --[no-]pathspec-from-file <file>',
  '                          read pathspec from file',
  '    --[no-]pathspec-file-nul',
  '                          with --pathspec-from-file, pathspec elements are separated with NUL character',
  '',
].join('\n')

const NO_ENTRIES = 'No stash entries found.'
const KEPT = 'The stash entry is kept in case you need it again.'

// ---------- git status после apply/pop ----------

type StatusText = { ok: true; text: string } | { ok: false; refusal: string }

function statusAfter(state: AppendixState): StatusText {
  const formatted = stateStatus(state, false)
  if (!formatted.ok) return { ok: false, refusal: statusRefusal(formatted.reason, 'stash') }
  return { ok: true, text: formatted.output }
}

// ---------- ссылки на тайник ----------

type StashRef = { ok: true; position: number; label: string } | { ok: false; outcome: Outcome }

const INDEXED = /^stash@\{(0|[1-9]\d{0,3})\}$/
const NUMBER = /^(0|[1-9]\d{0,3})$/

/**
 * Ссылка на тайник по правилам git, сверенным прогонами П8.3, П8.41–П8.44. Без аргумента — вершина
 * стопки, подпись `refs/stash@{0}`. `stash@{n}` печатается как введено, номер `n` — как `refs/stash@{n}`.
 * Слово, которое не ссылка на тайник: `error: <слово> is not a valid reference` (код 1), либо
 * `fatal: '<слово>' is not a stash-like commit` (код 128), если оно называет коммит.
 */
function resolveStashRef(state: AppendixState, command: string, token: string | undefined): StashRef {
  const count = state.stashes.length
  if (token === undefined) {
    if (count === 0) return { ok: false, outcome: exited(state, NO_ENTRIES, 1, ax.stashNoEntries) }
    return { ok: true, position: 0, label: 'refs/stash@{0}' }
  }
  const indexed = INDEXED.exec(token)
  const number = NUMBER.exec(token)
  const match = indexed ?? number
  if (match !== null) {
    const position = Number(match[1])
    const label = indexed !== null ? token : `refs/stash@{${position}}`
    if (position < count) return { ok: true, position, label }
    if (count === 0) return { ok: false, outcome: exited(state, `error: ${label} is not a valid reference`, 1, ax.stashBadRef) }
    return { ok: false, outcome: exited(state, `fatal: log for '${indexed !== null ? 'stash' : 'refs/stash'}' only has ${count} entries`, 128, ax.stashBadRef) }
  }
  // Ключи (`--index`, `-q`) — формы вне области; пустое слово, номера с ведущим нулём и слишком длинные номера git понимает по-своему.
  if (token.startsWith('-')) return { ok: false, outcome: refuse(state, ae.form('stash', `${command} ${token}`, ru.appendix.allowed.stash)) }
  if (token.trim() === '' || /^\d+$/.test(token) || /^stash@\{\d+\}$/.test(token)) return { ok: false, outcome: refuse(state, ae.stashRefForm(token)) }
  const notValid = { ok: false, outcome: exited(state, `error: ${token} is not a valid reference`, 1, ax.stashBadRef) } as const
  if (token.startsWith('stash@')) return notValid
  // `HEAD@{n}` называет запись журнала HEAD, `tags/…` и `refs/heads/…` — полные имена ссылок: как git ответил бы тайнику такой ссылкой, не сверено.
  if (token.startsWith('HEAD@{') || token.includes('/')) return { ok: false, outcome: refuse(state, ae.stashRefForm(token)) }
  const revision = resolveRevision(state, token)
  if (revision.kind === 'foreign') return { ok: false, outcome: refuse(state, ae.stashRefForm(token)) }
  if (revision.kind === 'missing') return notValid
  // Коммит, а не тайник. При пустой стопке порядок проверок git не сверен.
  if (count === 0) return { ok: false, outcome: refuse(state, ae.stashRefForm(token)) }
  return { ok: false, outcome: exited(state, `fatal: '${token}' is not a stash-like commit`, 128, ax.stashNotStashLike) }
}

// ---------- сообщение тайника ----------

/** Сообщение, которое git в `stash list` показал бы без изменений: одна строка без пробелов по краям и без повторяющихся пробелов. */
function isPlainMessage(message: string): boolean {
  return message === message.trim() && !/[\t\n\r]/.test(message) && !/ {2,}/.test(message)
}

// ---------- сохранение ----------

function save(state: AppendixState, message: string | null): Outcome {
  // Неслитые пути запрещают тайник (К4.2, К5.2).
  const refused = refusalOutcome(state, { name: 'stash' })
  if (refused !== null) return refused
  if (!hasTrackedChanges(state)) return state.operation !== null ? conflictForm(state, 'stash') : exited(state, 'No local changes to save', 0, ax.stashNothing)
  if (hasRecreatedPath(state)) return refuse(state, ae.stashUnverified('push'))
  // Посреди cherry-pick без неслитых путей тайник проходит и молча бросает операцию (К12.c6).
  const saved = markMission({ ...saveStash(state, message), operation: null }, 'stashSave')
  const notes = [state.head.kind === 'detached' ? `${ax.stashSaved} ${ax.stashNoBranch}` : ax.stashSaved]
  if (state.operation !== null) notes.push(ru.conflicts.operationDroppedByStash)
  return exited(saved, `Saved working directory and index state ${saved.stashes[0].text}`, 0, notes.join(' '))
}

interface PushArgs {
  message: string | null
  /** Ответ, если разбор остановился: отказ области, ошибка ключа или ошибка подкоманды. */
  stop: ((state: AppendixState) => Outcome) | null
}

/**
 * Ключи `push` и неявного `push` (`git stash -m …`): `-m <сообщение>`, `-m<сообщение>`,
 * `--message <сообщение>`, `--message=<сообщение>`; повтор — побеждает последний (П8.45). Пустое
 * сообщение — текст `WIP on …` (П8.46). Слово, не ключ: у `push` это путь (вне области), у неявного
 * `push` — ошибка git (П8.46).
 */
function parsePush(args: readonly string[], implicit: boolean): PushArgs {
  let message: string | null = null
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    let value: string | undefined
    if (arg === '-m' || arg === '--message') {
      if (i + 1 >= args.length) {
        const name = arg === '-m' ? "switch `m'" : "option `message'"
        return { message, stop: (s) => exited(s, `error: ${name} requires a value`, 129) }
      }
      value = args[++i]
    } else if (arg.startsWith('--message=')) {
      value = arg.slice('--message='.length)
    } else if (arg.startsWith('-m') && arg.length > 2 && !arg.startsWith('--')) {
      value = arg.slice(2)
    } else if (arg.startsWith('-')) {
      return { message, stop: (s) => refuse(s, ae.form('stash', args.join(' '), ru.appendix.allowed.stash)) }
    } else if (implicit) {
      return { message, stop: (s) => exited(s, `fatal: subcommand wasn't specified; 'push' can't be assumed due to unexpected token '${arg}'`, 128, ax.stashSubcommand) }
    } else {
      return { message, stop: (s) => refuse(s, ae.form('stash', args.join(' '), ru.appendix.allowed.stash)) }
    }
    message = value
  }
  return { message, stop: null }
}

function pushWith(state: AppendixState, args: readonly string[], implicit: boolean): Outcome {
  const parsed = parsePush(args, implicit)
  if (parsed.stop !== null) return parsed.stop(state)
  if (parsed.message === null || parsed.message === '') return save(state, null)
  if (!isPlainMessage(parsed.message)) return refuse(state, ae.stashMessageForm)
  return save(state, parsed.message)
}

/** `save [<сообщение>…]`: слова склеиваются через пробел (П8.46); без слов — `WIP on …` (П8.45). */
function saveWords(state: AppendixState, words: readonly string[]): Outcome {
  if (words.some((w) => w.startsWith('-') || w === '')) return refuse(state, ae.form('stash', ['save', ...words].join(' '), ru.appendix.allowed.stash))
  if (words.length === 0) return save(state, null)
  const message = words.join(' ')
  if (!isPlainMessage(message)) return refuse(state, ae.stashMessageForm)
  return save(state, message)
}

// ---------- список и очистка ----------

function list(state: AppendixState): Outcome {
  if (state.stashes.length === 0) return exited(state, '', 0, ax.stashListEmpty)
  const label = stashLabel(state.head)
  const elsewhere = state.stashes.some((s) => s.branch !== label)
  const explanation = elsewhere ? `${ax.stashListed} ${ax.stashListOtherBranch}` : ax.stashListed
  return exited(state, state.stashes.map((s, i) => `stash@{${i}}: ${s.text}`).join('\n'), 0, explanation)
}

// ---------- apply, pop, drop ----------

function drop(state: AppendixState, token: string | undefined): Outcome {
  const ref = resolveStashRef(state, 'drop', token)
  if (!ref.ok) return ref.outcome
  const entry = state.stashes[ref.position]
  // Неслитый путь `drop` не трогает (К16.2).
  return exited(removeStash(state, ref.position), `Dropped ${ref.label} (${entry.id})`, 0, hasUnmerged(state) ? `${ax.stashDropped} ${ru.conflicts.stashDropKeepsUnmerged}` : ax.stashDropped)
}

function applyOrPop(state: AppendixState, token: string | undefined, pop: boolean): Outcome {
  const command = pop ? 'pop' : 'apply'
  const ref = resolveStashRef(state, command, token)
  if (!ref.ok) return ref.outcome
  const entry: AppendixStash = state.stashes[ref.position]
  // Неслитые пути запрещают применение (К4.2, К16.c); операция без неслитых путей: ответ git зависит от содержимого тайника и не сверен.
  const refused = refusalOutcome(state, { name: pop ? 'stash-pop' : 'stash-apply' })
  if (refused !== null) return refused
  if (state.operation !== null) return conflictForm(state, `stash ${command}`)
  const plan = planApply(state, entry)

  if (plan.kind === 'unverified') return refuse(state, ae.stashUnverified(command))
  if (plan.kind === 'conflictKind') return refuse(state, ae.stashConflictKind(command, plan.files))

  if (plan.kind === 'conflict') {
    // Конфликт: тайник применён с метками, остаётся в стопке и при pop (К4.1, К4.5, К4.6); миссию 4 не засчитывает.
    const merge = plan.merge
    const entered = enterConflict(state, merge, { top: 'Updated upstream', bottom: 'Stashed changes' })
    const status = statusAfter(entered)
    if (!status.ok) return refuse(state, status.refusal)
    const files = merge.conflicts.map((c) => c.file)
    const lines = [conflictOutput({ command: 'stash', merge }), status.text, ...(pop ? [KEPT] : [])]
    return exited(entered, lines.join('\n'), 1, pop ? ru.conflicts.stashPopConflict(files) : ru.conflicts.stashApplyConflict(files))
  }

  if (plan.kind === 'localChanges' || plan.kind === 'untracked') {
    const status = statusAfter(state)
    if (!status.ok) return refuse(state, status.refusal)
    const head =
      plan.kind === 'localChanges'
        ? ['error: Your local changes to the following files would be overwritten by merge:', ...plan.files.map((f) => `\t${f}`), 'Please commit your changes or stash them before you merge.', 'Aborting']
        : ['error: The following untracked working tree files would be overwritten by merge:', ...plan.files.map((f) => `\t${f}`), 'Please move or remove them before you merge.', 'Aborting']
    return exited(state, [...head, status.text, ...(pop ? [KEPT] : [])].join('\n'), 1, plan.kind === 'localChanges' ? ax.stashRefusedEdit : ax.stashRefusedUntracked)
  }

  const applied: AppendixState = { ...state, index: plan.index, working: plan.working }
  const status = statusAfter(applied)
  if (!status.ok) return refuse(state, status.refusal)
  const notes = [pop ? ax.stashPopped : ax.stashApplied]
  if (stagingLost(state, entry, plan.index)) notes.push(ax.stashIndexLost)
  if (entry.branch !== stashLabel(state.head)) notes.push(ax.stashOtherBranch(entry.branch, stashLabel(state.head)))
  const marked = markMission(pop ? removeStash(applied, ref.position) : applied, 'stashRestore')
  const lines = pop ? [status.text, `Dropped ${ref.label} (${entry.id})`] : [status.text]
  return exited(marked, lines.join('\n'), 0, notes.join(' '))
}

// ---------- разбор ----------

export function handleStash(state: AppendixState, args: readonly string[]): Outcome {
  const [sub, ...rest] = args
  const tooMany = () => refuse(state, ae.form('stash', args.join(' '), ru.appendix.allowed.stash))
  if (sub === undefined) return pushWith(state, [], true)
  // `--abort` у тайника нет (К4.2): ключ неизвестен, ответ не зависит от состояния.
  if (sub === 'pop' && rest.length === 1 && rest[0] === '--abort') return exited(state, POP_ABORT_USAGE, 129, ru.conflicts.stashAbort)
  if (sub === '--abort' && rest.length === 0) return exited(state, STASH_ABORT_USAGE, 129, ru.conflicts.stashAbort)
  switch (sub) {
    case 'push':
      return pushWith(state, rest, false)
    case 'save':
      return saveWords(state, rest)
    case 'list':
      return rest.length > 0 ? tooMany() : list(state)
    case 'clear':
      return rest.length > 0 ? tooMany() : exited({ ...state, stashes: [] }, '', 0, ax.stashCleared)
    case 'apply':
    case 'pop':
    case 'drop':
      if (rest.length > 1) return tooMany()
      return sub === 'drop' ? drop(state, rest[0]) : applyOrPop(state, rest[0], sub === 'pop')
  }
  if (REAL_SUBCOMMANDS.has(sub)) return tooMany()
  // Ключ или слово, которое не подкоманда: неявный `push` (П8.46).
  return pushWith(state, args, true)
}
