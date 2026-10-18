// ============================================================
// Раздел 8 git-тренажёра, шаг B: `git reflog` — журнал HEAD (target.md, часть X, места 14 и 15; часть XII,
// «reflog: записи»; прогоны section8-git-runs.txt, П8.1, П8.5, П8.15, П8.19, и detached-head-git-runs.txt, О1–О31).
// Формат строки: `<id7>[ (<подписи>)] HEAD@{n}: <запись>`. Подписи — те же, что `git log` печатает у этого
// коммита в момент вызова, и они стоят на каждой строке с этим коммитом (П8.5). Номер `n` считает перемещения
// HEAD, а не коммиты назад (место 15). Записи пишут команды движка в `state.reflog` (новая первой).
//
// Формы `git reflog show <ветка>`, `git reflog -<n>` и `git log -g` — отказ области: в «Что входит» части X
// `-<n>` числится формой, а в «Порядке работ» желательным; тренажёр их не разбирает.
// ============================================================
import type { AppendixState } from './appendixTypes'
import { exited, refuse, type Outcome } from './appendixOutcome'
import { decorationMap, decorationText } from './appendixRepo'
import { shortCommitId } from './sectionsCommon'
import { ru } from '../locales/ru'

export function handleReflog(state: AppendixState, args: readonly string[]): Outcome {
  if (args.length > 0) return refuse(state, ru.appendix.errors.form('reflog', args.join(' '), ru.appendix.allowed.reflog))
  const decorations = decorationMap(state)
  const lines = state.reflog.map((entry, n) => `${shortCommitId(entry.id)}${decorationText(decorations, entry.id)} HEAD@{${n}}: ${entry.message}`)
  return exited(state, lines.join('\n'), 0, ru.appendix.explain.reflogShown)
}
