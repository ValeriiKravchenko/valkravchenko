// ============================================================
// Раздел 8 git-тренажёра: исходное состояние и чтение модели (без команд).
// Исходное состояние — target.md, часть X, «Исходное состояние»: `master` (базовый коммит и
// «Добавить README»), `feature` (базовый, «fix: опечатка в логе», «Добавить страницу «О
// проекте»»), HEAD на `master`, рабочий каталог чист, тегов нет. Коммиты создаются в порядке
// логических часов: базовый, fix, «О проекте», README (П8.1).
// ============================================================
import type { AppendixCommit, AppendixState, FileTree, ReflogEntry } from './appendixTypes'
import type { CommitGraph, Refs } from './detachedHead'
import { decorationHead, headCommit } from './detachedHead'
import { fullCommitId } from './sectionsCommon'
import { diffBetween } from './inspectDiff'
import { compareBytes, sortBytes } from './appendixRefs'
import { has } from './util'
import { ru } from '../locales/ru'

const seed = ru.appendix.seed

/** Начальное состояние раздела 8. Журнал HEAD — как в П8.1. */
export function createAppendixSection(): AppendixState {
  const baseTree: FileTree = { 'app.js': seed.appBase }
  const fixTree: FileTree = { 'app.js': seed.appFixed }
  const aboutTree: FileTree = { 'app.js': seed.appFixed, 'about.html': seed.aboutHtml }
  const readmeTree: FileTree = { 'app.js': seed.appBase, 'README.md': seed.readme }

  const make = (message: string, tree: FileTree, parents: string[], clock: number): AppendixCommit => ({
    id: fullCommitId(message, tree, parents, clock),
    parents,
    message,
    tree,
    clock,
  })
  const base = make(seed.baseMessage, baseTree, [], 0)
  const fix = make(seed.fixMessage, fixTree, [base.id], 1)
  const about = make(seed.aboutMessage, aboutTree, [fix.id], 2)
  const readme = make(seed.readmeMessage, readmeTree, [base.id], 3)

  const reflog: ReflogEntry[] = [
    { id: readme.id, message: `commit: ${readme.message}` },
    { id: base.id, message: 'checkout: moving from feature to master' },
    { id: about.id, message: `commit: ${about.message}` },
    { id: fix.id, message: `commit: ${fix.message}` },
    { id: base.id, message: 'checkout: moving from master to feature' },
    { id: base.id, message: `commit (initial): ${base.message}` },
  ]
  return {
    commits: { [base.id]: base, [fix.id]: fix, [about.id]: about, [readme.id]: readme },
    branches: { master: readme.id, feature: about.id },
    head: { kind: 'branch', name: 'master' },
    lastCheckout: { spec: 'master', id: base.id },
    index: { ...readmeTree },
    working: { ...readmeTree },
    tags: {},
    reflog,
    history: [],
    missionsDone: { lightTag: false, annotatedShow: false },
    clock: 4,
  }
}

// ---------- чтение ----------

/** Коммит по id. Нарушение условия вызова (id, которого нет в состоянии) — исключение. */
export function commitOf(state: AppendixState, id: string): AppendixCommit {
  if (!has(state.commits, id)) throw new Error(`коммита ${id} нет в состоянии`)
  return state.commits[id]
}

/** Коммит HEAD. Ветка HEAD в разделе всегда существует и имеет коммит. */
export function currentCommitId(state: AppendixState): string {
  const id = headCommit(state.head, state.branches)
  if (id === null) throw new Error('у ветки HEAD нет коммита')
  return id
}

export function commitTree(state: AppendixState, id: string): FileTree {
  return commitOf(state, id).tree
}

export function headTree(state: AppendixState): FileTree {
  return commitTree(state, currentCommitId(state))
}

/** Ссылки для функций `detachedHead.ts`: теги раскрыты до коммитов. */
export function refsOf(state: AppendixState): Refs {
  const tags: Record<string, string> = {}
  for (const name of Object.keys(state.tags)) tags[name] = state.tags[name].commit
  return { branches: state.branches, tags }
}

/** Граф коммитов для функций `detachedHead.ts`. */
export function graphOf(state: AppendixState): CommitGraph {
  const graph: Record<string, { parents: readonly string[]; message: string }> = {}
  for (const id of Object.keys(state.commits)) graph[id] = { parents: state.commits[id].parents, message: state.commits[id].message }
  return graph
}

/** Тема коммита: первая строка сообщения. */
export function subjectOf(state: AppendixState, id: string): string {
  return commitOf(state, id).message.split('\n')[0]
}

export function branchNames(state: AppendixState): string[] {
  return sortBytes(Object.keys(state.branches))
}

export function tagNames(state: AppendixState): string[] {
  return sortBytes(Object.keys(state.tags))
}

