// ============================================================
// Раздел 8 git-тренажёра, шаг B: переходы HEAD — `git checkout` и `git switch` (target.md, часть XII,
// «Что входит», «Переход: что печатает git», «reflog: записи»). Формы:
// - на ветку: `checkout <ветка>`, `switch <ветка>`, `checkout -b <имя>`, `switch -c <имя>`;
// - на коммит (отсоединённый HEAD): `checkout <тег | tags/<тег> | id | <ссылка>~n | HEAD@{n} | refs/heads/<ветка>>`,
//   `checkout --detach [<ссылка>]`, `switch --detach [<ссылка>]`; `switch` без `--detach` на коммит и тег отказывает;
// - назад: `checkout -`, `switch -`; `checkout HEAD`.
// Остальное (`-q`, `-B`, `-f`, `--orphan`, `-t`, `switch -c <имя> <начало>`, `checkout <ссылка> -- <файл>`) — отказ области.
//
// Строки перехода печатает `switchOutput`, запись журнала и `lastCheckout` строит `checkoutReflogEntry`
// (detachedHead.ts); здесь они не повторяются. Правки считает `checkSafety`; отказ из-за правок печатается
// в формате П8.34–П8.37 (подготовленные и неподготовленные файлы — разными блоками), он один на ветку и на коммит (О7, О16, П8.65).
// Вывод сверен с docs/git-trainer/reports/detached-head-git-runs.txt (О1–О31), section8-git-runs.txt (П8.15, П8.19),
// appendix-g18e-git-runs.txt (П8.28, П8.32–П8.40) и appendix-g18g-git-runs.txt (П8.57–П8.68).
//
// Посреди cherry-pick, rebase и конфликта тайника (часть XI): проходят `-b <имя>` (у cherry-pick с предупреждением, у rebase операция
// продолжается на новой ветке, К13.b), `HEAD -- <файл>`, `-- <файл>`, отказывают `<ветка>` и `-- <неслитый файл>`; остальное — отказ области
// (checkoutInConflict).
//
// Проверки git идут в таком порядке (П8.68): форма команды → ссылка → «нужна ветка» у `switch` → правки, которые
// переход затёр бы. Ошибка игрока (отказ git) — результат с кодом возврата, не исключение.
// ============================================================
import type { AppendixState, FileTree, Head } from './appendixTypes'
import { exited, refuse, type Outcome } from './appendixOutcome'
import { commitTree, graphOf, headTree, refsOf, currentCommitId } from './appendixRepo'
import { compareBytes, isValidBranchName } from './appendixRefs'
import { BRANCH_INVALID, branchNameOutOfScope } from './appendixLocal'
import { reflogShortOutput, resolveRevision } from './appendixRevisions'
import { restoreFiles, isPlainPath } from './appendixRestore'
import { conflictForm, hasUnmerged, inConflict, refusalOutcome } from './appendixConflicts'
import { checkoutReflogEntry, orphans, previousPosition, switchOutput, type Refs, type SwitchMode, type SwitchTarget } from './detachedHead'
import { checkSafety, shortCommitId } from './sectionsCommon'
import { has } from './util'
import { ru } from '../locales/ru'

const ae = ru.appendix.errors
const ax = ru.appendix.explain
const ALLOWED = ru.appendix.allowed

// ---------- перенос правок и отказ ----------

/**
 * Буква в строке отчёта `<буква>\t<файл>`, которую `git checkout` печатает про файл, переехавший
 * на другую ветку вместе с правкой. Отчёт строится так, как `git diff-index` без `--cached`: по
 * индексу, без перечитывания содержимого, поэтому правка, возвращённая к исходному тексту, всё
 * равно считается правкой (П8.28, П8.33):
 * - файла нет в индексе (подготовлено удаление): `D`, если он есть у цели, иначе строки нет;
 * - файла нет в рабочем каталоге: `D`, если он есть у цели, иначе строки нет (подготовленный новый
 *   файл, который потом удалили, в отчёт не попадает);
 * - файла нет у цели: `A`;
 * - иначе `M`, если рабочий файл отличается от индекса или индекс от цели; если нет — строки нет.
 */
