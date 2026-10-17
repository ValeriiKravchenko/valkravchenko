// ============================================================
// Раздел 8 git-тренажёра, шаг A: локальная работа — `status`, `add`, `commit`, `branch`,
// `checkout`, `diff` (target.md, часть X, «Что входит», строка «Локальная работа»). Нужна, чтобы
// игрок мог создавать правки и коммиты, на которые ставятся теги. Вывод git сверен с протоколом
// docs/git-trainer/reports/appendix-g18e-git-runs.txt (П8.21–П8.32) и section8-git-runs.txt
// (П8.1, П8.3); строки git — английские литералы и не переводятся. Всё, что отсюда не
// воспроизводится, получает честный отказ области с меткой тренажёра (часть III, правило 1).
//
// Упрощения, названные в части X: после `git commit` нет диффстата и строк `create mode`; в
// `git show` и `git diff` нет маркера `\ No newline at end of file` (файлы кончаются переводом
// строки, поэтому вывод остаётся правдой); хэши блобов в строках `index` ненастоящие.
// ============================================================
import type { AppendixCommit, AppendixState, FileTree } from './appendixTypes'
import { exited, refuse, type Outcome } from './appendixOutcome'
import { branchNames, commitTree, currentCommitId, diffTrees, graphOf, headTree, mayContainRename, refsOf, sameTree } from './appendixRepo'
import { isValidBranchName } from './appendixRefs'
import { resolveRevision } from './appendixRevisions'
import { advanceHead, branchListFirstLine, checkoutReflogEntry, commitLabel, statusFirstLine, switchOutput, type SwitchTarget } from './detachedHead'
import { applyStageAll } from './commitFlags'
import { checkSafety, formatStatusWithCommits, fullCommitId, shortCommitId } from './sectionsCommon'
import { has } from './util'
import { ru } from '../locales/ru'

const ae = ru.appendix.errors
const ax = ru.appendix.explain

const ALLOWED = ru.appendix.allowed

/** Слово содержит знаки маски: шелл раскрыл бы его сам, а git как путь-маску тренажёр не разбирает. */
function hasGlobChars(word: string): boolean {
  return /[*?[\]]/.test(word)
}

// ---------- git status ----------

export function handleStatus(state: AppendixState, args: readonly string[]): Outcome {
  let short = false
  for (const arg of args) {
    if (arg === '-s' || arg === '--short') short = true
    else return refuse(state, ae.form('status', arg, ALLOWED.status))
  }
  const first = statusFirstLine(state.head, state.lastCheckout, refsOf(state), null) as string
  const formatted = formatStatusWithCommits(first, headTree(state), state.index, state.working, { short })
  if (!formatted.ok) return refuse(state, formatted.reason === 'renameDetection' ? ae.renameDetection('status') : ae.statusNestedPaths)
  return exited(state, formatted.output, 0)
}

// ---------- git add ----------

const ADD_NOTHING_SPECIFIED = [
  'Nothing specified, nothing added.',
  "hint: Maybe you wanted to say 'git add .'?",
  'hint: Disable this message with "git config set advice.addEmptyPathspec false"',
].join('\n')

/** Копия индекса, в которую попали пути: содержимое рабочего каталога или удаление. */
function stagePaths(state: AppendixState, paths: readonly string[]): FileTree {
  const next: FileTree = { ...state.index }
  for (const path of paths) {
    if (has(state.working, path)) next[path] = state.working[path]
    else delete next[path]
  }
  return next
}

