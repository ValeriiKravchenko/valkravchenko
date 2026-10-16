// ============================================================
// Раздел 7 git-тренажёра: вызов алиаса и `git help <алиас>` (target.md, часть IX, места 12, 14,
// 17–20; прогон П7.25).
//
// Что делает git: подставляет значение алиаса и дописывает аргументы, затем выполняет получившуюся
// команду; о раскрытии он ничего не печатает (П7.25). У настоящей команды приоритет над
// одноимённым алиасом (П7.25: `alias.status log`, `git status --short` печатает статус) — это
// решает диспетчер до обращения сюда.
//
// Строки `expansion of alias …`, `fatal: recursive alias: …`, `'co' is aliased to '…'` — буквальный
// вывод git 2.53.0 из протокола, не переводятся. Что git сделал бы в формах, которых в протоколе нет
// (значение с другим алиасом первым словом, несуществующая команда в значении, `!`-алиас), раздел не
// утверждает: честный отказ области с речью тренажёра, код возврата не задаётся.
// ============================================================
import type { PracticesState } from './practicesTypes'
import { exited, refuse, type Outcome } from './practicesOutcome'
import { lookupAlias } from './practicesConfig'
import { isRealGitCommand } from './practicesScope'
import { ru } from '../locales/ru'

const pa = ru.practices.alias

/** План вызова алиаса: выполнить раскрытую команду, ответить сразу (ошибка git) или отказать. */
export type AliasPlan =
  | { kind: 'run'; /** Слова раскрытой команды: подкоманда и аргументы (после `git`). */ words: string[]; value: string }
  | { kind: 'answer'; outcome: Outcome }

/**
 * Раскрывает алиас `name` с аргументами `args`. `null` — такого алиаса нет (диспетчер отвечает
 * «is not a git command»).
 */
export function planAlias(state: PracticesState, name: string, args: readonly string[]): AliasPlan | null {
  const found = lookupAlias(state, name)
  if (found.kind === 'none') return null
  if (found.kind === 'ambiguous') return { kind: 'answer', outcome: refuse(state, pa.inBothConfigs(name)) }

  const value = found.value
  if (value.startsWith('!')) {
    // П7.25: git отдаёт значение оболочке; оболочку тренажёр не моделирует (место 18).
    return { kind: 'answer', outcome: refuse(state, pa.shellAlias(name, [value.slice(1), ...args].join(' ').trim())) }
  }

  const words = value.trim() === '' ? [] : value.trim().split(/\s+/)
  if (words.length === 0) {
    // П7.25: пустое значение и значение из пробелов — одна и та же ошибка при вызове, код 1.
    if (args.length > 0) return { kind: 'answer', outcome: refuse(state, pa.emptyWithArgs(name)) }
    return { kind: 'answer', outcome: exited(state, `expansion of alias '${name}' failed; '' is not a git command`, 1, pa.emptyAliasCall(name)) }
  }
  if (words[0] === name) {
    // П7.25: `alias.loop loop`, `git loop` → fatal, код 128. Другие виды самоссылки прогонами не сверены.
    if (words.length === 1 && args.length === 0) return { kind: 'answer', outcome: exited(state, `fatal: recursive alias: ${name}`, 128, pa.recursive(name)) }
    return { kind: 'answer', outcome: refuse(state, pa.selfReference(name)) }
  }
  if (!isRealGitCommand(words[0]) && lookupAlias(state, words[0]).kind !== 'none') {
    return { kind: 'answer', outcome: refuse(state, pa.startsWithAlias(name, words[0])) }
  }
  return { kind: 'run', words: [...words, ...args], value }
}

/** `git help <имя>`: сверена одна форма — имя алиаса (П7.25, `git help co` → `'co' is aliased to 'checkout'`, код 0). */
export function handleHelp(state: PracticesState, args: readonly string[]): Outcome {
  if (args.length !== 1 || args[0].startsWith('-')) return refuse(state, pa.helpForm(args.join(' ')))
  const name = args[0]
  const found = lookupAlias(state, name)
  // Настоящая команда с одноимённым алиасом, `!`-алиас и пустое значение прогонами не сверены.
  if (found.kind !== 'found' || isRealGitCommand(name) || found.value.startsWith('!') || found.value.trim() === '') {
    return refuse(state, pa.helpForm(args.join(' ')))
  }
  return exited(state, `'${name}' is aliased to '${found.value}'`, 0, pa.helpAliased(name, found.value))
}
