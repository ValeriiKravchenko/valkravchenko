// ============================================================
// Раздел 8 git-тренажёра, шаги A и B: локальная работа — `status`, `add`, `commit`, `branch`,
// `diff` (target.md, часть X, «Что входит», строка «Локальная работа»). `checkout` и `switch` —
// appendixSwitch.ts, `branch -d` — appendixBranchDelete.ts. Нужна, чтобы
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
import { branchNames, currentCommitId, diffTrees, headTree, mayContainRename, refsOf, sameTree } from './appendixRepo'
import { isValidBranchName } from './appendixRefs'
import { reflogShortOutput, resolveRevision } from './appendixRevisions'
import { advanceHead, branchListFirstLine, commitLabel, statusFirstLine } from './detachedHead'
import { deleteBranches } from './appendixBranchDelete'
import { applyStageAll } from './commitFlags'
import { formatStatusWithCommits, fullCommitId, shortCommitId } from './sectionsCommon'
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

/** Короткий id вместо имени в `HEAD detached at <X>`: имя тега или ветки пропало, потому что ссылку переставили или удалили (О15). */
function isNameSpec(spec: string): boolean {
  const name = spec.startsWith('tags/') ? spec.slice('tags/'.length) : spec.startsWith('refs/heads/') ? spec.slice('refs/heads/'.length) : spec
  return /^[A-Za-z0-9._-]+$/.test(name) && name !== 'HEAD' && !/^[0-9a-f]{4,40}$/.test(name)
}

/** Пояснение к первой строке `git status` в отсоединённом HEAD: `at` или `from`, полное имя ветки, потерянное имя. */
function detachedStatusNote(state: AppendixState, first: string): string | null {
  const match = /^HEAD detached (at|from) (.+)$/.exec(first)
  if (state.head.kind !== 'detached' || match === null) return null
  const notes = [match[1] === 'at' ? ax.statusDetachedAt : ax.statusDetachedFrom]
  if (match[2].startsWith('refs/heads/')) notes.push(ax.statusRefsHeads)
  else if (state.lastCheckout !== null && match[2] === shortCommitId(state.lastCheckout.id) && isNameSpec(state.lastCheckout.spec)) notes.push(ax.statusNameLost)
  return notes.join(' ')
}

export function handleStatus(state: AppendixState, args: readonly string[]): Outcome {
  let short = false
  for (const arg of args) {
    if (arg === '-s' || arg === '--short') short = true
    else return refuse(state, ae.form('status', arg, ALLOWED.status))
  }
  const first = statusFirstLine(state.head, state.lastCheckout, refsOf(state), null) as string
  const formatted = formatStatusWithCommits(first, headTree(state), state.index, state.working, { short })
  if (!formatted.ok) return refuse(state, formatted.reason === 'renameDetection' ? ae.renameDetection('status') : ae.statusNestedPaths)
  return exited(state, formatted.output, 0, detachedStatusNote(state, first))
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
  const note = state.head.kind === 'detached' ? `${ax.commitStatNotShown} ${ax.commitDetached}` : ax.commitStatNotShown
  return exited(next, `[${commitLabel(state.head)} ${shortCommitId(commit.id)}] ${message}`, 0, note)
}

// ---------- git branch ----------

export const BRANCH_INVALID = (name: string) =>
  [
    `fatal: '${name}' is not a valid branch name`,
    "hint: See 'git help check-ref-format'",
    'hint: Disable this message with "git config set advice.refSyntax false"',
  ].join('\n')

/** Имя, которое тренажёр для ветки не принимает, хотя git его допускает: с каталогом или совпадающее с тегом. */
export function branchNameOutOfScope(state: AppendixState, name: string): string | null {
  if (name.includes('/')) return ae.refNameForm('ветки', name)
  if (has(state.tags, name)) return ae.branchNameIsTag(name)
  return null
}

export function handleBranch(state: AppendixState, args: readonly string[]): Outcome {
  const dashAt = args.indexOf('--')
  const options = dashAt < 0 ? args.filter((a) => a.startsWith('-')) : args.slice(0, dashAt)
  const names = dashAt < 0 ? args.filter((a) => !a.startsWith('-')) : args.slice(dashAt + 1)
  // `-d` и `-D` удаляют ветки, имён может быть сколько угодно (П8.63); остальные ключи в разделе не разбираются.
  if (options.length === 1 && (options[0] === '-d' || options[0] === '-D')) return deleteBranches(state, names, options[0] === '-D')
  if (options.length > 0) return refuse(state, ae.form('branch', options[0], ALLOWED.branch))
  if (names.length > 2) return refuse(state, ae.form('branch', names.join(' '), ALLOWED.branch))

  if (names.length === 0) {
    const refs = refsOf(state)
    const detached = branchListFirstLine(state.head, state.lastCheckout, refs, null, null)
    const current = state.head.kind === 'branch' ? state.head.name : null
    const rows = branchNames(state).map((n) => `${n === current ? '* ' : '  '}${n}`)
    return exited(state, (detached === null ? rows : [detached, ...rows]).join('\n'), 0, detached === null ? null : ax.branchListDetached)
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
    if (revision.kind === 'reflogShort') return exited(state, reflogShortOutput(revision.entries), 128, ax.reflogShortEntries)
    if (revision.kind === 'missing') return exited(state, `fatal: not a valid object name: '${start}'`, 128)
    tip = revision.id
  }
  // `git branch` HEAD не двигает: в журнал HEAD ничего не пишется (П8.15).
  return exited({ ...state, branches: { ...state.branches, [name]: tip } }, '', 0)
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
