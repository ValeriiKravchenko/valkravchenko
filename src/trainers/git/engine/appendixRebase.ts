// ============================================================
// Раздел 8 git-тренажёра, шаг B: `git rebase <ссылка>` на ветке (target.md, часть X, места 16–19, «Движок», «Упрощения»,
// «Миссии»; часть XII, «reflog: записи»). Коммиты ветки, которых нет в `<ссылке>`, переносятся поверх неё с новыми id; ветка
// переезжает на последний перенесённый коммит, старые коммиты остаются в журнале и бледнеют (`fadedCommitIds`). Прогоны:
// section8-git-runs.txt (П8.6–П8.12, П8.16–П8.18) и appendix-g18g3-git-runs.txt (П8.82–П8.88).
//
// Вывод успеха — итоговая строка `Successfully rebased and updated refs/heads/<ветка>.` Строки хода `Rebasing (k/n)<CR>` тренажёр не
// печатает (на терминале их затирает следующая строка, опасное место 16). Исходы:
// - переносить нечего (`<ссылка>` уже предок HEAD, в том числе сама ветка и HEAD) — `Current branch <ветка> is up to date.`, ничего не
//   меняется, записи в журнале нет (П8.6, П8.12, П8.82–П8.84, П8.87);
// - у ветки нет своих коммитов (`<ссылка>` впереди) — перемотка, та же итоговая строка, записи `start` и `finish` (П8.8, П8.16);
// - свои коммиты переносятся; те, чей патч уже есть в `<ссылка>..` с другой стороны (после `cherry-pick`), пропускаются:
//   `warning: skipped previously applied commit <id7>` на каждый, затем две строки `hint:` (П8.9, П8.10, П8.85). Запись журнала
//   HEAD: `rebase (start): checkout <ссылка как введена>`, `rebase (pick): <тема>` на каждый перенесённый, `rebase (finish): returning
//   to refs/heads/<ветка>` (П8.6, П8.9, П8.83, П8.84).
// Отказы git (ничего не меняется): слово не ссылка — `fatal: invalid upstream '<слово>'`, код 128, раньше проверки правок (П8.82);
// неподготовленная правка (в том числе удалённый отслеживаемый файл), подготовленная правка или обе — `error: cannot rebase: …`, код 1,
// раньше «up to date» (П8.12, П8.82); без аргументов — блок про отсутствие отслеживания, код 1, правки не влияют (П8.12, П8.88).
// Неотслеживаемый файл, не совпадающий с файлом результата, не мешает и остаётся (П8.12, П8.82).
// Отказы области (кода возврата нет): конфликт; перенос, после которого коммит пуст; все свои коммиты уже применены (git при этом
// переводит ветку на `<ссылку>`, П8.86, но состояние не заявлено в части X); неотслеживаемый файл на пути файла результата;
// ссылка `HEAD@{n}` и другие слова вне грамматики appendixRevisions.ts; ключи, несколько слов, `rebase` в отсоединённом HEAD (S8-71, П8.12, П8.18 — решение владельца, желательное).
// Успех, который не «up to date», засчитывает миссию 7.
// ============================================================
import type { AppendixCommit, AppendixState, FileTree } from './appendixTypes'
import { exited, refuse, type Outcome } from './appendixOutcome'
import { conflictForm, refusalOutcome } from './appendixConflicts'
import { markMission } from './appendixMissions'
import { mergeTrees } from './branchRepo'
import { compareBytes } from './appendixRefs'
import { commitOf, currentCommitId, fadedCommitIds, headTree, reachableFrom, sameTree, subjectOf } from './appendixRepo'
import { resolveRevision } from './appendixRevisions'
import { fullCommitId, shortCommitId } from './sectionsCommon'
import { has } from './util'
import { ru } from '../locales/ru'

const ae = ru.appendix.errors
const ax = ru.appendix.explain

