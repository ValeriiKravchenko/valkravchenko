// ============================================================
// Отсоединённый HEAD: общий модуль разделов 6 и 8 (target.md, часть XII). Модуль не знает
// состояния разделов: функции берут узкие входы (HEAD, последний checkout, ветки, теги,
// коммиты с родителями) и возвращают данные или строки вывода git. Состояния, DOM, таймеров и
// сети нет.
//
// HEAD это размеченное объединение `Head`, а не строка: id коммита в поле с именем ветки
// молча даёт `branches[<id>] === undefined`. Кодировать отсоединённый HEAD строкой нельзя.
//
// Вывод git — английские литералы, не переводятся (часть III, правило 2; решение В4). Каждая
// строка и порядок строк сверены с прогонами git 2.53.0
// (docs/git-trainer/reports/detached-head-git-runs.txt, О1–О31, и section8-git-runs.txt,
// П8.12, П8.15, П8.18, П8.19). Строк тренажёра здесь нет.
//
// Ошибка игрока (отказ `switch` на коммит, отказ из-за правок) это предусмотренный результат с
// кодом возврата, а не исключение. Исключение бросается только при нарушении условий вызова:
// id коммита, которого нет в переданном графе.
// ============================================================
import { shortCommitId } from './sectionsCommon'

// ---------- типы ----------

export type Head = { kind: 'branch'; name: string } | { kind: 'detached'; id: string }

/**
 * Последний переход, который git записал в reflog как `checkout: moving from … to <spec>`.
 * `spec` — что стоит после `to`: как набрано, имя ветки или полный id; `id` — коммит, на котором
 * после перехода стоял HEAD. В разделе 8 это последняя запись `checkout:` журнала; в разделе 6
 * reflog нет и поле хранится отдельно, результат обязан совпасть.
 */
export interface LastCheckout {
  spec: string
  id: string
}

/** Ссылки на момент вызова. Значение — id коммита (аннотированный тег раскрывается до коммита). */
export interface Refs {
  branches: Readonly<Record<string, string>>
  tags: Readonly<Record<string, string>>
  /** `origin/<ветка>` → id. Необязательно: в разделе 8 удалённых веток нет. */
  remotes?: Readonly<Record<string, string>>
}

export interface CommitNode {
  parents: readonly string[]
  /** Полное сообщение; тема — первая строка. */
  message: string
}

export type CommitGraph = Readonly<Record<string, CommitNode>>

/**
 * Идущая операция, от которой зависят первые строки `git status` и `git branch`. Собственный
 * минимальный тип модуля: `conflicts.ts` (часть XI) на момент написания не существует.
 * `branch` — ветка, с которой начат rebase; `null`, если rebase начат с отсоединённого HEAD.
 */
export type OperationInput = { kind: 'rebase'; branch: string | null } | null

/**
 * Идущий bisect (раздел 6). `startedFrom` — откуда начат: ветка (`bisect started on master`)
 * или коммит (`bisect started on <id7>`). Собственный минимальный тип модуля.
 */
export type BisectInput = { startedFrom: Head } | null

// ---------- HEAD и подписи ----------

/** Коммит HEAD; `null`, если HEAD на ветке, у которой нет ни одного коммита. */
export function headCommit(head: Head, branches: Readonly<Record<string, string>>): string | null {
  if (head.kind === 'detached') return head.id
  return Object.prototype.hasOwnProperty.call(branches, head.name) ? branches[head.name] : null
}

/**
 * Новый коммит на HEAD (commit, cherry-pick, merge-перемотка, reset, шаг rebase): на ветке
 * двигает ветку, в отсоединённом HEAD меняет только `head.id`. Возвращает новые объекты, входы
 * не меняются. Reflog и `lastCheckout` не трогает.
 */
export function advanceHead(
  head: Head,
  branches: Readonly<Record<string, string>>,
  id: string,
): { head: Head; branches: Record<string, string> } {
  if (head.kind === 'detached') return { head: { kind: 'detached', id }, branches: { ...branches } }
  return { head, branches: { ...branches, [head.name]: id } }
}