export function handleAdd(state: AppendixState, args: readonly string[]): Outcome {
  // `--` отключает разбор ключей: всё после него — путь (П8.27: git add -- u.txt).
  const dashAt = args.indexOf('--')
  const options = dashAt < 0 ? args.filter((a) => a.startsWith('-')) : args.slice(0, dashAt)
  const paths = dashAt < 0 ? args.filter((a) => !a.startsWith('-')) : args.slice(dashAt + 1)
  let all = false
  for (const option of options) {
    if (option === '-A' || option === '--all') all = true
    else return refuse(state, ae.form('add', option, ALLOWED.add))
  }
  if (all && paths.length > 0) return refuse(state, ae.form('add', args.join(' '), ALLOWED.add))
  if (paths.includes('.') && paths.length > 1) return refuse(state, ae.form('add', args.join(' '), ALLOWED.add))
  if (!all && paths.length === 0) return exited(state, ADD_NOTHING_SPECIFIED, 0)

  const wholeTree = all || paths[0] === '.'
  if (wholeTree) {
    const known = new Set([...Object.keys(state.working), ...Object.keys(state.index)])
    return exited({ ...state, index: stagePaths(state, [...known]) }, '', 0)
  }
  const foreign = paths.find((p) => hasGlobChars(p) || p.includes('/') || p.startsWith(':') || p === '..')
  if (foreign !== undefined) return refuse(state, ae.pathspecForm('add', foreign))
  // Путь известен git, если он есть в рабочем каталоге или индексе: удаление отслеживаемого файла тоже подготавливается (П8.27).
  const missing = paths.find((p) => !has(state.working, p) && !has(state.index, p))
  if (missing !== undefined) return exited(state, `fatal: pathspec '${missing}' did not match any files`, 128)
  return exited({ ...state, index: stagePaths(state, paths) }, '', 0)
}

// ---------- git commit ----------

/** Сообщение коммита после очистки git: пробелы в конце строки срезаются (`--cleanup=whitespace`, П8.26). */
function cleanMessage(raw: string): string {
  return raw.replace(/[ \t\r\n]+$/, '')
}

/** Разобранный `git commit`; `refusal` — форма, которую раздел не разбирает. */
interface CommitArgs {
  all: boolean
  message: string | null
  /** `-m` без значения: код 129. */
  missingValue: boolean
  refusal: string | null
}

function parseCommitArgs(args: readonly string[]): CommitArgs {
  const parsed: CommitArgs = { all: false, message: null, missingValue: false, refusal: null }
  let messages = 0
  const take = (value: string | undefined) => {
    messages++
    if (value === undefined) parsed.missingValue = true
    else parsed.message = value
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--message' || arg === '-m') {
      take(args[i + 1])
      i++
    } else if (arg.startsWith('--message=')) {
      take(arg.slice('--message='.length))
    } else if (arg === '--all') {
      parsed.all = true
    } else if (arg.startsWith('-') && !arg.startsWith('--') && arg.length > 1) {
      // Кластер коротких ключей: `a` и `m`; значение `m` — остаток кластера или следующее слово (П8.26: `-am`).
      let rest = arg.slice(1)
      while (rest.length > 0) {
        const letter = rest[0]
        rest = rest.slice(1)
        if (letter === 'a') parsed.all = true
        else if (letter === 'm') {
          if (rest.length > 0) take(rest)
          else {
            take(args[i + 1])
            i++
          }
          rest = ''
        } else {
          parsed.refusal = ae.form('commit', arg, ALLOWED.commit)
          return parsed
        }
      }
    } else {
      parsed.refusal = ae.form('commit', arg, ALLOWED.commit)
      return parsed
    }
  }
  if (messages > 1) parsed.refusal = ae.form('commit', args.join(' '), ALLOWED.commit)
  return parsed
}

export function handleCommit(state: AppendixState, args: readonly string[]): Outcome {
  const parsed = parseCommitArgs(args)
  if (parsed.refusal !== null) return refuse(state, parsed.refusal)
  // `error: switch `m' requires a value` — весь вывод git, без usage (П8.26).
  if (parsed.missingValue) return exited(state, "error: switch `m' requires a value", 129)

  const head = headTree(state)
  const nextIndex = parsed.all ? applyStageAll(state.index, state.working) : state.index
  if (sameTree(head, nextIndex)) {
    // Нечего коммитить: git печатает полный status и отвечает кодом 1, даже при пустом сообщении (П8.26).
    // Status строится по индексу с учётом -a (он собирается во временный индекс), а сам индекс остаётся прежним (П8.33).
    const first = statusFirstLine(state.head, state.lastCheckout, refsOf(state), null) as string
    const formatted = formatStatusWithCommits(first, head, nextIndex, state.working, { short: false })
    if (!formatted.ok) return refuse(state, formatted.reason === 'renameDetection' ? ae.renameDetection('commit') : ae.statusNestedPaths)
    return exited(state, formatted.output, 1)
  }
  if (parsed.message === null) return refuse(state, ae.commitNeedsMessage)
  const message = cleanMessage(parsed.message)
  if (message.trim() === '') return exited(state, 'Aborting commit due to empty commit message.', 1, ax.commitEmptyMessage)
  if (message.includes('\n')) return refuse(state, ae.form('commit', '-m <сообщение из нескольких строк>', ALLOWED.commit))

  const parent = currentCommitId(state)
  const commit: AppendixCommit = {
    id: fullCommitId(message, nextIndex, [parent], state.clock),
    parents: [parent],
    message,
    tree: { ...nextIndex },
    clock: state.clock,
  }
  const moved = advanceHead(state.head, state.branches, commit.id)
  const next: AppendixState = {
    ...state,
    commits: { ...state.commits, [commit.id]: commit },
    branches: moved.branches,
    head: moved.head,
    index: nextIndex,
    reflog: [{ id: commit.id, message: `commit: ${message.split('\n')[0]}` }, ...state.reflog],
    clock: state.clock + 1,
  }
  return exited(next, `[${commitLabel(state.head)} ${shortCommitId(commit.id)}] ${message}`, 0, ax.commitStatNotShown)
}

