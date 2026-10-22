// ============================================================
// Конфликты: общий модуль разделов (target.md, часть XI, «Общий модуль движка»). Конфликт у git
// это два независимых состояния: неслитые пути (`unmerged`: у пути нет обычной записи индекса)
// и незаконченная операция (`operation`: у cherry-pick это CHERRY_PICK_HEAD). У тайника операции
// нет, неслитые пути есть.
//
// Модуль не знает состояния конкретного раздела: функции берут узкий вход `ConflictState`
// (индекс, рабочий каталог, `unmerged`, `operation`) и возвращают новое значение того же типа.
// Чистые функции: DOM, таймеров, сети, глобального состояния нет. Вывод git — английские
// литералы из docs/git-trainer/reports/conflicts-git-runs.txt (К1–К19), не переводятся и в
// словарь не идут; речь о конфликте лежит в ru.conflicts.
//
// Что реализовано сейчас: операции `cherry-pick` и `rebase`, тайник (операции нет), виды конфликта
// `both-modified` (UU) и `both-added` (AA). Тип `ConflictOperation` — объединение по `kind`:
// остальные операции (позже merge и revert) добавляются новыми ветками объединения, а
// функции модуля расширяются по `kind`. Ответ git на конфликт, которого здесь нет (модификация
// и удаление, `merge`, `revert`), модуль не выдумывает: вызывающая команда обязана отказать
// областью раньше (`enterConflict` на таком конфликте бросает исключение — нарушение условия вызова).
// ============================================================
import type { FileTree } from './types'
import { computeHunks, hunksOverlap, mergeFileContent } from './branchRepo'
import type { TreeMergeResult } from './branchRepo'
import { shortCommitId } from './sectionsCommon'
import { has } from './util'

// ---------- типы ----------

/** Вид конфликта: `both-modified` (UU) — оба изменили, `both-added` (AA) — оба создали. */
export type ConflictKind = 'both-modified' | 'both-added'

/** Неслитый путь: три версии файла (стадии 1, 2, 3 индекса). У `both-added` базы нет. */
export interface UnmergedEntry {
  kind: ConflictKind
  base?: string
  ours?: string
  theirs?: string
}

/** Шаг rebase: коммит исходной ветки (полный id) и его тема. Строки `pick <id7> # <тема>` в `git status` называют исходные коммиты, а не копии. */
export interface RebaseStep {
  id: string
  subject: string
}

/**
 * Идущий rebase (К6.1, П8.11). `branch` — ветка, с которой он начат (она остаётся на старом месте до конца), `origHead` — её
 * исходный конец (туда возвращает `--abort`), `onto` — новая база. `done` — шаги, уже начатые (последний — тот, на котором остановка),
 * `todo` — оставшиеся. `mergeMsg` — осталась подготовленная после конфликта запись о коммите: пока она есть, `git status` пишет
 * «all conflicts fixed», после `git commit`, `git reset` и `git reset --hard` её нет и git пишет «editing a commit» (К6.4, К6.6, К10.b).
 * `committed` — посреди остановки уже сделан коммит (К6.4, К11.b).
 */
export interface RebaseOperation {
  kind: 'rebase'
  branch: string
  origHead: string
  onto: string
  done: RebaseStep[]
  todo: RebaseStep[]
  mergeMsg: boolean
  committed: boolean
}

/**
 * Незаконченная операция. `cherry-pick` — копируемый коммит (полный id), `rebase` — см. `RebaseOperation`. Другие виды
 * добавляются новыми ветками объединения.
 */
export type ConflictOperation = { kind: 'cherry-pick'; commit: string } | RebaseOperation

/** То, что модуль читает и меняет в состоянии раздела. */
export interface ConflictState {
  /** Индекс: путь → содержимое. Неслитого пути в нём нет. */
  index: FileTree
  working: FileTree
  unmerged: Record<string, UnmergedEntry>
  operation: ConflictOperation | null
}

/** Подписи меток: верхняя часть (после `<<<<<<< `) и нижняя (после `>>>>>>> `). */
export interface ConflictLabels {
  top: string
  bottom: string
}

