// ============================================================
// Раздел 8 git-тренажёра, шаг A: модель тайников (target.md, часть X, «Движок», «Тайник»; места
// 7–12). Здесь только состояние и правила, без текстов вывода; команды и вывод — appendixStash.ts.
// Правила сверены прогонами docs/git-trainer/reports/section8-git-runs.txt (П8.3, П8.14, П8.19) и
// appendix-g18e2-git-runs.txt (П8.41–П8.55).
//
// Сохранение (`git stash`): тайник берёт отслеживаемые файлы — всё, что есть в индексе. Рабочая
// версия тайника — индексные пути с содержимым из рабочего каталога; удалённый из каталога файл в
// ней отсутствует. Неотслеживаемые файлы остаются на месте (П8.3, П8.47). После сохранения индекс
// и отслеживаемые файлы равны HEAD (внутри git это `reset --hard`, отсюда запись журнала HEAD).
//
// Применение (`apply`, `pop` без `--index`): трёхстороннее слияние по путям. База — дерево коммита,
// на котором тайник сделан; «наши» — текущий индекс, а не HEAD (П8.49: индекс с той же правкой не
// мешает); «чужие» — рабочая версия тайника. Файлы раздела — одна строка, поэтому построчное слияние
// git совпадает с правилом «файл изменён с обеих сторон по-разному — конфликт» (target.md, «Движок»).
// После слияния рабочий каталог получает результат, индекс остаётся прежним, кроме новых путей: они
// подготавливаются (П8.47: подготовленный новый файл возвращается как `new file`, а подготовленная
// правка — неподготовленной).
// ============================================================
import type { AppendixState, AppendixStash, FileTree } from './appendixTypes'
import { mergeTrees } from './branchRepo'
import type { ConflictMerge } from './conflicts'
import { commitTree, currentCommitId, headTree, subjectOf } from './appendixRepo'
import { compareBytes } from './appendixRefs'
import { stashLabel } from './detachedHead'
import { fullCommitId, shortCommitId } from './sectionsCommon'
import { has } from './util'

const valueOf = (tree: FileTree, path: string): string | undefined => (has(tree, path) ? tree[path] : undefined)

/**
 * Файл, удалённый из индекса и созданный в рабочем каталоге заново (так бывает после удаления и
 * `git add`, пока имя свободно): git восстановил бы его версией HEAD поверх нового файла. Прогон
 * П8.47 это подтверждает, но модель такое сочетание дальше не ведёт — ответ даёт область.
 */
export function hasRecreatedPath(state: AppendixState): boolean {
  const head = headTree(state)
  return Object.keys(state.working).some((path) => has(head, path) && !has(state.index, path))
}

/** Есть что прятать: подготовленное или правка отслеживаемого файла. Один неотслеживаемый файл — нечего (П8.3). */
export function hasTrackedChanges(state: AppendixState): boolean {
  const head = headTree(state)
  const paths = new Set([...Object.keys(head), ...Object.keys(state.index)])
  for (const path of paths) {
    if (valueOf(head, path) !== valueOf(state.index, path)) return true
    if (has(state.index, path) && valueOf(state.working, path) !== state.index[path]) return true
  }
  return false
}

/**
 * Прячет правки: новый тайник встаёт на вершину стопки, индекс и отслеживаемые файлы возвращаются
 * к HEAD, неотслеживаемые остаются. На ветке журнал HEAD получает `reset: moving to HEAD`, в
 * отсоединённом HEAD записи нет (П8.14, П8.19). Условие вызова: `hasTrackedChanges` и нет
 * `hasRecreatedPath`. `message === null` — текст `WIP on …`.
 */
export function saveStash(state: AppendixState, message: string | null): AppendixState {
  const head = headTree(state)
  const base = currentCommitId(state)
  const label = stashLabel(state.head)
  const work: FileTree = {}
  for (const path of Object.keys(state.index)) if (has(state.working, path)) work[path] = state.working[path]
  const text = message === null ? `WIP on ${label}: ${shortCommitId(base)} ${subjectOf(state, base)}` : `On ${label}: ${message}`
  const entry: AppendixStash = {
    id: fullCommitId(text, work, [base], state.clock),
    text,
    branch: label,
    base,
    index: { ...state.index },
    work,
  }
  // Неотслеживаемые файлы остаются; всё остальное приводится к HEAD.
  const working: FileTree = { ...head }
  for (const path of Object.keys(state.working)) if (!has(state.index, path)) working[path] = state.working[path]
  return {
    ...state,
    stashes: [entry, ...state.stashes],
    index: { ...head },
    working,
    reflog: state.head.kind === 'branch' ? [{ id: base, message: 'reset: moving to HEAD' }, ...state.reflog] : state.reflog,
    clock: state.clock + 1,
  }
}

