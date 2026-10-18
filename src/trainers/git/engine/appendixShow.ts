// ============================================================
// Раздел 8 git-тренажёра, шаг A: `git show` коммита и тега (target.md, часть X, места 1 и 5;
// прогоны П8.2, П8.30). У аннотированного тега перед коммитом идут `tag <имя>`, пустая строка,
// сообщение тега и пустая строка (П8.2); у лёгкого тега и коммита вывод начинается с `commit`.
// Строк `Tagger:`, `Author:` и `Date:` нет («Автор и дата в разделе 8»); речь говорит, что git их
// показал бы. Ключи (`--stat`, `-s`, `--no-patch` и остальные) — отказ области.
// ============================================================
import type { AppendixState } from './appendixTypes'
import { exited, refuse, type Outcome } from './appendixOutcome'
import { commitOf, commitTree, currentCommitId, decorationMap, decorationText, diffTrees, mayContainRename } from './appendixRepo'
import { ambiguousArgumentOutput, reflogShortOutput, resolveRevision } from './appendixRevisions'
import { markMission } from './appendixMissions'
import { has } from './util'
import { ru } from '../locales/ru'

const ae = ru.appendix.errors
const ax = ru.appendix.explain

export function handleShow(state: AppendixState, args: readonly string[]): Outcome {
  const option = args.find((a) => a.startsWith('-'))
  if (option !== undefined) return refuse(state, ae.form('show', option, ru.appendix.allowed.show))
  if (args.length > 1) return refuse(state, ae.form('show', args.join(' '), ru.appendix.allowed.show))

  let id = currentCommitId(state)
  let annotated: { name: string; message: string } | null = null
  if (args.length === 1) {
    const revision = resolveRevision(state, args[0])
    if (revision.kind === 'foreign') return refuse(state, ae.revisionForm('show', args[0]))
    if (revision.kind === 'reflogShort') return exited(state, reflogShortOutput(revision.entries), 128)
    if (revision.kind === 'missing') {
      if (has(state.working, args[0])) return refuse(state, ae.showPathFilter(args[0]))
      return exited(state, ambiguousArgumentOutput(args[0]), 128)
    }
    id = revision.id
    if (revision.annotated !== null) annotated = { name: revision.annotated.name, message: revision.annotated.tag.message }
  }

  const commit = commitOf(state, id)
  const parentTree = commit.parents.length > 0 ? commitTree(state, commit.parents[0]) : {}
  if (mayContainRename(parentTree, commit.tree)) return refuse(state, ae.renameDetection('show'))
  const decoration = decorationText(decorationMap(state), id)
  const head = [`commit ${id}${decoration}`, '', ...commit.message.split('\n').map((line) => `    ${line}`)].join('\n')
  const patch = diffTrees(parentTree, commit.tree)
  const commitPart = patch === '' ? head : `${head}\n\n${patch}`

  if (annotated === null) return exited(state, commitPart, 0, ax.authorDateNotShown)
  const output = [`tag ${annotated.name}`, '', annotated.message, '', commitPart].join('\n')
  return exited(markMission(state, 'annotatedShow'), output, 0, ax.showAnnotated)
}
