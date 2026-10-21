// ============================================================
// Раздел 8 git-тренажёра, шаг B: `git cherry-pick <ссылка>` (target.md, часть X, место 13, «Автор и дата в разделе 8»,
// «Что НЕ входит», «Миссии»; часть XII, «Команды в отсоединённом HEAD»). Копия коммита ложится поверх HEAD с новым id,
// оригинал остаётся на месте. Прогоны: section8-git-runs.txt (П8.4, П8.10), detached-head-git-runs.txt (О18) и
// appendix-g18g2-git-runs.txt (П8.75–П8.78, П8.80).
//
// Вывод успеха — только первая строка `[<ветка> <id7>] <тема>` или `[detached HEAD <id7>] <тема>`: ` Date:` (дата оригинала),
// диффстат и `create mode` тренажёр не печатает. Запись журнала HEAD — `cherry-pick: <тема>`; на ветке двигается ветка,
// в отсоединённом HEAD — только HEAD. Успех засчитывает миссию 5.
//
// Отказы git (код возврата, ничего не меняется):
// - без аргументов — usage, код 129 (П8.4);
// - слова, которого нет среди ссылок, — `fatal: bad revision '<слово>'`, код 128 (П8.4, П8.76);
// - неслитые пути (конфликт тайника или cherry-pick) — `Cherry-picking is not possible because you have unmerged files.`, код 128 (К4.2, К5.2);
// - в индексе есть подготовленная правка (любая, в любом файле, даже когда копия пуста; в том числе посреди cherry-pick после `git add`) —
//   `error: your local changes would be overwritten by cherry-pick.`, код 128 (П8.77, П8.80, К12.c4);
// - файл, который меняет коммит, изменён в рабочем каталоге или совпадает с неотслеживаемым файлом — блоки `would be overwritten by
//   merge` (изменённые файлы первым блоком, неотслеживаемые вторым, один `Aborting`), код 128 (П8.4, П8.10, П8.77, П8.80). Файл,
//   удалённый в рабочем каталоге без `git rm`, git создаёт заново, ошибки нет (П8.80). Правка в файле, которого коммит не касается,
//   не мешает и остаётся (П8.77).
// Конфликт (часть XI, К5): `Auto-merging`, `CONFLICT (content)`, `error: could not apply`, подсказки, код 1; операция `cherry-pick`, неслитые
// пути, метки `HEAD` и `<id7> (<тема>)` в файле, ветка и HEAD на месте, записи журнала нет. Пустая копия (изменение уже есть в HEAD) —
// тоже незаконченная операция без неслитых путей: подсказка про `--skip`, статус, код 1 (П8.4). Выходы: `--continue` после `git add`
// (`[<ветка> <id7>] <тема>`, запись `commit (cherry-pick): <тема>`, миссия 5; итог совпал с HEAD — та же подсказка, что у пустой копии,
// К5.6), `--skip` и `--abort` (пусто, запись `reset: moving to <полный id>`, К5.3, К5.7, К7.3, К7.4). Без операции `--continue` и `--abort`
// отвечают `error: no cherry-pick or revert in progress` (К5.3), `--skip` без операции — отказ области. Завершает операцию и
// `git commit` (appendixLocal.ts, К5.5, К7.2, К7.11, К8.2).
// Отказы области (ничего не меняется, кода возврата нет): ключи (в том числе `--quit`), несколько ссылок, удаление файла коммитом при
// изменённом файле в рабочем каталоге, конфликт и пустая копия в отсоединённом HEAD, конфликт другого вида (оба создали, изменение
// и удаление), конфликт вместе с правкой в тех же файлах, новый cherry-pick посреди незаконченного.
// ============================================================
import type { AppendixCommit, AppendixState, FileTree } from './appendixTypes'
import { exited, refuse, type Outcome } from './appendixOutcome'
import { markMission } from './appendixMissions'
import { mergeTrees } from './branchRepo'
import type { TreeMergeResult } from './branchRepo'
import { compareBytes } from './appendixRefs'
import { conflictForm, refusalOutcome, stateStatus, statusRefusal } from './appendixConflicts'
import { recordCommit } from './appendixLocal'
import { commitOf, currentCommitId, headTree, sameTree, subjectOf } from './appendixRepo'
import { reflogShortOutput, resolveRevision } from './appendixRevisions'
import { abortTo, conflictOutput, enterConflict } from './conflicts'
import { advanceHead, commitLabel } from './detachedHead'
import { fullCommitId, shortCommitId } from './sectionsCommon'
import { has } from './util'
import { ru } from '../locales/ru'