// ---------- git branch ----------

const BRANCH_INVALID = (name: string) =>
  [
    `fatal: '${name}' is not a valid branch name`,
    "hint: See 'git help check-ref-format'",
    'hint: Disable this message with "git config set advice.refSyntax false"',
  ].join('\n')

/** Имя, которое тренажёр для ветки не принимает, хотя git его допускает: с каталогом или совпадающее с тегом. */
function branchNameOutOfScope(state: AppendixState, name: string): string | null {
  if (name.includes('/')) return ae.refNameForm('ветки', name)
  if (has(state.tags, name)) return ae.branchNameIsTag(name)
  return null
}

export function handleBranch(state: AppendixState, args: readonly string[]): Outcome {
  const dashAt = args.indexOf('--')
  const options = dashAt < 0 ? args.filter((a) => a.startsWith('-')) : args.slice(0, dashAt)
  const names = dashAt < 0 ? args.filter((a) => !a.startsWith('-')) : args.slice(dashAt + 1)
  if (options.length > 0) return refuse(state, ae.form('branch', options[0], ALLOWED.branch))
  if (names.length > 2) return refuse(state, ae.form('branch', names.join(' '), ALLOWED.branch))

  if (names.length === 0) {
    const refs = refsOf(state)
    const detached = branchListFirstLine(state.head, state.lastCheckout, refs, null, null)
    const current = state.head.kind === 'branch' ? state.head.name : null
    const rows = branchNames(state).map((n) => `${n === current ? '* ' : '  '}${n}`)
    return exited(state, (detached === null ? rows : [detached, ...rows]).join('\n'), 0)
  }

  const [name, start] = names
  if (!isValidBranchName(name)) return exited(state, BRANCH_INVALID(name), 128)
  const outOfScope = branchNameOutOfScope(state, name)
  if (outOfScope !== null) return refuse(state, outOfScope)
  if (has(state.branches, name)) return exited(state, `fatal: a branch named '${name}' already exists`, 128)
  let tip = currentCommitId(state)
  if (start !== undefined) {
    const revision = resolveRevision(state, start)
    if (revision.kind === 'foreign') return refuse(state, ae.revisionForm('branch', start))
    if (revision.kind === 'missing') return exited(state, `fatal: not a valid object name: '${start}'`, 128)
    tip = revision.id
  }
  // `git branch` HEAD не двигает: в журнал HEAD ничего не пишется (П8.15).
  return exited({ ...state, branches: { ...state.branches, [name]: tip } }, '', 0)
}

// ---------- git checkout ----------

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
  carried.sort((x, y) => (x.file < y.file ? -1 : x.file > y.file ? 1 : 0))
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

/** Строки, которые git печатает при переходе на ветку (`Switched to …`, `Already on …`, `Previous HEAD position …`). */
function branchSwitchText(state: AppendixState, to: SwitchTarget): string {
  const printed = switchOutput(state.head, to, 'checkout', refsOf(state), graphOf(state), [])
  // Отказом `switchOutput` отвечает только на переход к коммиту; переход на ветку ему всегда по силам.
  if (!printed.ok) throw new Error('переход на ветку не может быть отказом')
  return printed.output
}