/** Метка для `[<метка> <id7>] <тема>`: `master` или `detached HEAD`. */
export function commitLabel(head: Head): string {
  return head.kind === 'branch' ? head.name : 'detached HEAD'
}

/** Метка для `WIP on <метка>: …` и `On <метка>: <сообщение>` тайника: `master` или `(no branch)`. */
export function stashLabel(head: Head): string {
  return head.kind === 'branch' ? head.name : '(no branch)'
}

/** Начало подписи коммита в `git log` и `git reflog`: `HEAD -> master` или `HEAD`. */
export function decorationHead(head: Head): string {
  return head.kind === 'branch' ? `HEAD -> ${head.name}` : 'HEAD'
}

// ---------- X: как git называет место отсоединения ----------

function own<T>(map: Readonly<Record<string, T>> | undefined, key: string): T | undefined {
  if (map === undefined) return undefined
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined
}

/**
 * X из `HEAD detached at <X>` (таблица «Что такое X», часть XII). Считается при каждом вызове
 * из `lastCheckout.spec` и ссылок на этот момент. Порядок поиска имени как у `dwim_ref` git:
 * тег, ветка, удалённая ветка. Ссылка называет место, только пока указывает на `lastCheckout.id`;
 * иначе (тег перенесён или удалён, ветка удалена, `spec` не ссылка: id, `HEAD~1`, `HEAD@{1}`,
 * `HEAD`) X это 7 знаков id.
 * - тег `v1.1.0` и `tags/v1.1.0` → `v1.1.0`;
 * - `origin/master` → `origin/master`;
 * - ветка `master` и `refs/heads/master` → `refs/heads/master` (полное имя).
 */
export function detachedSource(lastCheckout: LastCheckout, refs: Refs): string {
  const { spec, id } = lastCheckout
  const tagName = spec.startsWith('tags/') ? spec.slice('tags/'.length) : spec
  const tagId = own(refs.tags, tagName)
  if (tagId !== undefined) return tagId === id ? tagName : shortCommitId(id)
  const branchName = spec.startsWith('refs/heads/') ? spec.slice('refs/heads/'.length) : spec
  const branchId = own(refs.branches, branchName)
  if (branchId !== undefined) return branchId === id ? `refs/heads/${branchName}` : shortCommitId(id)
  const remoteId = own(refs.remotes, spec)
  if (remoteId !== undefined) return remoteId === id ? spec : shortCommitId(id)
  return shortCommitId(id)
}

/**
 * `at <X>` или `from <X>`: `at` — HEAD стоит на `lastCheckout.id`, `from` — ушёл с него.
 * Вернулся на тот же коммит (reset, `rebase --abort`) — снова `at`. `null`, если HEAD на ветке.
 * Если `lastCheckout` нет (в отсоединённом HEAD такого не бывает), место называется по самому
 * HEAD: `at <id7>`.
 */
export function detachedLabel(head: Head, lastCheckout: LastCheckout | null, refs: Refs): string | null {
  if (head.kind === 'branch') return null
  if (lastCheckout === null) return `at ${shortCommitId(head.id)}`
  const where = head.id === lastCheckout.id ? 'at' : 'from'
  return `${where} ${detachedSource(lastCheckout, refs)}`
}

/**
 * Первая строка `git status`: `On branch <ветка>` или `HEAD detached at/from <X>`. `null`, если
 * HEAD отсоединён и идёт rebase: там первой идёт строка rebase из модуля конфликтов. Строки
 * bisect и сервера печатает раздел.
 */
export function statusFirstLine(head: Head, lastCheckout: LastCheckout | null, refs: Refs, operation: OperationInput): string | null {
  if (head.kind === 'branch') return `On branch ${head.name}`
  if (operation !== null) return null
  return `HEAD detached ${detachedLabel(head, lastCheckout, refs)}`
}