const ae = ru.appendix.errors
const ax = ru.appendix.explain

/** Вывод `git cherry-pick` без аргументов (П8.4), код 129. */
const USAGE = [
  'usage: git cherry-pick [--edit] [-n] [-m <parent-number>] [-s] [-x] [--ff]',
  '                       [-S[<keyid>]] <commit>...',
  '   or: git cherry-pick (--continue | --skip | --abort | --quit)',
  '',
  '    --quit                end revert or cherry-pick sequence',
  '    --continue            resume revert or cherry-pick sequence',
  '    --abort               cancel revert or cherry-pick sequence',
  '    --skip                skip current commit and continue',
  '    --[no-]cleanup <mode> how to strip spaces and #comments from message',
  "    -n, --no-commit       don't automatically commit",
  '    --commit              opposite of --no-commit',
  '    -e, --[no-]edit       edit the commit message',
  '    -s, --[no-]signoff    add a Signed-off-by trailer',
  '    -m, --[no-]mainline <parent-number>',
  '                          select mainline parent',
  '    --[no-]rerere-autoupdate',
  '                          update the index with reused conflict resolution if possible',
  '    --[no-]strategy <strategy>',
  '                          merge strategy',
  '    -X, --[no-]strategy-option <option>',
  '                          option for merge strategy',
  '    -S, --[no-]gpg-sign[=<key-id>]',
  '                          GPG sign commit',
  '    -x                    append commit name',
  '    --[no-]ff             allow fast-forward',
  '    --[no-]allow-empty    preserve initially empty commits',
  '    --[no-]allow-empty-message',
  '                          allow commits with empty messages',
  '    --[no-]keep-redundant-commits',
  '                          deprecated: use --empty=keep instead',
  '    --empty (stop|drop|keep)',
  '                          how to handle commits that become empty',
  '',
].join('\n')

/** Отказ при подготовленной правке (П8.77): одинаков для любого файла, до разбора самой копии. */
const STAGED_REFUSAL = [
  'error: your local changes would be overwritten by cherry-pick.',
  'hint: commit your changes or stash them to proceed.',
  'fatal: cherry-pick failed',
].join('\n')

/** Отказ из-за изменённых и неотслеживаемых файлов, которые копия затёрла бы (П8.4, П8.80). */
function overwriteRefusal(modified: readonly string[], untracked: readonly string[]): string {
  const parts: string[] = []
  if (modified.length > 0) {
    parts.push('error: Your local changes to the following files would be overwritten by merge:', ...modified.map((f) => `\t${f}`), 'Please commit your changes or stash them before you merge.')
  }
  if (untracked.length > 0) {
    parts.push('error: The following untracked working tree files would be overwritten by merge:', ...untracked.map((f) => `\t${f}`), 'Please move or remove them before you merge.')
  }
  return [...parts, 'Aborting', 'fatal: cherry-pick failed'].join('\n')
}

/** Пустая копия, с начала (П8.4) или после разрешения (К5.6): подсказка git, за ней `git status`. */
const EMPTY_HINT = [
  'The previous cherry-pick is now empty, possibly due to conflict resolution.',
  'If you wish to commit it anyway, use:',
  '',
  '    git commit --allow-empty',
  '',
  "Otherwise, please use 'git cherry-pick --skip'",
]

/** `--abort` и `--continue`, когда cherry-pick не идёт (К5.3). */
const NO_CHERRY_PICK = ['error: no cherry-pick or revert in progress', 'fatal: cherry-pick failed'].join('\n')

/** Дерево родителя коммита; у корневого коммита — пустое. */
function parentTree(state: AppendixState, commit: AppendixCommit): FileTree {
  return commit.parents.length === 0 ? {} : commitOf(state, commit.parents[0]).tree
}