/** Пути рабочего каталога в порядке байтов — для панели файлов. */
export function listWorkingFiles(state: AppendixState): string[] {
  return sortBytes(Object.keys(state.working))
}

/** Все коммиты, достижимые из `starts`. */
export function reachableFrom(state: AppendixState, starts: Iterable<string>): Set<string> {
  const seen = new Set<string>()
  const stack = [...starts]
  while (stack.length > 0) {
    const id = stack.pop() as string
    if (seen.has(id)) continue
    seen.add(id)
    for (const parent of commitOf(state, id).parents) stack.push(parent)
  }
  return seen
}

/**
 * Коммиты, достижимые из `starts`, новые сверху (по логическому моменту: родитель всегда
 * старше потомка, поэтому порядок совпадает с порядком `git log` на этих историях, П8.1).
 */
export function logOrder(state: AppendixState, starts: Iterable<string>): string[] {
  return [...reachableFrom(state, starts)].sort((a, b) => commitOf(state, b).clock - commitOf(state, a).clock)
}

/** Начала для `git log --all`: все ветки, все теги (раскрытые до коммитов) и HEAD. */
export function allStarts(state: AppendixState): string[] {
  return [...Object.values(state.branches), ...Object.values(state.tags).map((t) => t.commit), currentCommitId(state)]
}

// ---------- подписи ----------

/**
 * Подписи коммитов, как печатает `git log` на терминале (target.md, часть X, место 5): сначала
 * `HEAD -> ветка` или `HEAD`, затем теги в обратном порядке байтов, затем остальные ветки тоже в
 * обратном порядке байтов (П8.2, П8.15, П8.16). Ключ — id коммита; у коммита без подписей ключа нет.
 */
export function decorationMap(state: AppendixState): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const push = (id: string, label: string) => {
    const list = out.get(id)
    if (list === undefined) out.set(id, [label])
    else list.push(label)
  }
  const headId = currentCommitId(state)
  push(headId, decorationHead(state.head))
  const tags = Object.keys(state.tags).sort((a, b) => compareBytes(b, a))
  for (const name of tags) push(state.tags[name].commit, `tag: ${name}`)
  const current = state.head.kind === 'branch' ? state.head.name : null
  const branches = Object.keys(state.branches)
    .filter((name) => name !== current)
    .sort((a, b) => compareBytes(b, a))
  for (const name of branches) push(state.branches[name], name)
  return out
}

/** Подпись в скобках для одного коммита или пустая строка: ` (HEAD -> master, tag: v1)`. */
export function decorationText(decorations: ReadonlyMap<string, readonly string[]>, id: string): string {
  const list = decorations.get(id)
  return list === undefined ? '' : ` (${list.join(', ')})`
}

// ---------- diff ----------

/**
 * Файлы кончаются переводом строки, а `diffBetween` считает последнюю пустую часть строкой. Один
 * перевод строки в конце срезается: тогда вывод совпадает с git для файлов, кончающихся переводом
 * строки (маркера `\ No newline at end of file` нет, потому что его нет у git).
 */
function withoutFinalNewline(tree: FileTree): FileTree {
  const out: FileTree = {}
  for (const path of Object.keys(tree)) out[path] = tree[path].endsWith('\n') ? tree[path].slice(0, -1) : tree[path]
  return out
}

/** Unified diff между двумя деревьями в порядке имён; пустая строка, если различий нет. */
export function diffTrees(left: FileTree, right: FileTree): string {
  return diffBetween(withoutFinalNewline(left), withoutFinalNewline(right))
}

/** Деревья совпадают: те же пути и то же содержимое. */
export function sameTree(a: FileTree, b: FileTree): boolean {
  const ak = Object.keys(a)
  return ak.length === Object.keys(b).length && ak.every((p) => has(b, p) && a[p] === b[p])
}

/** Пути, которых нет слева, и пути, которых нет справа. */
function addedAndRemoved(left: FileTree, right: FileTree): { added: string[]; removed: string[] } {
  return {
    added: Object.keys(right).filter((p) => !has(left, p)).sort(compareBytes),
    removed: Object.keys(left).filter((p) => !has(right, p)).sort(compareBytes),
  }
}

/**
 * Git ищет переименования среди удалённых и добавленных файлов в `status`, `diff --staged` и
 * `show` (П8.24: точная копия под другим именем выводится как `renamed`). Модель похожесть
 * содержимого не считает, поэтому любую пару «есть удалённый и есть добавленный» вывод не
 * воспроизводит, а честно отказывает (П8.23: при разном содержимом переименования нет).
 */
export function mayContainRename(left: FileTree, right: FileTree): boolean {
  const { added, removed } = addedAndRemoved(left, right)
  return added.length > 0 && removed.length > 0
}