/** Убирает тайник `position` из стопки (0 — вершина). */
export function removeStash(state: AppendixState, position: number): AppendixState {
  return { ...state, stashes: state.stashes.filter((_, i) => i !== position) }
}

/**
 * Итог попытки применить тайник:
 * - `applied` — слияние прошло: новые индекс и рабочий каталог;
 * - `localChanges` — файлы, которые слияние изменило бы, а в рабочем каталоге в них уже своя правка (П8.3, П8.51);
 * - `untracked` — файлы, которые слияние создало бы, а такой неотслеживаемый файл уже лежит (П8.49);
 * - `conflict` — файл изменён и в тайнике, и в индексе так, что построчное слияние не сходится (К4.1, К4.6): слияние
 *   деревьев вместе с самими деревьями для `enterConflict`;
 * - `conflictKind` — конфликт другого вида (оба создали файл, один удалил): правило области;
 * - `unverified` — сочетание, порядок сообщений которого не сверен (оба вида отказа, конфликт вместе с неотслеживаемым
 *   файлом, построчное слияние без конфликта, пересозданный файл).
 * Правка того же файла в рабочем каталоге останавливает применение раньше конфликта: `localChanges` (К4.7).
 */
export type ApplyPlan =
  | { kind: 'applied'; index: FileTree; working: FileTree }
  | { kind: 'localChanges'; files: string[] }
  | { kind: 'untracked'; files: string[] }
  | { kind: 'conflict'; merge: ConflictMerge }
  | { kind: 'conflictKind'; files: string[] }
  | { kind: 'unverified' }

export function planApply(state: AppendixState, entry: AppendixStash): ApplyPlan {
  if (hasRecreatedPath(state)) return { kind: 'unverified' }
  const base = commitTree(state, entry.base)
  const ours = state.index
  const merged = mergeTrees(base, ours, entry.work)
  const conflictFiles = merged.conflicts.map((c) => c.file)
  // Построчное слияние одного файла без конфликта (правки в разных строках) прогонами тайника не сверено.
  if (merged.conflicts.length === 0 && merged.autoMerged.length > 0) return { kind: 'unverified' }
  const paths = [...new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(entry.work)])].sort(compareBytes)

  const changed: { path: string; result: string | undefined }[] = []
  for (const path of paths) {
    const b = valueOf(base, path)
    const o = valueOf(ours, path)
    const t = valueOf(entry.work, path)
    if (t === b || o === t || conflictFiles.includes(path)) continue
    changed.push({ path, result: t })
  }

  // Файлы, которых слияние касается: изменённые им и конфликтные.
  const localChanges: string[] = []
  const untracked: string[] = []
  for (const path of [...changed.map((c) => c.path), ...conflictFiles].sort(compareBytes)) {
    if (has(ours, path)) {
      if (valueOf(state.working, path) !== ours[path]) localChanges.push(path)
    } else if (has(state.working, path)) {
      untracked.push(path)
    }
  }
  if (localChanges.length > 0 && untracked.length > 0) return { kind: 'unverified' }
  if (localChanges.length > 0) return { kind: 'localChanges', files: localChanges }
  if (untracked.length > 0) return conflictFiles.length > 0 ? { kind: 'unverified' } : { kind: 'untracked', files: untracked }
  if (merged.conflicts.length > 0) {
    // Из трёх видов конфликта прогонялся один: изменили оба (К4.1).
    const other = merged.conflicts.filter((c) => c.kind !== 'content').map((c) => c.file)
    return other.length > 0 ? { kind: 'conflictKind', files: other } : { kind: 'conflict', merge: { ...merged, base, ours, theirs: entry.work } }
  }

  const index: FileTree = { ...ours }
  const working: FileTree = { ...state.working }
  for (const { path, result } of changed) {
    if (result === undefined) delete working[path]
    else {
      working[path] = result
      if (!has(ours, path)) index[path] = result
    }
  }
  return { kind: 'applied', index, working }
}

/**
 * `pop` и `apply` без `--index` подготовку не возвращают (П8.3, П8.47): подготовленная правка файла
 * становится неподготовленной. Истина, если в тайнике была подготовленная версия файла, которой
 * после применения нет в индексе. Подготовленный новый файл возвращается подготовленным (П8.47).
 */
export function stagingLost(state: AppendixState, entry: AppendixStash, newIndex: FileTree): boolean {
  const base = commitTree(state, entry.base)
  return Object.keys({ ...base, ...entry.index }).some((path) => valueOf(entry.index, path) !== valueOf(base, path) && valueOf(newIndex, path) !== valueOf(entry.index, path))
}
