// ============================================================
// Раздел 8 git-тренажёра, шаг B: `git branch -d <имя>…` и `-D <имя>…` (target.md, часть XII, «Команды в
// отсоединённом HEAD», опасное место 8; прогоны appendix-g18g-git-runs.txt, П8.62, П8.63, и
// detached-head-git-runs.txt, О6). Вывод git — английские литералы, не переводятся.
//
// Правила, сверенные прогонами:
// - ветка слита, если её коммит достижим из коммита HEAD (в отсоединённом HEAD — из того коммита, на котором HEAD стоит);
//   ветка master, слитая в master~1, при HEAD на master~1 не слита (П8.62), а ветка на самом коммите HEAD слита (О6);
// - ветка, на которой стоит HEAD, не удаляется; отказ «worktree at» называет путь каталога, у тренажёра пути нет
//   (так же сделано в разделе 2, там же объяснено), в отсоединённом HEAD такого отказа нет (О6, П8.62);
// - строки ошибок идут первыми по порядку имён, строки `Deleted branch …` после них (П8.63), код 1, если была хоть одна ошибка;
// - `-D` не проверяет слитость; без имени: `fatal: branch name required`, код 128 (П8.63).
// Повтор имени в одной команде в прогонах не снят: отказ области.
// ============================================================
import type { AppendixState } from './appendixTypes'
import { exited, refuse, type Outcome } from './appendixOutcome'
import { currentCommitId, reachableFrom } from './appendixRepo'
import { shortCommitId } from './sectionsCommon'
import { has } from './util'
import { ru } from '../locales/ru'

const ae = ru.appendix.errors
const ax = ru.appendix.explain

export function deleteBranches(state: AppendixState, names: readonly string[], forced: boolean): Outcome {
  if (names.length === 0) return exited(state, 'fatal: branch name required', 128)
  if (new Set(names).size !== names.length) return refuse(state, ae.branchDeleteDuplicate)

  const headId = currentCommitId(state)
  const merged = reachableFrom(state, [headId])
  const errors: string[] = []
  const deleted: string[] = []
  const notes = new Set<string>()
  for (const name of names) {
    if (!has(state.branches, name)) {
      errors.push(`error: branch '${name}' not found`)
      notes.add(ax.branchNotFound)
    } else if (state.head.kind === 'branch' && state.head.name === name) {
      errors.push(`error: cannot delete branch '${name}' used by worktree at '/site'`)
      notes.add(ru.branching.explain.worktreePathIsPlaceholder)
    } else if (!forced && !merged.has(state.branches[name])) {
      errors.push(
        `error: the branch '${name}' is not fully merged`,
        `hint: If you are sure you want to delete it, run 'git branch -D ${name}'`,
        'hint: Disable this message with "git config set advice.forceDeleteBranch false"',
      )
      notes.add(ax.branchNotMerged(state.head.kind === 'detached'))
    } else {
      deleted.push(name)
    }
  }

  const lines = [...errors, ...deleted.map((name) => `Deleted branch ${name} (was ${shortCommitId(state.branches[name])}).`)]
  if (deleted.length > 0) {
    const underHead = state.head.kind === 'detached' && deleted.some((name) => state.branches[name] === headId)
    notes.add(underHead ? ax.branchDeletedUnderHead : ax.branchDeleted)
  }
  const branches = { ...state.branches }
  for (const name of deleted) delete branches[name]
  return exited({ ...state, branches }, lines.join('\n'), errors.length > 0 ? 1 : 0, [...notes].join(' '))
}