/** Итог слияния деревьев вместе с самими деревьями: `mergeTrees` не возвращает входы, а модулю они нужны. */
export interface ConflictMerge extends TreeMergeResult {
  base: FileTree
  ours: FileTree
  theirs: FileTree
}

// ---------- метки в файле ----------

type Hunk = ReturnType<typeof computeHunks>[number]

const MARK_TOP = '<<<<<<< '
const MARK_MIDDLE = '======='
const MARK_BOTTOM = '>>>>>>> '

function sameLines(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i])
}

/** Строки стороны на отрезке базы `[lo, hi)`: общие строки базы и вставки правок этой стороны. */
function regionOf(hunks: readonly Hunk[], baseLines: readonly string[], sideLines: readonly string[], lo: number, hi: number): string[] {
  const out: string[] = []
  let cursor = lo
  for (const h of hunks) {
    out.push(...baseLines.slice(cursor, h.bStart), ...sideLines.slice(h.start, h.end))
    cursor = h.bEnd
  }
  out.push(...baseLines.slice(cursor, hi))
  return out
}

export type FileMarkersResult = { conflict: false; content: string } | { conflict: true; content: string }

/**
 * Построчное слияние одного файла. Без конфликта результат совпадает с `mergeFileContent`. При
 * конфликте — текст с метками (К1.1, К3.1, К3.3, К5.1): пересекающиеся и соприкасающиеся правки
 * двух сторон образуют один блок, общие строки в начале и в конце сторон блока остаются вне меток,
 * правки, которые ни с чем не пересеклись, применяются. После строки `>>>>>>>` git ставит перевод
 * строки всегда; файлы раздела кончаются переводом строки, и в конце результата он есть.
 */
export function mergeFileWithMarkers(base: string, ours: string, theirs: string, labels: ConflictLabels): FileMarkersResult {
  const clean = mergeFileContent(base, ours, theirs)
  if (!clean.conflict) return { conflict: false, content: clean.content }

  const baseLines = base.split('\n')
  const oursLines = ours.split('\n')
  const theirsLines = theirs.split('\n')
  const tagged = [
    ...computeHunks(baseLines, oursLines).map((hunk) => ({ side: 'ours' as const, hunk })),
    ...computeHunks(baseLines, theirsLines).map((hunk) => ({ side: 'theirs' as const, hunk })),
  ].sort((a, b) => a.hunk.bStart - b.hunk.bStart || a.hunk.bEnd - b.hunk.bEnd)

  const clusters: (typeof tagged)[] = []
  let range: Hunk | null = null
  for (const item of tagged) {
    if (range !== null && hunksOverlap(range, item.hunk)) {
      clusters[clusters.length - 1].push(item)
      range = { bStart: range.bStart, bEnd: Math.max(range.bEnd, item.hunk.bEnd), start: 0, end: 0 }
    } else {
      clusters.push([item])
      range = { ...item.hunk }
    }
  }

  const out: string[] = []
  let cursor = 0
  let blocks = 0
  for (const cluster of clusters) {
    const lo = Math.min(...cluster.map((c) => c.hunk.bStart))
    const hi = Math.max(...cluster.map((c) => c.hunk.bEnd))
    out.push(...baseLines.slice(cursor, lo))
    cursor = hi
    const oursHunks = cluster.filter((c) => c.side === 'ours').map((c) => c.hunk)
    const theirsHunks = cluster.filter((c) => c.side === 'theirs').map((c) => c.hunk)
    const oursRegion = regionOf(oursHunks, baseLines, oursLines, lo, hi)
    const theirsRegion = regionOf(theirsHunks, baseLines, theirsLines, lo, hi)
    if (theirsHunks.length === 0) out.push(...oursRegion)
    else if (oursHunks.length === 0) out.push(...theirsRegion)
    else if (sameLines(oursRegion, theirsRegion)) out.push(...oursRegion)
    else {
      let head = 0
      while (head < oursRegion.length && head < theirsRegion.length && oursRegion[head] === theirsRegion[head]) head++
      let tail = 0
      while (tail < oursRegion.length - head && tail < theirsRegion.length - head && oursRegion[oursRegion.length - 1 - tail] === theirsRegion[theirsRegion.length - 1 - tail]) tail++
      out.push(
        ...oursRegion.slice(0, head),
        `${MARK_TOP}${labels.top}`,
        ...oursRegion.slice(head, oursRegion.length - tail),
        MARK_MIDDLE,
        ...theirsRegion.slice(head, theirsRegion.length - tail),
        `${MARK_BOTTOM}${labels.bottom}`,
        ...oursRegion.slice(oursRegion.length - tail),
      )
      blocks++
    }
  }
  out.push(...baseLines.slice(cursor))
  // Слияние потребовало настоящего конфликта, а блок не нашёлся: показываем весь файл одним блоком.
  if (blocks === 0) {
    return { conflict: true, content: `${MARK_TOP}${labels.top}\n${ours}${ours.endsWith('\n') ? '' : '\n'}${MARK_MIDDLE}\n${theirs}${theirs.endsWith('\n') ? '' : '\n'}${MARK_BOTTOM}${labels.bottom}\n` }
  }
  const text = out.join('\n')
  return { conflict: true, content: text.endsWith('\n') ? text : `${text}\n` }
}