/** Операция идёт без неслитых путей и без изменений в индексе: ответ — подсказка и статус, код 1. */
function emptyOutcome(state: AppendixState): Outcome {
  const status = stateStatus(state, false)
  if (!status.ok) return refuse(state, statusRefusal(status.reason, 'cherry-pick'))
  return exited(state, [...EMPTY_HINT, status.output].join('\n'), 1, ru.conflicts.cherryPickEmpty)
}

/** Пути, которых касается копия: у них результат слияния отличается от HEAD (в том числе конфликтные). */
function touchedPaths(head: FileTree, merged: TreeMergeResult): string[] {
  return [...new Set([...Object.keys(head), ...Object.keys(merged.tree)])].filter((f) => head[f] !== merged.tree[f]).sort(compareBytes)
}

/** Конфликт (К5.1): метки в файле, неслитые пути, операция `cherry-pick`. */
function conflictOutcome(state: AppendixState, picked: AppendixCommit, merged: TreeMergeResult, head: FileTree): Outcome {
  if (state.head.kind === 'detached') return refuse(state, ae.cherryPickDetachedStop)
  const otherKinds = merged.conflicts.filter((c) => c.kind !== 'content').map((c) => c.file)
  if (otherKinds.length > 0) return refuse(state, ae.cherryPickConflictKind(otherKinds))
  // Конфликт вместе с правкой в тех же файлах: порядок отказов git не сверен.
  const dirty = touchedPaths(head, merged).filter((f) => (has(head, f) ? !has(state.working, f) || state.working[f] !== head[f] : has(state.working, f)))
  if (dirty.length > 0) return refuse(state, ae.cherryPickConflictDirty(dirty))
  const subject = picked.message.split('\n')[0]
  const entered = enterConflict(
    { ...state, operation: { kind: 'cherry-pick' as const, commit: picked.id } },
    { ...merged, base: parentTree(state, picked), ours: head, theirs: picked.tree },
    { top: 'HEAD', bottom: `${shortCommitId(picked.id)} (${subject})` },
  )
  const output = conflictOutput({ command: 'cherry-pick', merge: merged, commit: { id: picked.id, subject } })
  return exited(entered, output, 1, ru.conflicts.cherryPickConflict(merged.conflicts.map((c) => c.file)))
}

/** `--continue` (К5.4, К5.6, К16.6): завершает cherry-pick, когда все пути добавлены. */
function continuePick(state: AppendixState, operationCommit: string): Outcome {
  const blocked = refusalOutcome(state, { name: 'commit' })
  if (blocked !== null) return blocked
  if (sameTree(state.index, headTree(state))) return emptyOutcome(state)
  const picked = commitOf(state, operationCommit)
  const subject = picked.message.split('\n')[0]
  const made = recordCommit(state, picked.message, state.index, `commit (cherry-pick): ${subject}`)
  return exited(markMission(made.state, 'cherryPick'), `[${commitLabel(state.head)} ${shortCommitId(made.commitId)}] ${subject}`, 0, ru.conflicts.cherryPickFinished)
}

/** `--abort` и `--skip` (К5.3, К5.7): файлы, которых касалась операция, возвращаются к HEAD; запись журнала `reset: moving to <полный id>` (К7.3, К7.4). */
function endPick(state: AppendixState, flag: '--abort' | '--skip'): Outcome {
  const aborted = abortTo(state, headTree(state))
  const lost = Object.keys({ ...state.working, ...aborted.working }).filter((f) => state.working[f] !== aborted.working[f]).sort(compareBytes)
  const id = currentCommitId(state)
  const next: AppendixState = { ...aborted, reflog: [{ id, message: `reset: moving to ${id}` }, ...state.reflog] }
  const notes = [flag === '--abort' ? ru.conflicts.cherryPickAborted : ru.conflicts.cherryPickSkipped]
  if (lost.length > 0) notes.push(ru.conflicts.discardedEdit(lost))
  return exited(next, '', 0, notes.join(' '))
}

function sequencerStep(state: AppendixState, flag: '--continue' | '--abort' | '--skip'): Outcome {
  const operation = state.operation
  if (operation === null) return flag === '--skip' ? refuse(state, ae.cherryPickSkipIdle) : exited(state, NO_CHERRY_PICK, 128)
  return flag === '--continue' ? continuePick(state, operation.commit) : endPick(state, flag)
}

