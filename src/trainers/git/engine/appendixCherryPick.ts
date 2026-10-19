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
// - в индексе есть подготовленная правка (любая, в любом файле, даже когда копия пуста) — `error: your local changes would be
//   overwritten by cherry-pick.`, код 128 (П8.77, П8.80);
// - файл, который меняет коммит, изменён в рабочем каталоге или совпадает с неотслеживаемым файлом — блоки `would be overwritten by
//   merge` (изменённые файлы первым блоком, неотслеживаемые вторым, один `Aborting`), код 128 (П8.4, П8.10, П8.77, П8.80). Файл,
//   удалённый в рабочем каталоге без `git rm`, git создаёт заново, ошибки нет (П8.80). Правка в файле, которого коммит не касается,
//   не мешает и остаётся (П8.77).
// Отказы области (ничего не меняется, кода возврата нет): конфликт, пустая копия (изменение уже есть в HEAD), ключи, несколько
// ссылок, удаление файла коммитом при изменённом файле в рабочем каталоге. Состояния «cherry-pick идёт» тренажёр не моделирует.
// ============================================================
import type { AppendixCommit, AppendixState, FileTree } from './appendixTypes'
import { exited, refuse, type Outcome } from './appendixOutcome'
import { markMission } from './appendixMissions'
import { mergeTrees } from './branchRepo'
import { compareBytes } from './appendixRefs'
import { commitOf, currentCommitId, headTree, sameTree, subjectOf } from './appendixRepo'
import { reflogShortOutput, resolveRevision } from './appendixRevisions'
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

/** Дерево родителя коммита; у корневого коммита — пустое. */
function parentTree(state: AppendixState, commit: AppendixCommit): FileTree {
  return commit.parents.length === 0 ? {} : commitOf(state, commit.parents[0]).tree
}

export function handleCherryPick(state: AppendixState, args: readonly string[]): Outcome {
  if (args.length === 0) return exited(state, USAGE, 129, ax.cherryPickUsage)
  const options = args.filter((a) => a.startsWith('-'))
  if (options.length > 0 || args.length > 1) return refuse(state, ae.form('cherry-pick', options[0] ?? args.join(' '), ru.appendix.allowed.cherryPick))

  const word = args[0]
  const revision = resolveRevision(state, word)
  if (revision.kind === 'foreign') return refuse(state, ae.revisionForm('cherry-pick', word))
  if (revision.kind === 'reflogShort') return exited(state, reflogShortOutput(revision.entries), 128, ax.reflogShortEntries)
  if (revision.kind === 'missing') return exited(state, `fatal: bad revision '${word}'`, 128, ax.cherryPickBadRevision)

  const head = headTree(state)
  // Подготовленная правка останавливает cherry-pick раньше, чем разбор самой копии (П8.80: даже при пустой копии).
  if (!sameTree(state.index, head)) return exited(state, STAGED_REFUSAL, 128, ax.cherryPickRefusedStaged)

  const picked = commitOf(state, revision.id)
  const merged = mergeTrees(parentTree(state, picked), head, picked.tree)
  if (merged.conflicts.length > 0) return refuse(state, ae.cherryPickConflict(merged.conflicts.map((c) => c.file)))
  if (sameTree(merged.tree, head)) return refuse(state, ae.cherryPickEmpty)

  // Файлы, которые копия меняет: у них результат отличается от HEAD.
  const touched = [...new Set([...Object.keys(head), ...Object.keys(merged.tree)])].filter((f) => head[f] !== merged.tree[f]).sort(compareBytes)
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