/** Один блок меток в тексте: подписи и строки обеих частей. */
export interface MarkerBlock {
  top: string
  bottom: string
  topLines: string[]
  bottomLines: string[]
  /** Номера строк блока: от `<<<<<<<` до `>>>>>>>` включительно. */
  from: number
  to: number
}

/** Блоки меток в тексте по порядку. Незакрытый блок блоком не считается. */
export function markerBlocks(content: string): MarkerBlock[] {
  const lines = content.split('\n')
  const blocks: MarkerBlock[] = []
  let i = 0
  while (i < lines.length) {
    if (!lines[i].startsWith(MARK_TOP)) {
      i++
      continue
    }
    const middle = lines.findIndex((line, at) => at > i && line === MARK_MIDDLE)
    const bottom = middle < 0 ? -1 : lines.findIndex((line, at) => at > middle && line.startsWith(MARK_BOTTOM))
    if (bottom < 0) {
      i++
      continue
    }
    blocks.push({
      top: lines[i].slice(MARK_TOP.length),
      bottom: lines[bottom].slice(MARK_BOTTOM.length),
      topLines: lines.slice(i + 1, middle),
      bottomLines: lines.slice(middle + 1, bottom),
      from: i,
      to: bottom,
    })
    i = bottom + 1
  }
  return blocks
}

export type EditorChoice = 'top' | 'bottom' | 'both'

/**
 * Кнопки редактора (К1.4): каждый блок меток заменяется выбранной частью; «обе» — верхняя, за ней
 * нижняя, без меток. Текст вне блоков не меняется. `index` и `unmerged` функция не знает: это
 * правка текста.
 */
export function editorChoice(content: string, choice: EditorChoice): string {
  const lines = content.split('\n')
  const out: string[] = []
  let cursor = 0
  for (const block of markerBlocks(content)) {
    out.push(...lines.slice(cursor, block.from))
    if (choice !== 'bottom') out.push(...block.topLines)
    if (choice !== 'top') out.push(...block.bottomLines)
    cursor = block.to + 1
  }
  out.push(...lines.slice(cursor))
  return out.join('\n')
}

// ---------- вход в конфликт, разрешение, отмена ----------

function conflictKindOf(kind: 'content' | 'add-add' | 'modify-delete'): ConflictKind {
  if (kind === 'content') return 'both-modified'
  if (kind === 'add-add') return 'both-added'
  throw new Error('конфликт «модификация и удаление» модуль пока не знает: команда обязана отказать областью раньше')
}

/**
 * Вход в конфликт. Файлы, слитые без конфликта, ложатся и в индекс, и в рабочий каталог (К4.6:
 * `M  README.md`). Конфликтные файлы: в рабочем каталоге текст с метками, в индексе их нет, в
 * `unmerged` три версии. Коммитов не создаёт, ветку и HEAD не двигает, `operation` не ставит — это
 * делает команда раздела.
 */
