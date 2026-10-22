// ============================================================
// Раздел 8 git-тренажёра, шаг C (часть 2): rebase, который останавливается на конфликте, и его выходы `--continue`, `--skip`,
// `--abort` (target.md, часть X, места 16–19, «Движок»; часть XI, «Раздел 8 (часть X): шаг C», «Как завершить», «Как отменить и
// пропустить»; часть XII, «rebase посреди работы», «reflog: записи»). Прогоны: conflicts-git-runs.txt (К6.1–К6.7, К7.5–К7.8, К14.1–К14.3),
// section8-git-runs.txt (П8.11), detached-head-git-runs.txt (О10).
//
// Состояние посреди rebase: HEAD отсоединён и стоит на последней перенесённой копии (или на новой базе, пока ничего не перенесено), ветка
// остаётся на старом месте до конца (место 11). Данные rebase лежат в `state.operation` (`RebaseOperation`, conflicts.ts): ветка, исходный
// конец, база, сделанные и оставшиеся шаги, признаки «запись о коммите осталась» и «коммит сделан посреди». Неслитые пути — в `state.unmerged`.
//
// Остановка (К6.1, К14.3): вывод `Auto-merging`, `CONFLICT`, `error: could not apply`, пять строк `hint:`, `Could not apply`; код 1; записи
// журнала `rebase (start)` и `rebase (pick)` на уже перенесённые копии. Сверены остановки с числом шагов «сделан один, остался один»,
// «сделан один, не осталось», «сделано два, не осталось»; остальное (и остановка вместе с пропущенными применёнными коммитами, и конфликт
// вида «изменение и удаление») — отказ области до изменений.
//
// - `--continue` (К6.3, К7.5, К14.3): при неслитых путях `<файл>: needs merge`, код 1 (К6.2). Иначе из индекса делается коммит с сообщением
//   исходного коммита (`[detached HEAD <id7>] <тема>`, запись `rebase (continue): <тема>`); итог, совпавший с HEAD, молча выбрасывает коммит
//   (К6.5); после `git commit`, `git reset` или `git reset --hard` посреди остановки (запись о коммите ушла) коммита нет (К6.4, К7.8, К14.1).
//   Дальше переносятся оставшиеся (запись `rebase (pick)`), ветка переезжает на последний коммит, запись `rebase (finish)`, итоговая строка.
// - `--skip` (К6.5, К7.6, К14.2): индекс и файлы возвращаются к HEAD, остановленный коммит пропадает, остальное переносится.
// - `--abort` (К6.6, К7.7, П8.11, О10): пусто, HEAD снова на ветке, файлы и индекс как у исходного конца ветки, запись `rebase (abort)`.
// Отказы области: второй конфликт при переносе после `--continue` или `--skip`, коммит, ставший пустым при переносе, неотслеживаемый
// файл на пути файла результата, неподготовленная правка при `--continue`, `--skip` после `git commit` посреди, HEAD на другой ветке
// (после `git checkout -b` посреди rebase).
// ============================================================
import type { AppendixCommit, AppendixState, FileTree, ReflogEntry } from './appendixTypes'
import { exited, refuse, type Outcome } from './appendixOutcome'
import { conflictForm, refusalOutcome } from './appendixConflicts'
import { markMission } from './appendixMissions'
import { mergeTrees } from './branchRepo'
import type { TreeMergeResult } from './branchRepo'
import { commitOf, commitTree, currentCommitId, fadedCommitIds, headTree, sameTree } from './appendixRepo'
import { abortTo, conflictOutput, enterConflict, type RebaseOperation, type RebaseStep } from './conflicts'
import { fullCommitId, shortCommitId } from './sectionsCommon'
import { has } from './util'
import { ru } from '../locales/ru'

const ae = ru.appendix.errors
const ax = ru.appendix.explain
const rc = ru.conflicts

const subjectLine = (message: string): string => message.split('\n')[0]

export function plural(count: number): string {
  return count % 10 === 1 && count % 100 !== 11 ? 'коммит' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20) ? 'коммита' : 'коммитов'
}

/** Неподготовленные правки: отслеживаемый (есть в индексе) файл в рабочем каталоге изменён или удалён. */
export function hasUnstaged(state: AppendixState): boolean {
  return Object.keys(state.index).some((path) => !has(state.working, path) || state.working[path] !== state.index[path])
}