function carriedLetter(inIndex: boolean, inWorking: boolean, inTarget: boolean, indexValue: string | undefined, workingValue: string | undefined, targetValue: string | undefined): 'M' | 'A' | 'D' | null {
  if (!inIndex || !inWorking) return inTarget ? 'D' : null
  if (!inTarget) return 'A'
  return indexValue !== targetValue || workingValue !== indexValue ? 'M' : null
}

/**
 * Дерево после перехода и строки `M\t<файл>`: файл, который переход не трогает, переносится как
 * есть (правка остаётся); остальные приводятся к дереву цели. Правило то же, что в разделе 2
 * (branchRepo.ts, applyTreeChange); буквы отчёта — `carriedLetter` (П8.28).
 */
function applyTargetTree(state: AppendixState, target: FileTree): { index: FileTree; working: FileTree; carried: string[] } {
  const head = headTree(state)
  const files = new Set([...Object.keys(head), ...Object.keys(target), ...Object.keys(state.index), ...Object.keys(state.working)])
  const index: FileTree = {}
  const working: FileTree = {}
  const carried: { file: string; letter: 'M' | 'A' | 'D' }[] = []
  for (const f of files) {
    const inHead = has(head, f)
    const inIndex = has(state.index, f)
    const inWorking = has(state.working, f)
    const inTarget = has(target, f)
    const indexValue = inIndex ? state.index[f] : undefined
    const workingValue = inWorking ? state.working[f] : undefined
    const headValue = inHead ? head[f] : undefined
    const targetValue = inTarget ? target[f] : undefined
    const dirty = headValue !== indexValue || workingValue !== indexValue
    // Файл удалён из рабочего каталога без `git rm`, а переход его трогает: git создаёт его заново.
    const recreated = dirty && headValue !== targetValue && indexValue === headValue && !inWorking
    if (dirty && !recreated) {
      if (inIndex) index[f] = state.index[f]
      if (inWorking) working[f] = state.working[f]
      // В отчёт попадают только файлы, известные git; неотслеживаемые остаются молча.
      if (!inHead && !inIndex) continue
      const letter = carriedLetter(inIndex, inWorking, inTarget, indexValue, workingValue, targetValue)
      if (letter !== null) carried.push({ file: f, letter })
      continue
    }
    if (inTarget) {
      index[f] = target[f]
      working[f] = target[f]
    }
  }
  carried.sort((x, y) => compareBytes(x.file, y.file))
  return { index, working, carried: carried.map((c) => `${c.letter}\t${c.file}`) }
}

/**
 * Отказ из-за правок или неотслеживаемых файлов, которые переход затёр бы: код 1, ничего не
 * изменено. Блоков до трёх, в порядке git (П8.28, П8.32, П8.34–П8.37): файлы, у которых индекс
 * отличается от HEAD (подготовленное), затем файлы с правкой только в рабочем каталоге; у обоих
 * блоков один и тот же текст; затем неотслеживаемые файлы; в конце один `Aborting`.
 */
function overwriteRefusal(staged: readonly string[], unstaged: readonly string[], untracked: readonly string[]): string {
  const parts: string[] = []
  for (const group of [staged, unstaged]) {
    if (group.length === 0) continue
    parts.push('error: Your local changes to the following files would be overwritten by checkout:', ...group.map((f) => `\t${f}`), 'Please commit your changes or stash them before you switch branches.')
  }
  if (untracked.length > 0) {
    parts.push('error: The following untracked working tree files would be overwritten by checkout:', ...untracked.map((f) => `\t${f}`), 'Please move or remove them before you switch branches.')
  }
  return [...parts, 'Aborting'].join('\n')
}

// ---------- переход ----------

/** Куда и как переходим. */
interface Move {
  to: SwitchTarget
  mode: SwitchMode
  /** Печатать строки `M\t<файл>` переносимых правок: у `checkout -b` и `switch -c` их нет (П8.28, П8.64). */
  listCarried: boolean
}

/**
 * Ссылки для предупреждения `leaving … behind`: к веткам добавлено место, куда переходим. Коммиты,
 * достижимые из нового места, не брошены, даже если ушли с их вершины (П8.59: переход на предка).
 */
function refsWithTarget(state: AppendixState, id: string): Refs {
  const refs = refsOf(state)
  return { branches: { ...refs.branches, '\0target': id }, tags: refs.tags }
}