/**
 * Первая строка `git branch` по старшинству: идёт rebase (с ветки: `* (no branch, rebasing
 * <ветка>)`, с отсоединённого HEAD: `* (no branch, rebasing detached HEAD <X>)`); идёт bisect
 * (`* (no branch, bisect started on <ветка или id7>)`); `* (HEAD detached at/from <X>)`. `null`,
 * если HEAD на ветке (в том числе посреди bisect): тогда `*` стоит у ветки. Список веток печатает
 * раздел.
 */
export function branchListFirstLine(
  head: Head,
  lastCheckout: LastCheckout | null,
  refs: Refs,
  operation: OperationInput,
  bisect: BisectInput,
): string | null {
  if (head.kind === 'branch') return null
  if (operation !== null) {
    if (operation.branch !== null) return `* (no branch, rebasing ${operation.branch})`
    const x = lastCheckout === null ? shortCommitId(head.id) : detachedSource(lastCheckout, refs)
    return `* (no branch, rebasing detached HEAD ${x})`
  }
  if (bisect !== null) {
    const from = bisect.startedFrom
    return `* (no branch, bisect started on ${from.kind === 'branch' ? from.name : shortCommitId(from.id)})`
  }
  return `* (HEAD detached ${detachedLabel(head, lastCheckout, refs)})`
}

// ---------- брошенные коммиты ----------

function reachableFrom(starts: Iterable<string>, commits: CommitGraph): Set<string> {
  const seen = new Set<string>()
  const stack = [...starts]
  while (stack.length > 0) {
    const id = stack.pop() as string
    if (seen.has(id) || !Object.prototype.hasOwnProperty.call(commits, id)) continue
    seen.add(id)
    for (const p of commits[id].parents) stack.push(p)
  }
  return seen
}

/**
 * Коммиты, достижимые из `fromId` и недостижимые ни из одной ветки и ни из одного тега (и ни из
 * одной удалённой ветки, если они есть), новые сверху. Порядок: ребёнок раньше родителя; на
 * линейной истории это порядок git. У коммитов слияния порядок двух веток входа не определён
 * (в графе нет дат): сначала идёт первый родитель.
 */
export function orphans(fromId: string, refs: Refs, commits: CommitGraph): string[] {
  const tips = [...Object.values(refs.branches), ...Object.values(refs.tags), ...Object.values(refs.remotes ?? {})]
  const safe = reachableFrom(tips, commits)
  const lost = new Set([...reachableFrom([fromId], commits)].filter((id) => !safe.has(id)))
  if (!lost.has(fromId)) return []
  const waiting = new Map<string, number>()
  for (const id of lost) waiting.set(id, 0)
  for (const id of lost) for (const p of commits[id].parents) if (lost.has(p)) waiting.set(p, (waiting.get(p) as number) + 1)
  const out: string[] = []
  const queue = [fromId]
  while (queue.length > 0) {
    const id = queue.shift() as string
    out.push(id)
    for (const p of commits[id].parents) {
      if (!lost.has(p)) continue
      const left = (waiting.get(p) as number) - 1
      waiting.set(p, left)
      if (left === 0) queue.push(p)
    }
  }
  return out
}

function subject(id: string, commits: CommitGraph): string {
  if (!Object.prototype.hasOwnProperty.call(commits, id)) throw new Error(`коммита ${id} нет в графе`)
  return commits[id].message.split('\n')[0]
}

function describeCommit(id: string, commits: CommitGraph): string {
  return `${shortCommitId(id)} ${subject(id, commits)}`
}

