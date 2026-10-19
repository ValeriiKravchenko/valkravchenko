// ============================================================
// Раздел 8 git-тренажёра, шаг B: `git reset` (target.md, часть X, места 14 и 15, «Миссии»; часть XII,
// «Команды в отсоединённом HEAD», «reflog: записи»). Формы: `git reset [--soft | --mixed | --hard] [<ссылка>]`, ссылка —
// любая, которую разбирает appendixRevisions.ts, в том числе `HEAD@{n}`. Без ссылки это `HEAD`, без ключа — mixed.
// Остальное (`--keep`, `--merge`, `-q`, `-p`, `--`, пути, несколько слов) — отказ области.
//
// - На ветке двигается ветка, а с ней HEAD; в отсоединённом HEAD — только HEAD, ветки на месте (О6, О20, П8.72, П8.73).
// - `--hard` приводит индекс и рабочий каталог к коммиту (правки в отслеживаемых файлах пропадают, неотслеживаемые файлы
//   остаются, а лежащие на пути файла коммита перезаписываются молча, П8.71); `--soft` не трогает ни то ни другое;
//   mixed приводит индекс и печатает `Unstaged changes after reset:` и строки `M`/`D`, если рабочий каталог отличается
//   от нового индекса (П8.70, П8.71).
// - Вывод: `HEAD is now at <id7> <тема>` у `--hard`, у `--soft` пусто, у mixed пусто или отчёт о неподготовленном.
// - Запись журнала HEAD: `reset: moving to <ссылка, как введена>`. На ветке она пишется и при reset на тот же коммит
//   (П8.5, П8.69–П8.71, П8.81); в отсоединённом HEAD при reset на тот же коммит записи нет (П8.72, П8.81).
// - Слово, которого нет среди ссылок и файлов, — `fatal: ambiguous argument …`, код 128 (П8.69); `HEAD@{n}` за концом
//   журнала — `fatal: log for 'HEAD' only has N entries`, код 128 (П8.69).
// - Миссия 6: `--hard HEAD@{n}` на ветке, после которого ветка стоит на коммите, недостижимом до этого ни из одной ветки
//   и ни из одного тега. В отсоединённом HEAD ветка не двигается, и миссию команда не засчитывает.
// Брошенные коммиты не удаляются (бледнеют на графе, `fadedCommitIds`).
// ============================================================
import type { AppendixState, FileTree } from './appendixTypes'
import { exited, refuse, type Outcome } from './appendixOutcome'
import { markMission } from './appendixMissions'
import { compareBytes } from './appendixRefs'
import { commitTree, currentCommitId, fadedCommitIds, graphOf, headTree, reachableFrom, refsOf, subjectOf } from './appendixRepo'
import { ambiguousArgumentOutput, reflogShortOutput, resolveRevision } from './appendixRevisions'
import { advanceHead, orphans } from './detachedHead'
import { shortCommitId } from './sectionsCommon'
import { has } from './util'
import { ru } from '../locales/ru'

const ae = ru.appendix.errors
const ax = ru.appendix.explain

type ResetMode = 'soft' | 'mixed' | 'hard'

const MODE_FLAGS: Readonly<Record<string, ResetMode>> = { '--soft': 'soft', '--mixed': 'mixed', '--hard': 'hard' }
const HEAD_AT = /^HEAD@\{\d+\}$/

/** Неотслеживаемые файлы (нет ни в индексе, ни в HEAD) `reset --hard` не трогает. */
function untrackedFiles(state: AppendixState): FileTree {
  const head = headTree(state)
  const out: FileTree = {}
  for (const path of Object.keys(state.working)) if (!has(state.index, path) && !has(head, path)) out[path] = state.working[path]
  return out
}

/**
 * Отчёт mixed: файлы нового индекса, в которых рабочий каталог отличается (`M`) или которых в нём нет (`D`); в порядке
 * байтов имени. Файл, вышедший из индекса, теперь неотслеживаемый и в отчёт не попадает (П8.70, П8.71).
 */
