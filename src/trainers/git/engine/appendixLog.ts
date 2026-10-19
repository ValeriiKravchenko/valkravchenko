// ============================================================
// Раздел 8 git-тренажёра, шаг A: `git log` с подписями (target.md, часть X, место 5; прогоны П8.1,
// П8.2, П8.30). Формы: `git log`, `--oneline`, `-<N>`, `--all`, `git log <ссылка>`; ключи в любом
// порядке. Подписи `(HEAD -> master, tag: v1, feature)` печатаются на каждой строке, как на
// терминале (П8.13). Строк `Author:` и `Date:` нет: так решено для раздела 8 («Автор и дата в
// разделе 8»); речь говорит, что git их показал бы.
//
// Журнал: `git log -g --oneline [-<n>]` (ключи в любом порядке) печатает те же строки, что `git reflog [-<n>]`
// (П8.5, П8.79); без `--oneline` git печатает длинную форму со строками `Reflog:`, `Author:`, `Date:` — это, `-g` со ссылкой
// и `--all` — отказ области.
// ============================================================
import type { AppendixState } from './appendixTypes'
import { exited, refuse, type Outcome } from './appendixOutcome'
import { allStarts, commitOf, currentCommitId, decorationMap, decorationText, logOrder } from './appendixRepo'
import { ambiguousArgumentOutput, reflogShortOutput, resolveRevision } from './appendixRevisions'
import { REFLOG_LIMIT, reflogOutcome } from './appendixReflog'
import { shortCommitId } from './sectionsCommon'
import { has } from './util'
import { ru } from '../locales/ru'

const ae = ru.appendix.errors

/** `git log -g`: журнал HEAD в одну строку; другие формы — отказ области. */
function logReflog(state: AppendixState, args: readonly string[]): Outcome {
  let oneline = false
  let limit: number | null = null
  for (const arg of args) {
    if (arg === '-g') continue
    if (arg === '--oneline') oneline = true
    else if (REFLOG_LIMIT.test(arg)) limit = Number(arg.slice(1))
    else return refuse(state, ae.form('log', args.join(' '), ru.appendix.allowed.log))
  }
  if (!oneline) return refuse(state, ae.form('log', args.join(' '), ru.appendix.allowed.log))
  return reflogOutcome(state, limit)
}

export function handleLog(state: AppendixState, args: readonly string[]): Outcome {
  if (args.includes('-g')) return logReflog(state, args)
  let oneline = false
  let all = false
  let limit: number | null = null
  const words: string[] = []
  for (const arg of args) {
    if (arg === '--oneline') oneline = true
    else if (arg === '--all') all = true
    else if (/^-[1-9]\d*$/.test(arg)) limit = Number(arg.slice(1))
    else if (arg.startsWith('-')) return refuse(state, ae.form('log', arg, ru.appendix.allowed.log))
    else words.push(arg)
  }
  if (words.length > 1 || (all && words.length > 0)) return refuse(state, ae.form('log', args.join(' '), ru.appendix.allowed.log))

  let starts: string[]
  if (all) starts = allStarts(state)
  else if (words.length === 0) starts = [currentCommitId(state)]
  else {
    const revision = resolveRevision(state, words[0])
    if (revision.kind === 'foreign') return refuse(state, ae.revisionForm('log', words[0]))
    if (revision.kind === 'reflogShort') return exited(state, reflogShortOutput(revision.entries), 128)
    if (revision.kind === 'missing') {
      // Имя файла рабочего каталога git принял бы за путь и отфильтровал бы историю по нему.
      if (has(state.working, words[0])) return refuse(state, ae.logPathFilter(words[0]))
      return exited(state, ambiguousArgumentOutput(words[0]), 128)
    }
    starts = [revision.id]
  }

  const ids = logOrder(state, starts).slice(0, limit ?? undefined)
  const decorations = decorationMap(state)
  const entries = ids.map((id) => {
    const decoration = decorationText(decorations, id)
    const commit = commitOf(state, id)
    if (oneline) return `${shortCommitId(id)}${decoration} ${commit.message.split('\n')[0]}`
    const body = commit.message.split('\n').map((line) => `    ${line}`)
    return [`commit ${id}${decoration}`, '', ...body].join('\n')
  })
  // В отсоединённом HEAD история идёт от HEAD: коммиты веток в стороне не видны (target.md, часть XII, опасное место 12).
  const notes = [...(oneline ? [] : [ru.appendix.explain.authorDateNotShown]), ...(state.head.kind === 'detached' && !all && words.length === 0 ? [ru.appendix.explain.logDetached] : [])]
  return exited(state, entries.join(oneline ? '\n' : '\n\n'), 0, notes.length === 0 ? null : notes.join(' '))
}