/** Ответ на `git rebase` без аргументов (П8.12, П8.88): `<ветка>` подставляется, код 1. Кончается переводом строки. */
function noTrackingOutput(branch: string): string {
  return [
    'There is no tracking information for the current branch.',
    'Please specify which branch you want to rebase against.',
    'See git-rebase(1) for details.',
    '',
    "    git rebase '<branch>'",
    '',
    'If you wish to set tracking information for this branch you can do so with:',
    '',
    `    git branch --set-upstream-to=<remote>/<branch> ${branch}`,
    '',
  ].join('\n')
}

const SKIPPED_HINTS = ['hint: use --reapply-cherry-picks to include skipped commits', 'hint: Disable this message with "git config set advice.skippedCherryPicks false"']

/** Неподготовленные правки: отслеживаемый (есть в индексе) файл в рабочем каталоге изменён или удалён. */
function hasUnstaged(state: AppendixState): boolean {
  return Object.keys(state.index).some((path) => !has(state.working, path) || state.working[path] !== state.index[path])
}

/** Отказ из-за правок (П8.12, П8.82): неподготовленная, подготовленная или обе. */
function dirtyOutput(unstaged: boolean, staged: boolean): string {
  const first = unstaged ? 'error: cannot rebase: You have unstaged changes.' : 'error: cannot rebase: Your index contains uncommitted changes.'
  return [first, ...(unstaged && staged ? ['error: additionally, your index contains uncommitted changes.'] : []), 'error: Please commit or stash them.'].join('\n')
}

/** Патч коммита по первому родителю: путь → (до, после); ключ для сравнения «тот же патч» (patch-id git). */
function patchKey(state: AppendixState, commit: AppendixCommit): string {
  const before: FileTree = commit.parents.length === 0 ? {} : commitOf(state, commit.parents[0]).tree
  const paths = [...new Set([...Object.keys(before), ...Object.keys(commit.tree)])].sort(compareBytes)
  const changes = paths.filter((p) => before[p] !== commit.tree[p]).map((p) => [p, has(before, p) ? before[p] : null, has(commit.tree, p) ? commit.tree[p] : null])
  return JSON.stringify(changes)
}

function plural(count: number): string {
  return count % 10 === 1 && count % 100 !== 11 ? 'коммит' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20) ? 'коммита' : 'коммитов'
}

