// ============================================================
// Раздел 7 git-тренажёра: `git commit -m` и разбор сообщения (target.md, часть IX, место 11;
// прогон П7.24).
//
// Что делает git с сообщением из `-m` (П7.24):
//   - строки первого абзаца склеиваются через пробел в заголовок, тело пустое;
//   - каждое следующее `-m` — отдельный абзац через пустую строку;
//   - ведущие пустые строки отбрасываются, хвостовые пробелы тоже;
//   - `#` — обычный символ, не комментарий;
//   - `-m ""` и `-m "   "` → `Aborting commit due to empty commit message.`, код 1.
// Заголовок хранится целиком (80 букв — 80 букв).
//
// Коммиты в модели раздела 7 не создаются (решение владельца В7): в обработчике воспроизведён
// только отказ git на пустое сообщение, остальное — отказ области. Совет тренажёра о стиле
// сообщения (длина, повелительное наклонение) здесь не вычисляется: он лежит в экране g18c.
// ============================================================
import type { PracticesState } from './practicesTypes'
import { exited, refuse, type Outcome } from './practicesOutcome'
import { ru } from '../locales/ru'

const pm = ru.practices.commit

/** Что git сохранил бы по набору `-m`. `empty` — сообщение пустое: коммит отменяется. */
export interface ParsedCommitMessage {
  empty: boolean
  subject: string
  body: string
}

/** Разбор по правилам П7.24. Каждое значение `-m` — отдельный абзац; сообщение из одних пробелов и переводов строк пустое. */
export function parseCommitMessage(messages: readonly string[]): ParsedCommitMessage {
  const paragraphs = messages.map((m) => m.replace(/[ \t]+$/gm, '').replace(/^\n+/, '').replace(/\n+$/, ''))
  const text = paragraphs.filter((p) => p !== '').join('\n\n')
  if (text.trim() === '') return { empty: true, subject: '', body: '' }
  const [first, ...others] = text.split('\n\n')
  return { empty: false, subject: first.split('\n').join(' '), body: others.join('\n\n') }
}

/** Выполняет `git commit …`; `args` — слова после `commit`. Сверена одна форма: один `-m <сообщение>`. */
export function handleCommit(state: PracticesState, args: readonly string[]): Outcome {
  if (args.length !== 2 || args[0] !== '-m') return refuse(state, pm.form(args.join(' ')))
  const parsed = parseCommitMessage([args[1]])
  if (!parsed.empty) return refuse(state, pm.noCommitsInSection)
  // С пустым индексом git сначала сообщил бы, что коммитить нечего: этого порядка прогоны не показывают.
  if (Object.keys(state.index).length === 0) return refuse(state, pm.emptyMessageNoIndex)
  // П7.24: `git commit -m ""` и `-m "   "` → `Aborting commit due to empty commit message.`, код 1.
  return exited(state, 'Aborting commit due to empty commit message.', 1, pm.emptyMessage)
}