/** Неотслеживаемые файлы рабочего каталога (нет ни в индексе, ни среди неслитых): шаги rebase их не трогают. */
function untrackedFiles(state: AppendixState): FileTree {
  const out: FileTree = {}
  for (const path of Object.keys(state.working)) if (!has(state.index, path) && !has(state.unmerged, path)) out[path] = state.working[path]
  return out
}

// ---------- перенос одного коммита ----------

export type PickResult =
  | { kind: 'ok'; copy: AppendixCommit }
  | { kind: 'conflict'; merged: TreeMergeResult; before: FileTree }
  | { kind: 'empty' }

/**
 * Копия `commit` поверх `parent` с деревом `tree`: трёхстороннее слияние (база — дерево родителя исходного коммита). `conflict` —
 * правки пересеклись, `empty` — изменение коммита уже есть в `tree`.
 */
export function pickOnto(commit: AppendixCommit, before: FileTree, parent: string, tree: FileTree, clock: number): PickResult {
  const merged = mergeTrees(before, tree, commit.tree)
  if (merged.conflicts.length > 0) return { kind: 'conflict', merged, before }
  if (sameTree(merged.tree, tree)) return { kind: 'empty' }
  return { kind: 'ok', copy: { id: fullCommitId(commit.message, merged.tree, [parent], clock), parents: [parent], message: commit.message, tree: { ...merged.tree }, clock } }
}

// ---------- остановка на конфликте ----------

export interface StopInput {
  /** Состояние до начала rebase. */
  state: AppendixState
  branch: string
  /** Новая база (полный id). */
  upstream: string
  /** Запись журнала `rebase (start): checkout <база как введена>`. */
  startMessage: string
  /** Коммиты, которые переносятся, от старого к новому; конфликт на `picked[at]`. */
  picked: readonly AppendixCommit[]
  at: number
  /** Сколько применённых раньше коммитов git пропустил бы. */
  skipped: number
  /** Копии, уже сделанные до остановки. */
  created: readonly AppendixCommit[]
  merged: TreeMergeResult
  before: FileTree
  /** Дерево под HEAD в момент остановки (последняя копия или база). */
  tree: FileTree
}

/** Сочетания «сделано / осталось», которые `git status` посреди rebase печатает по прогонам: (1, 1) П8.11, (1, 0) К3.5, (2, 0) К14.3. */
function verifiedShape(done: number, left: number): boolean {
  return (done === 1 && left <= 1) || (done === 2 && left === 0)
}

/**
 * Остановка на конфликте (К6.1, К14.3). Вызывается, когда перенос `picked[at]` дал конфликт. Отказ области, если форма не сверена
 * прогонами; ничего не меняется.
 */
export function stopOnConflict(input: StopInput): Outcome {
  const { state, picked, at, merged, created } = input
  const commit = picked[at]
  const otherKinds = merged.conflicts.filter((c) => c.kind !== 'content' && c.kind !== 'add-add').map((c) => c.file)
  if (otherKinds.length > 0) return refuse(state, ae.rebaseConflictKind(otherKinds))
  if (input.skipped > 0 || !verifiedShape(at + 1, picked.length - at - 1)) return refuse(state, ae.rebaseStopUnverified)

  // Неотслеживаемый файл на пути файла результата: ответ git не сверен.
  const untracked = untrackedFiles(state)
  const touched = new Set([...Object.keys(input.tree), ...Object.keys(merged.tree), ...Object.keys(commit.tree), ...merged.conflicts.map((c) => c.file)])
  const clash = Object.keys(untracked).find((path) => touched.has(path))
  if (clash !== undefined) return refuse(state, ae.rebaseUntracked(clash))

  const commits = { ...state.commits }
  for (const copy of created) commits[copy.id] = copy
  const parent = created.length > 0 ? created[created.length - 1].id : input.upstream
  const steps: RebaseStep[] = picked.map((c) => ({ id: c.id, subject: subjectLine(c.message) }))
  const operation: RebaseOperation = {
    kind: 'rebase',
    branch: input.branch,
    origHead: currentCommitId(state),
    onto: input.upstream,
    done: steps.slice(0, at + 1),
    todo: steps.slice(at + 1),
    mergeMsg: true,
    committed: false,
  }
  const entries: ReflogEntry[] = [...[...created].reverse().map((c) => ({ id: c.id, message: `rebase (pick): ${subjectLine(c.message)}` })), { id: input.upstream, message: input.startMessage }]
  const stopped: AppendixState = {
    ...state,
    commits,
    head: { kind: 'detached', id: parent },
    index: { ...input.tree },
    working: { ...untracked, ...input.tree },
    unmerged: {},
    operation,
    reflog: [...entries, ...state.reflog],
    clock: state.clock + created.length,
  }
  const subject = subjectLine(commit.message)
  const entered = enterConflict(stopped, { ...merged, base: input.before, ours: input.tree, theirs: commit.tree }, { top: 'HEAD', bottom: `${shortCommitId(commit.id)} (${subject})` })
  const output = conflictOutput({ command: 'rebase', merge: merged, commit: { id: commit.id, subject } })
  return exited(entered, output, 1, rc.rebaseConflict(merged.conflicts.map((c) => c.file), input.branch))
}

