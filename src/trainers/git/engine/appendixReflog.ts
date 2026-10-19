// ============================================================
// Раздел 8 git-тренажёра, шаг B: `git reflog` — журнал HEAD (target.md, часть X, места 14 и 15; часть XII,
// «reflog: записи»; прогоны section8-git-runs.txt, П8.1, П8.5, П8.15, П8.19, detached-head-git-runs.txt, О1–О31,
// и appendix-g18g2-git-runs.txt, П8.79). Формат строки: `<id7>[ (<подписи>)] HEAD@{n}: <запись>`. Подписи — те же,
// что `git log` печатает у этого коммита в момент вызова, и они стоят на каждой строке с этим коммитом (П8.5).
// Номер `n` считает перемещения HEAD, а не коммиты назад (место 15). Записи пишут команды движка в `state.reflog`
// (новая первой).
//
// Формы: `git reflog` и `git reflog -<n>` (n верхних записей; `-0` печатает пустой вывод, `-99` при шести записях
// печатает все шесть, ведущий ноль не мешает, при нескольких `-<n>` действует последний, П8.79). Те же строки печатает
// `git log -g --oneline [-<n>]` (appendixLog.ts). `git reflog show <ветка>`, ключи и ссылки — отказ области: журнал
// ветки в «Порядке работ» желательный, и тренажёр его не ведёт.
// ============================================================
import type { AppendixState } from './appendixTypes'
import { exited, refuse, type Outcome } from './appendixOutcome'
import { decorationMap, decorationText } from './appendixRepo'
import { shortCommitId } from './sectionsCommon'
import { ru } from '../locales/ru'

/** Ключ `-<n>`: число записей, которые нужно оставить (в том числе `-0` и `-01`). */
export const REFLOG_LIMIT = /^-\d+$/

/** Строки журнала HEAD (новая первой); `limit` — сколько верхних записей оставить, `null` — все. */
function reflogLines(state: AppendixState, limit: number | null): string[] {
  const decorations = decorationMap(state)
  const lines = state.reflog.map((entry, n) => `${shortCommitId(entry.id)}${decorationText(decorations, entry.id)} HEAD@{${n}}: ${entry.message}`)
  return limit === null ? lines : lines.slice(0, limit)
}

/** Вывод журнала с пояснением: речь про журнал, а при `-<n>` ещё и про сам ключ. */
export function reflogOutcome(state: AppendixState, limit: number | null): Outcome {
  const note = limit === null ? ru.appendix.explain.reflogShown : `${ru.appendix.explain.reflogShown} ${ru.appendix.explain.reflogLimited(limit)}`
  return exited(state, reflogLines(state, limit).join('\n'), 0, note)
}

export function handleReflog(state: AppendixState, args: readonly string[]): Outcome {
  let limit: number | null = null
  for (const arg of args) {
    if (!REFLOG_LIMIT.test(arg)) return refuse(state, ru.appendix.errors.form('reflog', args.join(' '), ru.appendix.allowed.reflog))
    limit = Number(arg.slice(1))
  }
  return reflogOutcome(state, limit)
}