export function handleCherryPick(state: AppendixState, args: readonly string[]): Outcome {
  if (args.length === 0) return exited(state, USAGE, 129, ax.cherryPickUsage)
  if (args.length === 1 && (args[0] === '--continue' || args[0] === '--abort' || args[0] === '--skip')) return sequencerStep(state, args[0])
  const options = args.filter((a) => a.startsWith('-'))
  if (options.length > 0 || args.length > 1) return refuse(state, ae.form('cherry-pick', options[0] ?? args.join(' '), ru.appendix.allowed.cherryPick))

  const word = args[0]
  const revision = resolveRevision(state, word)
  if (revision.kind === 'foreign') return refuse(state, ae.revisionForm('cherry-pick', word))
  if (revision.kind === 'reflogShort') return exited(state, reflogShortOutput(revision.entries), 128, ax.reflogShortEntries)
  if (revision.kind === 'missing') return exited(state, `fatal: bad revision '${word}'`, 128, ax.cherryPickBadRevision)

  // Неслитые пути запрещают cherry-pick (К4.2, К5.2).
  const blocked = refusalOutcome(state, { name: 'cherry-pick' })
  if (blocked !== null) return blocked
  const head = headTree(state)
  // Подготовленная правка останавливает cherry-pick раньше, чем разбор самой копии (П8.80: даже при пустой копии).
  if (!sameTree(state.index, head)) return exited(state, STAGED_REFUSAL, 128, ax.cherryPickRefusedStaged)
  // Операция идёт, индекс чист (пустая копия): новый cherry-pick прогонами не сверен.
  if (state.operation !== null) return conflictForm(state, `cherry-pick ${word}`)

  const picked = commitOf(state, revision.id)
  const merged = mergeTrees(parentTree(state, picked), head, picked.tree)
  if (merged.conflicts.length > 0) return conflictOutcome(state, picked, merged, head)
  if (sameTree(merged.tree, head)) {
    if (state.head.kind === 'detached') return refuse(state, ae.cherryPickDetachedStop)
    return emptyOutcome({ ...state, operation: { kind: 'cherry-pick', commit: picked.id } })
  }

  // Файлы, которые копия меняет: у них результат отличается от HEAD.
  const touched = touchedPaths(head, merged)
  const modified: string[] = []
  const untracked: string[] = []
  for (const file of touched) {
    const inHead = has(head, file)
    const inWorking = has(state.working, file)
    if (!inHead) {
      if (inWorking) untracked.push(file)
    } else if (!has(merged.tree, file)) {
      // Коммит удаляет файл: как git ответит на изменённый или удалённый в каталоге файл, не сверено.
      if (!inWorking || state.working[file] !== head[file]) return refuse(state, ae.cherryPickUnverified(file))
    } else if (inWorking && state.working[file] !== head[file]) modified.push(file)
  }
  if (modified.length > 0 || untracked.length > 0) {
    const note = modified.length > 0 ? ax.cherryPickRefusedEdit : ax.cherryPickRefusedUntracked
    return exited(state, overwriteRefusal(modified, untracked), 128, note)
  }

  const parent = currentCommitId(state)
  const commit: AppendixCommit = {
    id: fullCommitId(picked.message, merged.tree, [parent], state.clock),
    parents: [parent],
    message: picked.message,
    tree: { ...merged.tree },
    clock: state.clock,
  }
  const moved = advanceHead(state.head, state.branches, commit.id)
  // Файлы копии берут содержимое результата, остальное (правки в других файлах) остаётся.
  const working: FileTree = { ...state.working }
  for (const file of touched) {
    if (has(merged.tree, file)) working[file] = merged.tree[file]
    else delete working[file]
  }
  const next: AppendixState = {
    ...state,
    commits: { ...state.commits, [commit.id]: commit },
    branches: moved.branches,
    head: moved.head,
    index: { ...merged.tree },
    working,
    reflog: [{ id: commit.id, message: `cherry-pick: ${subjectOf(state, picked.id)}` }, ...state.reflog],
    clock: state.clock + 1,
  }
  const note = state.head.kind === 'detached' ? `${ax.cherryPickDone} ${ax.cherryPickDetached}` : ax.cherryPickDone
  return exited(markMission(next, 'cherryPick'), `[${commitLabel(state.head)} ${shortCommitId(commit.id)}] ${commit.message.split('\n')[0]}`, 0, note)
}