/** Предупреждение `leaving … behind`: все коммиты до пяти, с шести первые четыре и ` ... and <n−4> more.`. */
function leavingWarning(lost: readonly string[], fromId: string, commits: CommitGraph): string[] {
  const n = lost.length
  const shown = n > 5 ? lost.slice(0, 4) : lost
  const list = shown.map((id) => `  ${describeCommit(id, commits)}`)
  if (n > 5) list.push(` ... and ${n - 4} more.`)
  return [
    `Warning: you are leaving ${n} ${n === 1 ? 'commit' : 'commits'} behind, not connected to`,
    'any of your branches:',
    '',
    ...list,
    '',
    `If you want to keep ${n === 1 ? 'it' : 'them'} by creating a new branch, this may be a good time`,
    'to do so with:',
    '',
    ` git branch <new-branch-name> ${shortCommitId(fromId)}`,
    '',
  ]
}

// ---------- переход ----------

/**
 * Куда переходим. `branch`: `id` — коммит ветки, `created` — новая ветка (`checkout -b`,
 * `switch -c`). `commit`: `spec` — что набрано буква в букву (в блоке `Note:` и в reflog), для
 * `checkout -` и bisect это полный id; `objectKind` — `tag`, если `spec` назвал тег (от этого
 * зависит текст отказа `switch`).
 */
export type SwitchTarget =
  | { kind: 'branch'; name: string; id: string; created: boolean }
  | { kind: 'commit'; id: string; spec: string; objectKind: 'commit' | 'tag' }

/**
 * Как набрана команда (важно только для перехода на коммит):
 * - `checkout`: `git checkout <ссылка>`; с ветки печатает блок `Note:`;
 * - `switch`: `git switch <ссылка>` без `--detach`; на коммит и тег отказ, код 128;
 * - `detach`: `--detach` (`checkout` и `switch`, со ссылкой и без); без `Note:`;
 * - `bisect`: переключение bisect (`good`, `bad`, `start`); не печатает ничего.
 */
export type SwitchMode = 'checkout' | 'switch' | 'detach' | 'bisect'

export type SwitchOutput =
  | { ok: true; exitCode: 0; output: string }
  | { ok: false; reason: 'branchExpected'; exitCode: 128; output: string }
  /** Форма, которой нет в прогонах: вызывающий раздел отвечает правилом области. */
  | { ok: false; reason: 'unverifiedForm' }

const DETACHED_NOTE = (spec: string): string[] => [
  `Note: switching to '${spec}'.`,
  '',
  "You are in 'detached HEAD' state. You can look around, make experimental",
  'changes and commit them, and you can discard any commits you make in this',
  'state without impacting any branches by switching back to a branch.',
  '',
  'If you want to create a new branch to retain commits you create, you may',
  'do so (now or later) by using -c with the switch command. Example:',
  '',
  '  git switch -c <new-branch-name>',
  '',
  'Or undo this operation with:',
  '',
  '  git switch -',
  '',
  'Turn off this advice by setting config variable advice.detachedHead to false',
  '',
]

/**
 * Строки перехода (раздел «Переход: что печатает git»), в порядке, который видит человек на
 * терминале (О24):
 * 1. `M\t<файл>` на каждый перенесённый файл из `carried` (в О7 и О16 они в конце: так сбрасывает
 *    буферы вывод вне терминала);
 * 2. уход с коммита, если новый коммит другой: `leaving … behind` или
 *    `Previous HEAD position was <id7> <тема>`;
 * 3. приход: блок `Note:` и `HEAD is now at …` (на коммит), `Switched to branch`,
 *    `Switched to a new branch`, `Already on`.
 * Правки не проверяет и файлы не переносит: это `checkSafety` и `applyTreeChange` раздела.
 * Вывод без завершающего перевода строки.
 */