function switchToBranch(state: AppendixState, name: string): Outcome {
  const targetId = state.branches[name]
  const target = commitTree(state, targetId)
  const head = headTree(state)
  const block = checkSafety(head, state.index, state.working, target)
  if (block.modified.length > 0 || block.untracked.length > 0) {
    const isStaged = (f: string) => (has(state.index, f) ? state.index[f] : undefined) !== (has(head, f) ? head[f] : undefined)
    return exited(state, overwriteRefusal(block.modified.filter(isStaged), block.modified.filter((f) => !isStaged(f)), block.untracked), 1)
  }

  const to: SwitchTarget = { kind: 'branch', name, id: targetId, created: false }
  const printed = branchSwitchText(state, to)
  const tree = applyTargetTree(state, target)
  const entry = checkoutReflogEntry(state.head, to)
  const next: AppendixState = {
    ...state,
    head: { kind: 'branch', name },
    index: tree.index,
    working: tree.working,
    lastCheckout: entry === null ? state.lastCheckout : entry.lastCheckout,
    reflog: entry === null ? state.reflog : [{ id: targetId, message: entry.message }, ...state.reflog],
  }
  return exited(next, [...tree.carried, printed].join('\n'), 0)
}

function createAndSwitch(state: AppendixState, name: string): Outcome {
  if (!isValidBranchName(name)) return exited(state, BRANCH_INVALID(name), 128)
  const outOfScope = branchNameOutOfScope(state, name)
  if (outOfScope !== null) return refuse(state, outOfScope)
  if (has(state.branches, name)) return exited(state, `fatal: a branch named '${name}' already exists`, 128)
  const tip = currentCommitId(state)
  const to: SwitchTarget = { kind: 'branch', name, id: tip, created: true }
  const printed = branchSwitchText(state, to)
  const entry = checkoutReflogEntry(state.head, to)
  const next: AppendixState = {
    ...state,
    branches: { ...state.branches, [name]: tip },
    head: { kind: 'branch', name },
    lastCheckout: entry === null ? state.lastCheckout : entry.lastCheckout,
    reflog: entry === null ? state.reflog : [{ id: tip, message: entry.message }, ...state.reflog],
  }
  // Форма `checkout -b <имя>` из двух слов переносимые файлы не перечисляет (П8.28).
  return exited(next, printed, 0)
}

export function handleCheckout(state: AppendixState, args: readonly string[]): Outcome {
  if (args.length === 0) return refuse(state, ae.form('checkout', '', ALLOWED.checkout))
  if (args[0] === '-b') {
    // `error: switch `b' requires a value` — весь вывод git, без usage (П8.28).
    if (args.length === 1) return exited(state, "error: switch `b' requires a value", 129)
    if (args.length > 2) return refuse(state, ae.form('checkout', args.join(' '), ALLOWED.checkout))
    return createAndSwitch(state, args[1])
  }
  if (args.includes('--')) return refuse(state, ae.checkoutFile(args.join(' ')))
  if (args.length > 1) return refuse(state, ae.form('checkout', args.join(' '), ALLOWED.checkout))
  const name = args[0]
  if (name.startsWith('-')) return refuse(state, ae.form('checkout', name, ALLOWED.checkout))
  if (has(state.branches, name)) return switchToBranch(state, name)

  // Не ветка: тег, коммит или выражение отсоединили бы HEAD; имя файла восстановило бы файл.
  const revision = resolveRevision(state, name)
  if (revision.kind === 'commit') return refuse(state, ae.checkoutDetach(name))
  if (revision.kind === 'foreign') return refuse(state, ae.revisionForm('checkout', name))
  const head = headTree(state)
  if (has(state.working, name) || has(state.index, name) || has(head, name)) return refuse(state, ae.checkoutFile(name))
  return exited(state, `error: pathspec '${name}' did not match any file(s) known to git`, 1)
}

// ---------- git diff ----------

export function handleDiff(state: AppendixState, args: readonly string[]): Outcome {
  let staged = false
  for (const arg of args) {
    if (arg === '--staged' || arg === '--cached') staged = true
    else return refuse(state, ae.form('diff', arg, ALLOWED.diff))
  }
  if (staged) {
    const head = headTree(state)
    if (mayContainRename(head, state.index)) return refuse(state, ae.renameDetection('diff --staged'))
    return exited(state, diffTrees(head, state.index), 0)
  }
  // Без ключей: рабочий каталог против индекса, только отслеживаемые файлы (П8.31).
  const tracked: FileTree = {}
  for (const path of Object.keys(state.index)) if (has(state.working, path)) tracked[path] = state.working[path]
  return exited(state, diffTrees(state.index, tracked), 0)
}