/** Пояснение к переходу: вход в отсоединённый HEAD, уход с коммита, перенесённые правки. */
function explainMove(from: Head, move: Move, lost: number, carried: number): string | null {
  const { to } = move
  const parts: string[] = []
  if (to.kind === 'commit' && from.kind === 'branch') parts.push(ax.detachedEntered)
  if (from.kind === 'detached' && from.id !== to.id) {
    if (lost > 0) parts.push(ax.leavingBehind(lost, shortCommitId(from.id)))
    else parts.push(ax.previousPosition)
  }
  if (to.kind === 'branch' && to.created && from.kind === 'detached') parts.push(ax.detachedBranchCreated(to.name))
  if (carried > 0) parts.push(ax.carriedFiles)
  return parts.length === 0 ? null : parts.join(' ')
}

function moveHead(state: AppendixState, move: Move): Outcome {
  const { to, mode } = move
  // Отказ `switch` на коммит и тег идёт раньше проверки правок (П8.68).
  if (to.kind === 'commit' && mode === 'switch') {
    const refusal = switchOutput(state.head, to, mode, refsOf(state), graphOf(state), [])
    if (refusal.ok || refusal.reason !== 'branchExpected') throw new Error('switch на коммит всегда отказ')
    return exited(state, refusal.output, refusal.exitCode, ax.switchBranchExpected)
  }

  const creates = to.kind === 'branch' && to.created
  let tree = { index: state.index, working: state.working, carried: [] as string[] }
  if (!creates) {
    const target = commitTree(state, to.id)
    const head = headTree(state)
    const block = checkSafety(head, state.index, state.working, target)
    if (block.modified.length > 0 || block.untracked.length > 0) {
      const isStaged = (f: string) => (has(state.index, f) ? state.index[f] : undefined) !== (has(head, f) ? head[f] : undefined)
      return exited(state, overwriteRefusal(block.modified.filter(isStaged), block.modified.filter((f) => !isStaged(f)), block.untracked), 1, ax.checkoutRefusedEdit)
    }
    tree = applyTargetTree(state, target)
  }

  const refs = refsWithTarget(state, to.id)
  const printed = switchOutput(state.head, to, mode, refs, graphOf(state), [])
  // Отказ `switchOutput` бывает у `switch` на коммит (выше) и у `checkout HEAD` с ветки (`stayOnBranch`).
  if (!printed.ok) throw new Error('переход не может быть отказом')
  const lost = state.head.kind === 'detached' && state.head.id !== to.id ? orphans(state.head.id, refs, graphOf(state)).length : 0

  const entry = checkoutReflogEntry(state.head, to)
  const next: AppendixState = {
    ...state,
    head: to.kind === 'branch' ? { kind: 'branch', name: to.name } : { kind: 'detached', id: to.id },
    branches: creates && to.kind === 'branch' ? { ...state.branches, [to.name]: to.id } : state.branches,
    index: tree.index,
    working: tree.working,
    lastCheckout: entry === null ? state.lastCheckout : entry.lastCheckout,
    reflog: entry === null ? state.reflog : [{ id: to.id, message: entry.message }, ...state.reflog],
  }
  const carried = move.listCarried ? tree.carried : []
  const lines = [...carried, ...(printed.output === '' ? [] : [printed.output])]
  return exited(next, lines.join('\n'), 0, explainMove(state.head, move, lost, carried.length))
}

/** `checkout HEAD` с ветки: git ничего не делает и не пишет в журнал; печатает только перенесённые правки (П8.57). */
function stayOnBranch(state: AppendixState): Outcome {
  const tree = applyTargetTree(state, headTree(state))
  const next: AppendixState = { ...state, index: tree.index, working: tree.working }
  return exited(next, tree.carried.join('\n'), 0, ax.checkoutHeadStays)
}

function moveToBranch(state: AppendixState, name: string, mode: SwitchMode): Outcome {
  return moveHead(state, { to: { kind: 'branch', name, id: state.branches[name], created: false }, mode, listCarried: true })
}

function createBranchAndSwitch(state: AppendixState, name: string, mode: SwitchMode): Outcome {
  if (!isValidBranchName(name)) return exited(state, BRANCH_INVALID(name), 128)
  const outOfScope = branchNameOutOfScope(state, name)
  if (outOfScope !== null) return refuse(state, outOfScope)
  if (has(state.branches, name)) return exited(state, `fatal: a branch named '${name}' already exists`, 128)
  // Форма из двух слов переносимые файлы не перечисляет (П8.28, П8.64).
  return moveHead(state, { to: { kind: 'branch', name, id: currentCommitId(state), created: true }, mode, listCarried: false })
}