export function enterConflict<S extends ConflictState>(state: S, merge: ConflictMerge, labels: ConflictLabels): S {
  const index = { ...state.index }
  const working = { ...state.working }
  const unmerged = { ...state.unmerged }
  const conflicting = new Set(merge.conflicts.map((c) => c.file))
  for (const path of new Set([...Object.keys(merge.tree), ...Object.keys(merge.ours)])) {
    if (conflicting.has(path)) continue
    const merged = has(merge.tree, path) ? merge.tree[path] : undefined
    const ours = has(merge.ours, path) ? merge.ours[path] : undefined
    if (merged === ours) continue
    if (merged === undefined) {
      delete index[path]
      delete working[path]
    } else {
      index[path] = merged
      working[path] = merged
    }
  }
  for (const { file, kind } of merge.conflicts) {
    const entryKind = conflictKindOf(kind)
    const base = has(merge.base, file) ? merge.base[file] : undefined
    const ours = merge.ours[file]
    const theirs = merge.theirs[file]
    const marked = mergeFileWithMarkers(base ?? '', ours, theirs, labels)
    working[file] = marked.content
    delete index[file]
    unmerged[file] = { kind: entryKind, ...(base === undefined ? {} : { base }), ours, theirs }
  }
  return { ...state, index, working, unmerged }
}

/** `git add <путь>` неслитого пути: запись уходит из `unmerged`, в индексе рабочая версия. Меток не проверяет (К1.7). */
export function markResolved<S extends ConflictState>(state: S, path: string): S {
  const index = { ...state.index }
  if (has(state.working, path)) index[path] = state.working[path]
  else delete index[path]
  const unmerged = { ...state.unmerged }
  delete unmerged[path]
  return { ...state, index, unmerged }
}

/**
 * Отмена операции: пути, которых она касалась (неслитые и те, где индекс отличается от `tree`), — и
 * в индексе, и в рабочем каталоге к дереву `tree`; `unmerged` пуст, операции нет. Прочие
 * неподготовленные правки остаются (К1.11, К19.1), подготовленная правка постороннего файла
 * возвращается к `tree` (К19.2). Ветку не двигает.
 */
export function abortTo<S extends ConflictState>(state: S, tree: FileTree): S {
  const index = { ...state.index }
  const working = { ...state.working }
  const paths = new Set([...Object.keys(state.index), ...Object.keys(tree), ...Object.keys(state.unmerged)])
  for (const path of paths) {
    const wanted = has(tree, path) ? tree[path] : undefined
    const current = has(state.index, path) ? state.index[path] : undefined
    if (!has(state.unmerged, path) && wanted === current) continue
    if (wanted === undefined) {
      delete index[path]
      delete working[path]
    } else {
      index[path] = wanted
      working[path] = wanted
    }
  }
  return { ...state, index, working, unmerged: {}, operation: null }
}

// ---------- вывод команды при конфликте ----------

