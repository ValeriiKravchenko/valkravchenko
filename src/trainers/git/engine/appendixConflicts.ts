// ============================================================
// Раздел 8 git-тренажёра, шаг C: связка команд раздела с общим модулем конфликтов
// (conflicts.ts; target.md, часть XI). Здесь то, что знает модель раздела (HEAD, ветки, ссылки),
// а модуль конфликтов не знает: `git status` с неслитыми путями и заголовком операции, отказы git
// посреди конфликта как исход команды, отказ области для форм, которых нет в протоколе, и виды для
// экрана (`getConflictFiles`, `chooseConflictPart`, `getConflictView`).
//
// Прогоны: docs/git-trainer/reports/conflicts-git-runs.txt (К4, К5, К6, К10–К14, К16) и
// section8-git-runs.txt (П8.4, П8.11). Вывод git — английские литералы из модуля конфликтов; речь лежит в
// ru.conflicts и ru.appendix.errors.
// ============================================================
import type { AppendixState, FileTree, HistoryEntry } from './appendixTypes'
import { exited, refuse, type Outcome } from './appendixOutcome'
import { compareBytes } from './appendixRefs'
import { headTree, refsOf } from './appendixRepo'
import { editorChoice, markerBlocks, refusal, shortCode, statusBlock, type ConflictKind, type RefusedCommand } from './conflicts'
import { statusFirstLine, type OperationInput } from './detachedHead'
import { formatStatusWithCommits, type CommitStatusResult } from './sectionsCommon'
import { has } from './util'
import { ru } from '../locales/ru'

const ae = ru.appendix.errors
const rc = ru.conflicts

export const hasUnmerged = (state: AppendixState): boolean => Object.keys(state.unmerged).length > 0

/** Идёт конфликт или незаконченная операция. */
export const inConflict = (state: AppendixState): boolean => hasUnmerged(state) || state.operation !== null

/** Идёт rebase (не обязательно с неслитыми путями). */
export const isRebasing = (state: AppendixState): boolean => state.operation !== null && state.operation.kind === 'rebase'

/** Операция в виде, который читают `statusFirstLine` и `branchListFirstLine` (detachedHead.ts): только rebase меняет первую строку. */
export function operationInput(state: AppendixState): OperationInput {
  const operation = state.operation
  return operation !== null && operation.kind === 'rebase' ? { kind: 'rebase', branch: operation.branch } : null
}

/** Отказ области для формы, которой нет в протоколе (посреди незаконченной операции или конфликта). */
export function conflictForm(state: AppendixState, form: string): Outcome {
  return refuse(state, ae.conflictForm(form))
}

/** Отказ git посреди конфликта (таблица «Что запрещено») как исход команды; `null`, если команда проходит. */
export function refusalOutcome(state: AppendixState, command: RefusedCommand): Outcome | null {
  const found = refusal(command, state)
  return found === null ? null : exited(state, found.output, found.exitCode)
}

// ---------- git status ----------

export type StateStatus = CommitStatusResult | { ok: false; reason: 'unmergedUntracked' }

/** Текст отказа области, когда статус не воспроизводится. */
export function statusRefusal(reason: Extract<StateStatus, { ok: false }>['reason'], command: string): string {
  if (reason === 'renameDetection') return ae.renameDetection(command)
  if (reason === 'unmergedUntracked') return ae.conflictUntrackedStatus(command)
  return ae.statusNestedPaths
}

function without(tree: FileTree, paths: readonly string[]): FileTree {
  const out: FileTree = { ...tree }
  for (const path of paths) delete out[path]
  return out
}

const RESTORE_STAGED_HINT = '  (use "git restore --staged <file>..." to unstage)'
const NO_CHANGES_ADDED = 'no changes added to commit (use "git add" and/or "git commit -a")'

/**
 * `git status` и `git status --short` раздела с учётом конфликта. Без неслитых путей и операции — то
 * же, что `formatStatusWithCommits`. Иначе остальной статус строит эта функция для путей без
 * неслитых, а заголовок операции, раздел `Unmerged paths:` и коды `UU`/`AA` добавляет `statusBlock`
 * (К4.1, К4.6, К5.1, К5.4, К5.6): порядок частей — заголовок, подготовленное, неслитые, неподготовленное,
 * неотслеживаемое, итоговая строка. Неслитый путь подготовленным не считается, и при отсутствии
 * подготовленного итог — `no changes added to commit` (К4.1, К5.1). Неслитые пути вместе с
 * неотслеживаемым файлом без подготовленного прогонами не сверены: результат `unmergedUntracked`.
 */