/** `checkout -` и `switch -`: вернуться на «from» последней записи `checkout:` журнала (О8, О14, П8.65). */
function goPrevious(state: AppendixState, command: 'checkout' | 'switch'): Outcome {
  const previous = previousPosition(state.reflog.map((e) => e.message))
  const refusal = refuse(state, ae.form(command, '-', ALLOWED[command]))
  if (previous === null) return refusal
  if (previous.kind === 'branch') {
    if (has(state.branches, previous.name)) return moveToBranch(state, previous.name, command)
    // Ветка, с которой пришли, удалена (П8.65): ответы двух команд разные.
    if (command === 'switch') return exited(state, 'fatal: invalid reference: @{-1}', 128)
    return exited(state, "error: pathspec '-' did not match any file(s) known to git", 1)
  }
  if (!has(state.commits, previous.id)) return refusal
  return moveHead(state, { to: { kind: 'commit', id: previous.id, spec: previous.id, objectKind: 'commit' }, mode: command, listCarried: true })
}

// ---------- ссылка → коммит ----------

type Target = { ok: true; id: string } | { ok: false; outcome: Outcome }

/**
 * Слово, называющее место, куда ставят HEAD: ветка или ссылка на коммит. `missing` отвечает команда:
 * у `checkout --detach` и у `switch` тексты разные (П8.66).
 */
function wordTarget(state: AppendixState, command: 'checkout' | 'switch', word: string, missing: (word: string) => string): Target {
  if (has(state.branches, word)) return { ok: true, id: state.branches[word] }
  const revision = resolveRevision(state, word)
  if (revision.kind === 'commit') return { ok: true, id: revision.id }
  if (revision.kind === 'reflogShort') return { ok: false, outcome: exited(state, reflogShortOutput(revision.entries), 128, ax.reflogShortEntries) }
  if (revision.kind === 'missing') return { ok: false, outcome: exited(state, missing(word), 128) }
  return { ok: false, outcome: refuse(state, ae.revisionForm(command, word)) }
}

function detachAt(state: AppendixState, command: 'checkout' | 'switch', word: string | null): Outcome {
  const spec = word ?? 'HEAD'
  const missing = command === 'checkout' ? (w: string) => `fatal: git checkout: --detach does not take a path argument '${w}'` : (w: string) => `fatal: invalid reference: ${w}`
  const target = word === null ? ({ ok: true, id: currentCommitId(state) } as const) : wordTarget(state, command, word, missing)
  if (!target.ok) return target.outcome
  return moveHead(state, { to: { kind: 'commit', id: target.id, spec, objectKind: 'commit' }, mode: 'detach', listCarried: true })
}

// ---------- git checkout ----------

const DETACH_WITH_NEW_BRANCH = "fatal: '--detach' cannot be used with '-b/-B/--orphan'"

function checkoutDetach(state: AppendixState, args: readonly string[]): Outcome {
  const rest = args.filter((a) => a !== '--detach')
  if (rest.includes('-b')) return exited(state, DETACH_WITH_NEW_BRANCH, 128)
  if (rest.length > 1 || rest.some((a) => a.startsWith('-'))) return refuse(state, ae.form('checkout', args.join(' '), ALLOWED.checkout))
  return detachAt(state, 'checkout', rest[0] ?? null)
}

/** `git checkout HEAD -- <файлы>` посреди конфликта: файл становится версией HEAD и перестаёт быть неслитым, молча (К4.5, К16.ch). */
function restoreFromHead(state: AppendixState, paths: readonly string[]): Outcome {
  const foreign = paths.find((p) => !isPlainPath(p))
  if (foreign !== undefined) return refuse(state, ae.pathspecForm('checkout', foreign))
  const head = headTree(state)
  // Путь, которого нет в HEAD, git назвал бы иначе: этот ответ в протоколах не снят.
  if (paths.some((p) => !has(head, p))) return conflictForm(state, `checkout HEAD -- ${paths.join(' ')}`)
  const index: FileTree = { ...state.index }
  const working: FileTree = { ...state.working }
  const unmerged = { ...state.unmerged }
  for (const p of paths) {
    index[p] = head[p]
    working[p] = head[p]
    delete unmerged[p]
  }
  return exited({ ...state, index, working, unmerged }, '', 0, ru.conflicts.checkoutHeadFile([...new Set(paths)], state.operation === null ? null : state.operation.kind))
}