export function handleRebase(state: AppendixState, args: readonly string[]): Outcome {
  if (state.head.kind === 'detached') return refuse(state, ae.rebaseDetached)
  const branch = state.head.name
  if (args.length === 0) return exited(state, noTrackingOutput(branch), 1, ax.rebaseNoTracking)
  const options = args.filter((a) => a.startsWith('-'))
  if (options.length > 0 || args.length > 1) return refuse(state, ae.form('rebase', options[0] ?? args.join(' '), ru.appendix.allowed.rebase))

  const word = args[0]
  const revision = resolveRevision(state, word)
  // `HEAD@{n}` как основу прогоны не показывают: как git запишет её в `rebase (start)`, не сверено.
  if (revision.kind === 'foreign' || revision.kind === 'reflogShort' || word.includes('@{')) return refuse(state, ae.revisionForm('rebase', word))
  if (revision.kind === 'missing') return exited(state, `fatal: invalid upstream '${word}'`, 128, ax.rebaseInvalidUpstream)

  // Неслитые пути: `needs merge` и отказ из-за правок (К1.2, К4.2). Операция без неслитых путей: подготовленная правка отказывает, как обычно (К12.c5).
  const blocked = refusalOutcome(state, { name: 'rebase' })
  if (blocked !== null) return blocked
  const unstaged = hasUnstaged(state)
  const staged = !sameTree(state.index, headTree(state))
  if (unstaged || staged) return exited(state, dirtyOutput(unstaged, staged), 1, unstaged && staged ? ax.rebaseRefusedBoth : unstaged ? ax.rebaseRefusedUnstaged : ax.rebaseRefusedStaged)
  // Операция идёт, а индекс и каталог чисты (пустой cherry-pick): ответ git не сверен.
  if (state.operation !== null) return conflictForm(state, `rebase ${word}`)

  const upstream = revision.id
  const tip = currentCommitId(state)
  const ownSide = reachableFrom(state, [tip])
  if (ownSide.has(upstream)) return exited(state, `Current branch ${branch} is up to date.`, 0, ax.rebaseUpToDate)

  const upstreamSide = reachableFrom(state, [upstream])
  // Свои коммиты, от старого к новому. Коммитов слияния в разделе нет; корневой коммит не бывает «своим» (общий корень).
  const own: AppendixCommit[] = []
  for (let id = tip; !upstreamSide.has(id); id = commitOf(state, id).parents[0]) {
    const commit = commitOf(state, id)
    if (commit.parents.length !== 1) return refuse(state, ae.rebaseUnverified)
    own.unshift(commit)
  }
  const applied = new Set([...upstreamSide].filter((id) => !ownSide.has(id)).map((id) => patchKey(state, commitOf(state, id))))
  const skipped = own.filter((c) => applied.has(patchKey(state, c)))
  const picked = own.filter((c) => !applied.has(patchKey(state, c)))
  if (own.length > 0 && picked.length === 0) return refuse(state, ae.rebaseAllApplied)

  // Перенос: трёхстороннее слияние коммит за коммитом поверх `upstream`.
  const created: AppendixCommit[] = []
  let parent = upstream
  let tree = commitOf(state, upstream).tree
  for (const commit of picked) {
    const before: FileTree = commitOf(state, commit.parents[0]).tree
    const merged = mergeTrees(before, tree, commit.tree)
    if (merged.conflicts.length > 0) return refuse(state, ae.rebaseConflict(merged.conflicts.map((c) => c.file)))
    if (sameTree(merged.tree, tree)) return refuse(state, ae.rebaseEmpty(subjectOf(state, commit.id)))
    const clock = state.clock + created.length
    const copy: AppendixCommit = { id: fullCommitId(commit.message, merged.tree, [parent], clock), parents: [parent], message: commit.message, tree: { ...merged.tree }, clock }
    created.push(copy)
    parent = copy.id
    tree = copy.tree
  }

  // Рабочий каталог: отслеживаемые файлы берут содержимое результата, неотслеживаемые остаются; совпадение с файлом результата — отказ области.
  const working: FileTree = {}
  for (const path of Object.keys(state.working)) {
    if (has(state.index, path)) continue
    if (has(tree, path)) return refuse(state, ae.rebaseUntracked(path))
    working[path] = state.working[path]
  }
  Object.assign(working, tree)

  const finish = created.length > 0 ? created[created.length - 1].id : upstream
  const entries = [
    { id: finish, message: `rebase (finish): returning to refs/heads/${branch}` },
    ...[...created].reverse().map((c) => ({ id: c.id, message: `rebase (pick): ${c.message.split('\n')[0]}` })),
    { id: upstream, message: `rebase (start): checkout ${word}` },
  ]
  const commits = { ...state.commits }
  for (const c of created) commits[c.id] = c
  const next: AppendixState = {
    ...state,
    commits,
    branches: { ...state.branches, [branch]: finish },
    index: { ...tree },
    working,
    reflog: [...entries, ...state.reflog],
    clock: state.clock + created.length,
  }
  const output = [
    ...skipped.map((c) => `warning: skipped previously applied commit ${shortCommitId(c.id)}`),
    ...(skipped.length > 0 ? SKIPPED_HINTS : []),
    `Successfully rebased and updated refs/heads/${branch}.`,
  ].join('\n')
  const notes: string[] = [created.length > 0 ? ax.rebaseMoved(created.length) : ax.rebaseFastForward(branch, shortCommitId(upstream))]
  if (skipped.length > 0) notes.push(ax.rebaseSkipped)
  const left = [...fadedCommitIds(next)].filter((id) => !fadedCommitIds(state).has(id)).length
  if (left > 0) notes.push(ax.rebaseLeftBehind(left, plural(left)))
  return exited(markMission(next, 'rebase'), output, 0, notes.join(' '))
}