// ---------- конец rebase: перенос остального ----------

interface Progress {
  commits: Record<string, AppendixCommit>
  parent: string
  tree: FileTree
  clock: number
  /** Записи журнала в порядке событий (старая первой). */
  entries: ReflogEntry[]
  /** Строки вывода до итоговой. */
  lines: string[]
}

/** Переносит оставшиеся шаги, переставляет ветку, пишет `rebase (finish)`. Форма, которой нет в прогонах, — отказ области без изменений. */
function finish(state: AppendixState, op: RebaseOperation, progress: Progress, notes: string[]): Outcome {
  let { parent, tree, clock } = progress
  const commits = { ...progress.commits }
  const entries = [...progress.entries]
  for (const step of op.todo) {
    const commit = commitOf(state, step.id)
    const picked = pickOnto(commit, commitOf(state, commit.parents[0]).tree, parent, tree, clock)
    if (picked.kind === 'conflict') return refuse(state, ae.rebaseNextConflict(step.subject))
    if (picked.kind === 'empty') return refuse(state, ae.rebaseEmpty(step.subject))
    commits[picked.copy.id] = picked.copy
    entries.push({ id: picked.copy.id, message: `rebase (pick): ${step.subject}` })
    parent = picked.copy.id
    tree = picked.copy.tree
    clock++
  }
  const untracked = untrackedFiles(state)
  const clash = Object.keys(untracked).find((path) => has(tree, path))
  if (clash !== undefined) return refuse(state, ae.rebaseUntracked(clash))

  entries.push({ id: parent, message: `rebase (finish): returning to refs/heads/${op.branch}` })
  const next: AppendixState = {
    ...state,
    commits,
    branches: { ...state.branches, [op.branch]: parent },
    head: { kind: 'branch', name: op.branch },
    index: { ...tree },
    working: { ...untracked, ...tree },
    unmerged: {},
    operation: null,
    reflog: [...[...entries].reverse(), ...state.reflog],
    clock,
  }
  const left = [...fadedCommitIds(next)].filter((id) => !fadedCommitIds(state).has(id)).length
  if (left > 0) notes.push(ax.rebaseLeftBehind(left, plural(left)))
  const output = [...progress.lines, `Successfully rebased and updated refs/heads/${op.branch}.`].join('\n')
  return exited(markMission(next, 'rebase'), output, 0, notes.join(' '))
}