export function stateStatus(state: AppendixState, short: boolean): StateStatus {
  // `null`, когда HEAD отсоединён и идёт rebase: первой строкой стоит заголовок rebase (П8.11).
  const first = statusFirstLine(state.head, state.lastCheckout, refsOf(state), operationInput(state))
  const parts = statusBlock(state, { headOnBranch: state.head.kind === 'branch' })
  if (parts.header.length === 0 && parts.unmerged.length === 0) return formatStatusWithCommits(first as string, headTree(state), state.index, state.working, { short })

  const hidden = Object.keys(state.unmerged)
  const lead = first === null ? '' : `${first}\n`
  const base = formatStatusWithCommits(first ?? '', without(headTree(state), hidden), state.index, without(state.working, hidden), { short })
  if (!base.ok) return base

  if (short) {
    const rows = base.output === '' ? [] : base.output.split('\n')
    const untracked = rows.filter((r) => r.startsWith('?? '))
    const tracked = [...rows.filter((r) => !r.startsWith('?? ')), ...parts.short.map(({ path, code }) => `${code} ${path}`)].sort((a, b) => compareBytes(a.slice(3), b.slice(3)))
    return { ok: true, output: [...tracked, ...untracked].join('\n') }
  }

  const stagedExists = base.output.endsWith('\n')
  const blocks = base.output
    .slice((first ?? '').length + 1)
    .replace(/\n$/, '')
    .split('\n\n')
  const isSummary = (b: string) => /^(no changes added to commit|nothing added to commit|nothing to commit)/.test(b)
  let staged = blocks.find((b) => b.startsWith('Changes to be committed:'))
  if (staged !== undefined && !parts.restoreStagedHint) staged = staged.split('\n').filter((line) => line !== RESTORE_STAGED_HINT).join('\n')
  const others = blocks.filter((b) => !b.startsWith('Changes to be committed:') && !isSummary(b))
  let summary = blocks.find(isSummary)
  if (parts.unmerged.length > 0 && staged === undefined && summary !== undefined) {
    if (summary.startsWith('nothing added to commit')) return { ok: false, reason: 'unmergedUntracked' }
    summary = NO_CHANGES_ADDED
  }
  const list = [parts.header.join('\n'), staged, parts.unmerged.join('\n'), ...others, summary].filter((b): b is string => b !== undefined && b !== '')
  return { ok: true, output: `${lead}${list.join('\n\n')}${stagedExists ? '\n' : ''}` }
}

// ---------- виды для экрана ----------

export interface ConflictFileView {
  path: string
  /** Вид конфликта; `null`, если путь уже добавлен (`git add`), а метки в файле остались. */
  kind: ConflictKind | null
  /** Подпись верхней части блока меток: `HEAD`, `Updated upstream`. */
  topLabel: string
  /** Подпись нижней части: `<id7> (<тема>)`, `Stashed changes`. */
  bottomLabel: string
}

/** Файлы рабочего каталога с блоками меток, по алфавиту путей. Подписи берутся из первого блока файла. */
export function conflictFiles(state: AppendixState): ConflictFileView[] {
  const out: ConflictFileView[] = []
  for (const path of Object.keys(state.working).sort(compareBytes)) {
    const blocks = markerBlocks(state.working[path])
    if (blocks.length === 0) continue
    out.push({ path, kind: has(state.unmerged, path) ? state.unmerged[path].kind : null, topLabel: blocks[0].top, bottomLabel: blocks[0].bottom })
  }
  return out
}

/**
 * Кнопки редактора: меняет только рабочую версию файла (`editorChoice`), `index` и `unmerged` остаются
 * (К1.4: `UU` и после правки). В журнал терминала — заметка тренажёра. Файл без блоков меток — состояние не меняется.
 */
export function choosePart(state: AppendixState, path: string, part: 'top' | 'bottom' | 'both'): AppendixState {
  if (!has(state.working, path)) return state
  const blocks = markerBlocks(state.working[path])
  if (blocks.length === 0) return state
  const finish = state.operation === null ? rc.finishStash : state.operation.kind === 'rebase' ? rc.finishRebase : rc.finishCherryPick
  const entry: HistoryEntry = { kind: 'note', text: rc.choiceNote(part, path, blocks[0].top, blocks[0].bottom, finish) }
  return { ...state, working: { ...state.working, [path]: editorChoice(state.working[path], part) }, history: [...state.history, entry] }
}

type ViewKey = Extract<
  keyof typeof ru.conflicts,
  'cherryPickFinish' | 'cherryPickFinishAdded' | 'cherryPickAbort' | 'rebaseFinish' | 'rebaseFinishAdded' | 'rebaseAbort' | 'stashFinish' | 'stashAbort' | 'kindBothModified' | 'kindBothAdded'
>

export interface ConflictView {
  /** Идущая операция; `null` у тайника. */
  operation: 'cherry-pick' | 'rebase' | null
  /** Только у rebase: HEAD здесь — новая база (верхняя часть блока меток), а свой коммит — нижняя (К6.1). Для речи рядом с кнопками. */
  headIsNewBase: boolean
  /** Неслитые пути по алфавиту: вид, код `git status --short` и ключ подписи вида в `ru.conflicts`. */
  unmerged: { path: string; kind: ConflictKind; code: 'UU' | 'AA'; kindKey: ViewKey }[]
  /** Операция идёт, неслитых нет (после `git add` всех путей). */
  allAdded: boolean
  /** Ключи `ru.conflicts` со строкой «чем завершить» и «чем отменить»: текст рамки пишет экран. */
  finishKey: ViewKey
  abortKey: ViewKey
}

/** `null`, если неслитых путей нет и операция не идёт. */
export function conflictView(state: AppendixState): ConflictView | null {
  if (!inConflict(state)) return null
  const paths = Object.keys(state.unmerged).sort(compareBytes)
  const allAdded = paths.length === 0
  const operation = state.operation === null ? null : state.operation.kind
  return {
    operation,
    headIsNewBase: operation === 'rebase',
    unmerged: paths.map((path) => ({ path, kind: state.unmerged[path].kind, code: shortCode(state.unmerged[path]), kindKey: state.unmerged[path].kind === 'both-added' ? 'kindBothAdded' : 'kindBothModified' })),
    allAdded,
    finishKey: operation === 'rebase' ? (allAdded ? 'rebaseFinishAdded' : 'rebaseFinish') : operation === 'cherry-pick' ? (allAdded ? 'cherryPickFinishAdded' : 'cherryPickFinish') : 'stashFinish',
    abortKey: operation === 'rebase' ? 'rebaseAbort' : operation === 'cherry-pick' ? 'cherryPickAbort' : 'stashAbort',
  }
}
