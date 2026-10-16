// ============================================================
// Раздел 7 git-тренажёра: `git log --oneline` и `git log --oneline --graph` (target.md, часть IX,
// места 12 и «Что входит»; прогоны П7.26, П7.24, П7.25, П8.13).
//
// В модели раздела 7 коммитов нет и создать их нельзя (`git commit -m` с непустым сообщением —
// отказ области, желательный сценарий отложен решением владельца В7), поэтому `git log` всегда
// отвечает, что коммитов нет (П7.26). Форматирование линейной истории вынесено в
// `formatLogOneline` и проверено на строках протокола; обработчик им пока не пользуется, потому что
// списка коммитов в состоянии нет.
// ============================================================
import type { PracticesState } from './practicesTypes'
import { exited, refuse, type Outcome } from './practicesOutcome'
import { ru } from '../locales/ru'

const pl = ru.practices.log

/** Коммит для вывода: id в 7 знаках (как показывает git) и заголовок. */
export interface LogLine {
  id: string
  subject: string
}

/**
 * Линейная история от верхушки вниз. `decorate` — подпись `(HEAD -> <ветка>)` у верхушки, как на
 * терминале (П8.13: при `log.decorate=short` и в терминале; вне терминала `auto` подписей не
 * печатает, П7.24, П7.25). `graph` — звёздочка и пробел перед строкой (П7.25: `* 135f928 …`,
 * П8.13: `* 07a2e08 (HEAD -> master) …`). Другие подписи (теги, ветки) в разделе 7 не бывают.
 */
export function formatLogOneline(lines: readonly LogLine[], options: { branch: string; graph: boolean; decorate: boolean }): string {
  return lines
    .map((line, i) => {
      const head = options.decorate && i === 0 ? `(HEAD -> ${options.branch}) ` : ''
      return `${options.graph ? '* ' : ''}${line.id} ${head}${line.subject}`
    })
    .join('\n')
}

/** Выполняет `git log …`; `args` — слова после `log`. Сверены формы без ключей, `--oneline`, `--oneline --graph` (в любом порядке ключей). */
export function handleLog(state: PracticesState, args: readonly string[]): Outcome {
  const sorted = [...args].sort()
  const known = sorted.length === 0 || (sorted.length === 1 && sorted[0] === '--oneline') || (sorted.length === 2 && sorted[0] === '--graph' && sorted[1] === '--oneline')
  if (!known) return refuse(state, pl.form(args.join(' ')))
  // П7.26: `git log`, `git log --oneline`, `git log --oneline --graph` без коммитов — fatal, код 128.
  return exited(state, `fatal: your current branch '${state.branch}' does not have any commits yet`, 128, pl.noCommits)
}