/**
 * `git checkout` посреди cherry-pick или конфликта тайника. Проходят и отказывают формы из протокола: `-b <имя>`
 * (К13.c, К13.s), `<ветка>` (К4.2, К5.2, К12.c1), `-- <файл>` (К4.2), `HEAD -- <файл>` (К4.5, К16.ch). Остальное и успешный
 * переход, когда неслитых путей нет, а cherry-pick идёт, — отказ области: git при переходе бросает операцию, а печатает ли
 * предупреждение, прогоном не сверено.
 */
function checkoutInConflict(state: AppendixState, args: readonly string[]): Outcome {
  const unmerged = hasUnmerged(state)
  if (args[0] === '-b' && args.length === 2) {
    const made = createBranchAndSwitch(state, args[1], 'checkout')
    if (made.result.exitCode !== 0 || state.operation === null) return made
    if (!unmerged) return conflictForm(state, `checkout ${args.join(' ')}`)
    // У rebase операция продолжается на новой ветке, предупреждения нет (К13.b).
    if (state.operation.kind === 'rebase') return exited(made.state, made.result.output, 0, ru.conflicts.rebaseCheckoutBranch(state.operation.branch))
    const notes = [made.result.explanation, ru.conflicts.checkoutCancelled].filter((n): n is string => n !== null)
    return exited({ ...made.state, operation: null }, `${made.result.output}\nwarning: cancelling a cherry picking in progress`, 0, notes.join(' '))
  }
  if (args[0] === '--') {
    const paths = args.slice(1)
    if (!unmerged) return checkoutPlain(state, args)
    const refused = refusalOutcome(state, { name: 'checkout-paths', paths })
    if (refused !== null) return refused
    return paths.some((p) => has(state.unmerged, p)) ? conflictForm(state, `checkout ${args.join(' ')}`) : checkoutPlain(state, args)
  }
  if (args[0] === 'HEAD' && args[1] === '--' && args.length > 2 && unmerged) return restoreFromHead(state, args.slice(2))
  if (unmerged) {
    if (args.length === 1 && has(state.branches, args[0])) return refusalOutcome(state, { name: 'checkout-branch' }) as Outcome
    return conflictForm(state, `checkout ${args.join(' ')}`)
  }
  const out = checkoutPlain(state, args)
  const moved = out.state.head !== state.head || out.state.reflog !== state.reflog || args[0] === 'HEAD'
  return out.result.exitCode === 0 && moved ? conflictForm(state, `checkout ${args.join(' ')}`) : out
}

export function handleCheckout(state: AppendixState, args: readonly string[]): Outcome {
  return inConflict(state) ? checkoutInConflict(state, args) : checkoutPlain(state, args)
}

function checkoutPlain(state: AppendixState, args: readonly string[]): Outcome {
  if (args.length === 0) return refuse(state, ae.form('checkout', '', ALLOWED.checkout))
  if (args.includes('--detach')) return checkoutDetach(state, args)
  if (args[0] === '-b') {
    // `error: switch `b' requires a value` — весь вывод git, без usage (П8.28).
    if (args.length === 1) return exited(state, "error: switch `b' requires a value", 129)
    if (args.length > 2) return refuse(state, ae.form('checkout', args.join(' '), ALLOWED.checkout))
    return createBranchAndSwitch(state, args[1], 'checkout')
  }
  // `git checkout -- <файл>…` вернёт файлы из индекса; `--` после ссылки взял бы файл из коммита (П8.52, П8.53).
  const dashAt = args.indexOf('--')
  if (dashAt === 0) return restoreFiles(state, args.slice(1), true)
  if (dashAt > 0) return refuse(state, ae.checkoutFromRevision(args.join(' ')))
  const name = args[0]
  if (name === '-') return args.length === 1 ? goPrevious(state, 'checkout') : refuse(state, ae.form('checkout', args.join(' '), ALLOWED.checkout))
  if (name.startsWith('-')) return refuse(state, ae.form('checkout', name, ALLOWED.checkout))
  if (has(state.branches, name)) return args.length === 1 ? moveToBranch(state, name, 'checkout') : refuse(state, ae.form('checkout', args.join(' '), ALLOWED.checkout))

  // Не ветка: тег, коммит или выражение отсоединили бы HEAD (или взяли бы файл из коммита); иначе все слова — имена файлов (П8.52).
  const revision = resolveRevision(state, name)
  if (revision.kind === 'commit') {
    if (args.length > 1) return refuse(state, ae.checkoutFromRevision(args.join(' ')))
    // `checkout HEAD` с ветки — пустой вывод и никакой записи в журнал (П8.57); из отсоединённого HEAD это обычный переход на тот же коммит (О1).
    if (name === 'HEAD' && state.head.kind === 'branch') return stayOnBranch(state)
    return moveHead(state, { to: { kind: 'commit', id: revision.id, spec: name, objectKind: 'commit' }, mode: 'checkout', listCarried: true })
  }
  if (revision.kind === 'reflogShort') return exited(state, reflogShortOutput(revision.entries), 128, ax.reflogShortEntries)
  if (revision.kind === 'foreign') return refuse(state, ae.revisionForm('checkout', name))
  return restoreFiles(state, args, false)
}