function unstagedReport(index: FileTree, working: FileTree): string {
  const rows = Object.keys(index)
    .sort(compareBytes)
    .filter((path) => !has(working, path) || working[path] !== index[path])
    .map((path) => `${has(working, path) ? 'M' : 'D'}\t${path}`)
  return rows.length === 0 ? '' : ['Unstaged changes after reset:', ...rows].join('\n')
}

/** Брошенные этим reset коммиты: те, что были достижимы с прежнего места и теперь недостижимы ни из ветки, ни из тега, ни из нового места HEAD. */
function leftBehind(before: AppendixState, after: AppendixState): number {
  const kept = reachableFrom(after, [currentCommitId(after)])
  return orphans(currentCommitId(before), refsOf(after), graphOf(after)).filter((id) => !kept.has(id)).length
}

export function handleReset(state: AppendixState, args: readonly string[]): Outcome {
  let mode: ResetMode | null = null
  const words: string[] = []
  for (const arg of args) {
    if (has(MODE_FLAGS, arg)) {
      if (mode !== null) return refuse(state, ae.form('reset', args.join(' '), ru.appendix.allowed.reset))
      mode = MODE_FLAGS[arg]
    } else if (arg.startsWith('-')) return refuse(state, ae.form('reset', arg, ru.appendix.allowed.reset))
    else words.push(arg)
  }
  // Второе слово git прочитал бы как путь.
  if (words.length > 1) return refuse(state, ae.form('reset', args.join(' '), ru.appendix.allowed.reset))

  const word = words[0] ?? 'HEAD'
  let targetId = currentCommitId(state)
  if (words.length === 1) {
    // Слово, совпадающее с именем файла, git читает как путь или как неоднозначное: обе формы вне раздела.
    if (has(state.working, word) || has(state.index, word) || has(headTree(state), word)) return refuse(state, ae.resetPathForm(word))
    const revision = resolveRevision(state, word)
    if (revision.kind === 'foreign') return refuse(state, ae.revisionForm('reset', word))
    if (revision.kind === 'reflogShort') return exited(state, reflogShortOutput(revision.entries), 128, ax.reflogShortEntries)
    if (revision.kind === 'missing') return exited(state, ambiguousArgumentOutput(word), 128, ax.resetNoCommit)
    targetId = revision.id
  }

  const effective: ResetMode = mode ?? 'mixed'
  const tree = commitTree(state, targetId)
  const untracked = untrackedFiles(state)
  const moved = advanceHead(state.head, state.branches, targetId)
  const sameInDetached = state.head.kind === 'detached' && targetId === currentCommitId(state)
  const hard = effective === 'hard'
  const index: FileTree = hard || effective === 'mixed' ? { ...tree } : state.index
  const working: FileTree = hard ? { ...untracked, ...tree } : state.working
  const next: AppendixState = {
    ...state,
    head: moved.head,
    branches: moved.branches,
    index,
    working,
    reflog: sameInDetached ? state.reflog : [{ id: targetId, message: `reset: moving to ${word}` }, ...state.reflog],
  }

  const short = shortCommitId(targetId)
  const branch = state.head.kind === 'branch' ? state.head.name : null
  const report = effective === 'mixed' ? unstagedReport(index, working) : ''
  const output = hard ? `HEAD is now at ${short} ${subjectOf(state, targetId)}` : report
  const notes: string[] = [hard ? ax.resetHard(branch, short) : effective === 'soft' ? ax.resetSoft(branch, short) : ax.resetMixed(branch, short, report !== '')]
  if (targetId === currentCommitId(state)) notes.push(ax.resetSameCommit)
  if (HEAD_AT.test(word)) notes.push(ax.resetViaReflog(word, short))

  // Миссия 6: ветка вернулась на коммит, на который до этого не указывала ни одна ветка и ни один тег.
  const rescued = hard && branch !== null && HEAD_AT.test(word) && fadedCommitIds(state).has(targetId)
  if (rescued) notes.push(ax.resetRescued(branch, short))
  const left = leftBehind(state, next)
  if (left > 0) notes.push(ax.resetLeftBehind(left))
  return exited(rescued ? markMission(next, 'rescueCommit') : next, output, 0, notes.join(' '))
}