function continueRebase(state: AppendixState, op: RebaseOperation): Outcome {
  const blocked = refusalOutcome(state, { name: 'rebase-continue' })
  if (blocked !== null) return blocked
  // Неподготовленная правка при `--continue`: как отвечает git, не сверено.
  if (hasUnstaged(state)) return conflictForm(state, 'rebase --continue')
  const head = headTree(state)
  const progress: Progress = { commits: { ...state.commits }, parent: currentCommitId(state), tree: head, clock: state.clock, entries: [], lines: [] }
  const notes: string[] = []
  if (!op.mergeMsg) {
    // Запись о коммите ушла (после `git commit`, `git reset`, `git reset --hard`): `--continue` ничего не коммитит, а индекс с изменениями — форма вне прогонов.
    if (!sameTree(state.index, head)) return conflictForm(state, 'rebase --continue')
    notes.push(op.committed ? rc.rebaseContinuedCommitted : rc.rebaseContinuedIdle)
  } else {
    const stopped = op.done[op.done.length - 1]
    if (sameTree(state.index, head)) {
      // Итог совпал с HEAD: коммит молча выбрасывается (К6.5).
      notes.push(rc.rebaseDropped(stopped.subject))
    } else {
      const message = commitOf(state, stopped.id).message
      const tree = { ...state.index }
      const copy: AppendixCommit = { id: fullCommitId(message, tree, [progress.parent], progress.clock), parents: [progress.parent], message, tree, clock: progress.clock }
      progress.commits[copy.id] = copy
      progress.entries.push({ id: copy.id, message: `rebase (continue): ${subjectLine(message)}` })
      progress.lines.push(`[detached HEAD ${shortCommitId(copy.id)}] ${subjectLine(message)}`)
      progress.parent = copy.id
      progress.tree = tree
      progress.clock++
      notes.push(rc.rebaseContinued(subjectLine(message)))
    }
  }
  return finish(state, op, progress, notes)
}

function skipRebase(state: AppendixState, op: RebaseOperation): Outcome {
  // После `git commit` посреди остановки пропуск оставил бы сделанный коммит: форма вне прогонов.
  if (op.committed) return conflictForm(state, 'rebase --skip')
  const head = headTree(state)
  const stopped = op.done[op.done.length - 1]
  const reset: AppendixState = { ...state, index: { ...head }, working: { ...untrackedFiles(state), ...head }, unmerged: {} }
  const progress: Progress = { commits: { ...state.commits }, parent: currentCommitId(state), tree: head, clock: state.clock, entries: [], lines: [] }
  const out = finish(reset, op, progress, [rc.rebaseSkipped(stopped.subject)])
  // Отказ области возвращает состояние до сброса: ничего не меняется.
  return out.result.exitCode === undefined ? { state, result: out.result } : out
}

function abortRebase(state: AppendixState, op: RebaseOperation): Outcome {
  const tree = commitTree(state, op.origHead)
  const head = headTree(state)
  const aborted = abortTo(state, tree)
  // Как `reset --hard` к исходному концу: отслеживаемые файлы целиком к дереву, неотслеживаемые остаются.
  const working: FileTree = { ...aborted.working }
  for (const path of Object.keys(aborted.index)) working[path] = aborted.index[path]
  const edited = [...new Set([...Object.keys(state.index), ...Object.keys(state.unmerged)])]
    .filter((path) => !has(head, path) || state.working[path] !== head[path] || (has(state.index, path) ? state.index[path] !== head[path] : true))
    .sort()
  const next: AppendixState = {
    ...aborted,
    working,
    head: { kind: 'branch', name: op.branch },
    reflog: [{ id: op.origHead, message: `rebase (abort): returning to refs/heads/${op.branch}` }, ...state.reflog],
  }
  const notes = [rc.rebaseAborted(op.branch)]
  if (edited.length > 0) notes.push(rc.discardedEdit(edited))
  return exited(next, '', 0, notes.join(' '))
}

/**
 * `git rebase --continue`, `--skip`, `--abort`. Когда rebase не идёт: `--continue` и `--abort` — `fatal: no rebase in progress` (К6.3, К6.7),
 * `--skip` — отказ области. Когда HEAD ушёл на другую ветку (после `git checkout -b` посреди rebase), как git ответил бы, не сверено.
 */
export function rebaseStep(state: AppendixState, flag: '--continue' | '--skip' | '--abort'): Outcome {
  const op = state.operation
  if (op === null || op.kind !== 'rebase') return flag === '--skip' ? refuse(state, ae.rebaseSkipIdle) : (refusalOutcome(state, { name: 'rebase-step' }) as Outcome)
  if (state.head.kind !== 'detached') return conflictForm(state, `rebase ${flag}`)
  return flag === '--continue' ? continueRebase(state, op) : flag === '--skip' ? skipRebase(state, op) : abortRebase(state, op)
}