// ---------- git switch ----------

const SWITCH_ONE_REFERENCE = 'fatal: only one reference expected'

/** Имя, которое `git switch` называет тегом в отказе: имя тега и `tags/<тег>` (П8.58); остальное — коммит. */
function switchObjectKind(state: AppendixState, word: string): { spec: string; objectKind: 'commit' | 'tag' } {
  if (has(state.tags, word)) return { spec: word, objectKind: 'tag' }
  if (word.startsWith('tags/') && has(state.tags, word.slice('tags/'.length))) return { spec: word.slice('tags/'.length), objectKind: 'tag' }
  return { spec: word, objectKind: 'commit' }
}

function switchPlain(state: AppendixState, word: string): Outcome {
  if (word === '-') return goPrevious(state, 'switch')
  if (has(state.branches, word)) return moveToBranch(state, word, 'switch')
  const revision = resolveRevision(state, word)
  if (revision.kind === 'foreign') return refuse(state, ae.revisionForm('switch', word))
  if (revision.kind === 'reflogShort') return exited(state, reflogShortOutput(revision.entries), 128, ax.reflogShortEntries)
  if (revision.kind === 'missing') return exited(state, `fatal: invalid reference: ${word}`, 128)
  // Для `HEAD` и `refs/heads/…` git отвечает по-особому, без слов commit и tag (П8.58); форма в разделе не делается, отказ области.
  if (word === 'HEAD' || word.startsWith('refs/heads/')) return refuse(state, ae.switchRefForm(word))
  const named = switchObjectKind(state, word)
  return moveHead(state, { to: { kind: 'commit', id: revision.id, spec: named.spec, objectKind: named.objectKind }, mode: 'switch', listCarried: true })
}

export function handleSwitch(state: AppendixState, args: readonly string[]): Outcome {
  let detach = false
  let create: string | null = null
  const words: string[] = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--detach') detach = true
    else if (arg === '-c') {
      // `error: switch `c' requires a value` — как у `checkout -b` (П8.60).
      if (i + 1 >= args.length) return exited(state, "error: switch `c' requires a value", 129)
      create = args[++i]
      if (create.startsWith('-') && create !== '-') return refuse(state, ae.form('switch', args.join(' '), ALLOWED.switch))
    } else if (arg.startsWith('-') && arg !== '-') return refuse(state, ae.form('switch', arg, ALLOWED.switch))
    else words.push(arg)
  }
  if (detach && create !== null) return exited(state, DETACH_WITH_NEW_BRANCH, 128)
  if (create !== null) {
    // Начальная точка (`switch -c <имя> <ссылка>`) в разделе не разбирается.
    if (words.length > 0) return refuse(state, ae.form('switch', args.join(' '), ALLOWED.switch))
    return createBranchAndSwitch(state, create, 'switch')
  }
  if (words.length > 1) return exited(state, SWITCH_ONE_REFERENCE, 128)
  if (detach) {
    if (words[0] === '-') return refuse(state, ae.form('switch', args.join(' '), ALLOWED.switch))
    return detachAt(state, 'switch', words[0] ?? null)
  }
  if (words.length === 0) return exited(state, 'fatal: missing branch or commit argument', 128)
  return switchPlain(state, words[0])
}