export function switchOutput(
  from: Head,
  to: SwitchTarget,
  how: SwitchMode,
  refs: Refs,
  commits: CommitGraph,
  carried: readonly string[],
): SwitchOutput {
  if (to.kind === 'commit' && how === 'switch') {
    const output = [
      `fatal: a branch is expected, got ${to.objectKind} '${to.spec}'`,
      'hint: If you want to detach HEAD at the commit, try again with the --detach option.',
    ].join('\n')
    return { ok: false, reason: 'branchExpected', exitCode: 128, output }
  }
  // `checkout HEAD` с ветки в прогонах не снят.
  if (to.kind === 'commit' && from.kind === 'branch' && how === 'checkout' && to.spec === 'HEAD') {
    return { ok: false, reason: 'unverifiedForm' }
  }

  const lines = carried.map((file) => `M\t${file}`)
  if (to.kind === 'commit' && how === 'bisect') return { ok: true, exitCode: 0, output: lines.join('\n') }

  // `git checkout HEAD` из отсоединённого HEAD: пустой вывод (О1).
  const stay = to.kind === 'commit' && from.kind === 'detached' && how === 'checkout' && to.spec === 'HEAD'
  if (!stay) {
    if (from.kind === 'detached' && from.id !== to.id) {
      const lost = orphans(from.id, refs, commits)
      if (lost.length > 0) lines.push(...leavingWarning(lost, from.id, commits))
      else lines.push(`Previous HEAD position was ${describeCommit(from.id, commits)}`)
    }
    if (to.kind === 'branch') {
      if (to.created) lines.push(`Switched to a new branch '${to.name}'`)
      else if (from.kind === 'branch' && from.name === to.name) lines.push(`Already on '${to.name}'`)
      else lines.push(`Switched to branch '${to.name}'`)
    } else {
      if (from.kind === 'branch' && how === 'checkout') lines.push(...DETACHED_NOTE(to.spec))
      lines.push(`HEAD is now at ${describeCommit(to.id, commits)}`)
    }
  }
  return { ok: true, exitCode: 0, output: lines.join('\n') }
}

/** Отказ из-за правок, которые переход затёр бы (`checkSafety` вернул файлы): код 1, HEAD на месте (О7, О16, О24). */
export function overwriteRefusalOutput(files: readonly string[]): { exitCode: 1; output: string } {
  return {
    exitCode: 1,
    output: [
      'error: Your local changes to the following files would be overwritten by checkout:',
      ...files.map((f) => `\t${f}`),
      'Please commit your changes or stash them before you switch branches.',
      'Aborting',
    ].join('\n'),
  }
}

// ---------- reflog ----------

/** Откуда в записи `moving from <откуда>`: имя ветки или полный id. */
function reflogFrom(head: Head): string {
  return head.kind === 'branch' ? head.name : head.id
}

/**
 * Запись журнала HEAD для перехода: текст `checkout: moving from <ветка или id> to <куда>` и
 * новое `lastCheckout` (`spec` — имя ветки или как набрано, `id` — коммит после перехода).
 * `null`, если git записи не пишет: переход с коммита на тот же коммит командой, назвавшей
 * коммит (`checkout HEAD`, `checkout <тег на нём>`; О1, О13). Переход с коммита на ветку, стоящую
 * на том же коммите, запись пишет (О1).
 */
export function checkoutReflogEntry(from: Head, to: SwitchTarget): { message: string; lastCheckout: LastCheckout } | null {
  if (to.kind === 'commit' && from.kind === 'detached' && from.id === to.id) return null
  const toSpec = to.kind === 'branch' ? to.name : to.spec
  return {
    message: `checkout: moving from ${reflogFrom(from)} to ${toSpec}`,
    lastCheckout: { spec: toSpec, id: to.id },
  }
}

/**
 * Цель `git checkout -`: часть «from» последней записи `checkout: moving from … to …`.
 * `reflog` — тексты записей журнала HEAD, новая первой. Полный id (40 знаков) это коммит, иначе
 * имя ветки. `null`, если записей `checkout:` нет.
 */
export function previousPosition(reflog: readonly string[]): { kind: 'branch'; name: string } | { kind: 'commit'; id: string } | null {
  for (const message of reflog) {
    const m = /^checkout: moving from (\S+) to /.exec(message)
    if (m === null) continue
    return /^[0-9a-f]{40}$/.test(m[1]) ? { kind: 'commit', id: m[1] } : { kind: 'branch', name: m[1] }
  }
  return null
}