function compareBytes(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

const REBASE_HINTS = [
  'hint: Resolve all conflicts manually, mark them as resolved with',
  'hint: "git add/rm <conflicted_files>", then run "git rebase --continue".',
  'hint: You can instead skip this commit: run "git rebase --skip".',
  'hint: To abort and get back to the state before "git rebase", run "git rebase --abort".',
  'hint: Disable this message with "git config set advice.mergeConflict false"',
]

const CHERRY_PICK_HINTS = [
  'hint: After resolving the conflicts, mark them with',
  'hint: "git add/rm <pathspec>", then run',
  'hint: "git cherry-pick --continue".',
  'hint: You can instead skip this commit with "git cherry-pick --skip".',
  'hint: To abort and get back to the state before "git cherry-pick",',
  'hint: run "git cherry-pick --abort".',
  'hint: Disable this message with "git config set advice.mergeConflict false"',
]

export interface ConflictOutputInput {
  /** Команда: `cherry-pick`, `rebase` или `stash` (pop и apply печатают одно и то же до статуса). */
  command: 'cherry-pick' | 'rebase' | 'stash'
  merge: Pick<TreeMergeResult, 'autoMerged' | 'conflicts'>
  /** Копируемый (переносимый) коммит для строки `error: could not apply` (у cherry-pick и rebase). */
  commit?: { id: string; subject: string }
}

/**
 * Вывод команды при конфликте до статуса и без кода возврата (он везде 1): по паре
 * `Auto-merging` и `CONFLICT` на путь в порядке байтов пути (К4.1, К5.1, К18.1), у cherry-pick
 * дальше `error: could not apply` и подсказки, у rebase — `error: could not apply`, другие подсказки и строка
 * `Could not apply <id7>... # <тема>` (К6.1, К14.3). Строки хода `Rebasing (k/n)` не печатаются. Речи нет.
 */
export function conflictOutput(input: ConflictOutputInput): string {
  const kinds = new Map(input.merge.conflicts.map((c) => [c.file, c.kind]))
  const paths = [...new Set([...input.merge.autoMerged, ...kinds.keys()])].sort(compareBytes)
  const lines: string[] = []
  for (const path of paths) {
    lines.push(`Auto-merging ${path}`)
    const kind = kinds.get(path)
    if (kind !== undefined) lines.push(`CONFLICT (${conflictKindOf(kind) === 'both-added' ? 'add/add' : 'content'}): Merge conflict in ${path}`)
  }
  if (input.command === 'cherry-pick' && input.commit !== undefined) {
    lines.push(`error: could not apply ${shortCommitId(input.commit.id)}... ${input.commit.subject}`, ...CHERRY_PICK_HINTS)
  }
  if (input.command === 'rebase' && input.commit !== undefined) {
    const id = shortCommitId(input.commit.id)
    lines.push(`error: could not apply ${id}... ${input.commit.subject}`, ...REBASE_HINTS, `Could not apply ${id}... # ${input.commit.subject}`)
  }
  return lines.join('\n')
}

// ---------- git status ----------

/** Код `git status --short`: `UU` — оба изменили, `AA` — оба создали. */
export function shortCode(entry: Pick<UnmergedEntry, 'kind'>): 'UU' | 'AA' {
  return entry.kind === 'both-added' ? 'AA' : 'UU'
}

const UNMERGED_LABEL: Record<ConflictKind, string> = {
  'both-modified': 'both modified:   ',
  'both-added': 'both added:      ',
}

export interface StatusParts {
  /** Заголовок операции без пустой строки после него; пусто, если операции нет (у тайника её нет, К4.1). */
  header: string[]
  /** Раздел `Unmerged paths:` без пустой строки после него; пусто, если неслитых нет. */
  unmerged: string[]
  /** Подсказка `(use "git restore --staged <file>..." to unstage)`: при cherry-pick её нет, у rebase, тайника и без операции есть (К5.1, К5.4, П8.11, К6.3, К4.1, К13.c). */
  restoreStagedHint: boolean
  /** Строки `git status --short` для неслитых путей. */
  short: { path: string; code: 'UU' | 'AA' }[]
}

/** Условия, от которых зависит заголовок: на ветке ли HEAD (после `git checkout -b` посреди rebase, К13.b). */
export interface StatusOptions {
  /** HEAD стоит на ветке, а не отсоединён: у rebase пропадает строка `interactive rebase in progress; onto …`. */
  headOnBranch?: boolean
}

function pickLine(step: RebaseStep): string {
  return `   pick ${shortCommitId(step.id)} # ${step.subject}`
}

/**
 * Заголовок rebase (П8.11, К6.3, К6.4, К13.b, К14.3). Сверены сочетания «сделан один шаг, остался один» (П8.11), «сделан один, не осталось»
 * (К3.5) и «сделано два, не осталось» (К14.3); остальные числа шагов модуль не печатает — нарушение условия вызова.
 */
function rebaseHeader(op: RebaseOperation, unmergedCount: number, headOnBranch: boolean): string[] {
  if (op.done.length < 1 || op.done.length > 2 || op.todo.length > 1) throw new Error('число шагов rebase в git status не сверено прогонами: команда обязана отказать областью раньше')
  const onto = shortCommitId(op.onto)
  const lines: string[] = headOnBranch ? [] : [`interactive rebase in progress; onto ${onto}`]
  lines.push(op.done.length === 1 ? 'Last command done (1 command done):' : 'Last commands done (2 commands done):', ...op.done.map(pickLine))
  if (op.todo.length === 0) lines.push('No commands remaining.')
  else lines.push('Next command to do (1 remaining command):', ...op.todo.map(pickLine), '  (use "git rebase --edit-todo" to view and edit)')
  if (unmergedCount === 0 && !op.mergeMsg) {
    lines.push(
      `You are currently editing a commit while rebasing branch '${op.branch}' on '${onto}'.`,
      '  (use "git commit --amend" to amend the current commit)',
      '  (use "git rebase --continue" once you are satisfied with your changes)',
    )
    return lines
  }
  lines.push(`You are currently rebasing branch '${op.branch}' on '${onto}'.`)
  if (unmergedCount === 0) lines.push('  (all conflicts fixed: run "git rebase --continue")')
  else lines.push('  (fix conflicts and then run "git rebase --continue")', '  (use "git rebase --skip" to skip this patch)', '  (use "git rebase --abort" to check out the original branch)')
  return lines
}

/** Части `git status`, зависящие от конфликта. Остальной статус строит раздел. */
export function statusBlock(state: Pick<ConflictState, 'unmerged' | 'operation'>, options: StatusOptions = {}): StatusParts {
  const paths = Object.keys(state.unmerged).sort(compareBytes)
  const operation = state.operation
  const restoreStagedHint = operation === null || operation.kind !== 'cherry-pick'
  const header: string[] = []
  if (operation !== null && operation.kind === 'cherry-pick') {
    const done = paths.length === 0
    header.push(
      `You are currently cherry-picking commit ${shortCommitId(operation.commit)}.`,
      done ? '  (all conflicts fixed: run "git cherry-pick --continue")' : '  (fix conflicts and run "git cherry-pick --continue")',
      '  (use "git cherry-pick --skip" to skip this patch)',
      '  (use "git cherry-pick --abort" to cancel the cherry-pick operation)',
    )
  } else if (operation !== null) {
    header.push(...rebaseHeader(operation, paths.length, options.headOnBranch === true))
  }
  const unmerged =
    paths.length === 0
      ? []
      : [
          'Unmerged paths:',
          ...(restoreStagedHint ? ['  (use "git restore --staged <file>..." to unstage)'] : []),
          '  (use "git add <file>..." to mark resolution)',
          ...paths.map((p) => `\t${UNMERGED_LABEL[state.unmerged[p].kind]}${p}`),
        ]
  return { header, unmerged, restoreStagedHint, short: paths.map((path) => ({ path, code: shortCode(state.unmerged[path]) })) }
}

// ---------- отказы посреди конфликта ----------

const BLOCK_A = [
  'error: Committing is not possible because you have unmerged files.',
  "hint: Fix them up in the work tree, and then use 'git add/rm <file>'",
  'hint: as appropriate to mark resolution and make a commit.',
  'fatal: Exiting because of an unresolved conflict.',
]

/**
 * Команда раздела, для которой таблица «Что запрещено» и матрица «`--abort` и `--continue` не своей команды» знают отказ.
 * `rebase-step` и `cherry-pick-step` — `--continue` или `--abort` команды, чьей операции нет; `rebase-continue` —
 * `--continue` при неслитых путях; `switch-branch` — `git switch <ветка>` посреди rebase.
 */
export type RefusedCommand =
  | { name: 'commit' }
  | { name: 'cherry-pick' }
  | { name: 'checkout-branch' }
  | { name: 'checkout-paths'; paths: readonly string[] }
  | { name: 'stash' }
  | { name: 'stash-pop' }
  | { name: 'stash-apply' }
  | { name: 'reset-soft' }
  | { name: 'rebase' }
  | { name: 'rebase-continue' }
  | { name: 'rebase-step' }
  | { name: 'cherry-pick-step' }
  | { name: 'switch-branch' }

export interface Refusal {
  output: string
  exitCode: number
}

/** Вход `refusal`: неслитые пути и операция (она нужна командам, чей отказ зависит от идущей операции). */
export type RefusalState = Pick<ConflictState, 'unmerged'> & { operation?: ConflictOperation | null }

/** Новый `rebase`, пока идёт rebase (К6.2): блок кончается пустой строкой. */
const REBASE_RUNNING = [
  'fatal: It seems that there is already a rebase-merge directory, and',
  'I wonder if you are in the middle of another rebase.  If that is the',
  'case, please try',
  '\tgit rebase (--continue | --abort | --skip)',
  'If that is not the case, please',
  '\trm -fr ".git/rebase-merge"',
  'and run me again.  I am stopping in case you still have something',
  'valuable there.',
  '',
].join('\n')

/**
 * Отказ git посреди конфликта (К1.2, К4.2, К5.2, К6.2, К16.2): `null`, если команда проходит. Не решает, в области ли
 * команда: раздел спрашивает это раньше. Часть отказов зависит только от неслитых путей, часть — от идущей операции
 * (`rebase`, `rebase-step`, `cherry-pick-step`, `switch-branch`): они отвечают и без неслитых путей. Состояния
 * «операция идёт, неслитых нет» таблица не знает отдельно от раздела: их отказы зависят от индекса и HEAD, которых у
 * модуля нет. Форма `checkout -- <пути>` отказывает только когда неслитые все пути (смешанный список прогонами не
 * сверен: раздел отвечает отказом области).
 */
export function refusal(command: RefusedCommand, state: RefusalState): Refusal | null {
  const operation = state.operation ?? null
  const rebasing = operation !== null && operation.kind === 'rebase'
  switch (command.name) {
    case 'rebase-step':
      return rebasing ? null : { output: 'fatal: no rebase in progress', exitCode: 128 }
    case 'cherry-pick-step':
      return operation !== null && operation.kind === 'cherry-pick' ? null : { output: ['error: no cherry-pick or revert in progress', 'fatal: cherry-pick failed'].join('\n'), exitCode: 128 }
    case 'switch-branch':
      return rebasing ? { output: ['fatal: cannot switch branch while rebasing', 'Consider "git rebase --quit" or "git worktree add".'].join('\n'), exitCode: 128 } : null
    case 'rebase':
      if (rebasing) return { output: REBASE_RUNNING, exitCode: 128 }
  }
  const files = Object.keys(state.unmerged).sort(compareBytes)
  if (files.length === 0) return null
  const needsMerge = files.map((f) => `${f}: needs merge`)
  const kept = 'The stash entry is kept in case you need it again.'
  switch (command.name) {
    case 'commit':
      return { output: [...BLOCK_A, ...files.map((f) => `U\t${f}`)].join('\n'), exitCode: 128 }
    case 'cherry-pick':
      return { output: ['error: Cherry-picking is not possible because you have unmerged files.', ...BLOCK_A.slice(1, 3), 'fatal: cherry-pick failed'].join('\n'), exitCode: 128 }
    case 'checkout-branch':
      return { output: ['error: you need to resolve your current index first', ...needsMerge].join('\n'), exitCode: 1 }
    case 'checkout-paths':
      if (!command.paths.every((p) => has(state.unmerged, p))) return null
      return { output: command.paths.map((p) => `error: path '${p}' is unmerged`).join('\n'), exitCode: 1 }
    case 'stash':
      return { output: ['error: could not write index', ...needsMerge].join('\n'), exitCode: 1 }
    case 'stash-pop':
      return { output: ['error: could not write index', ...needsMerge, kept].join('\n'), exitCode: 1 }
    case 'stash-apply':
      return { output: ['error: could not write index', ...needsMerge].join('\n'), exitCode: 1 }
    case 'reset-soft':
      return { output: 'fatal: Cannot do a soft reset in the middle of a merge.', exitCode: 128 }
    case 'rebase':
      return {
        output: [...needsMerge, 'error: cannot rebase: You have unstaged changes.', 'error: additionally, your index contains uncommitted changes.', 'error: Please commit or stash them.'].join('\n'),
        exitCode: 1,
      }
    case 'rebase-continue':
      return { output: [...needsMerge, 'You must edit all merge conflicts and then', 'mark them as resolved using git add'].join('\n'), exitCode: 1 }
    default:
      return null
  }
}
