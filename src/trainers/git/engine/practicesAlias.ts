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
import { isGlobalGitOption } from './branchScope'
import { ru } from '../locales/ru'

const pa = ru.practices.alias

/** План вызова алиаса: выполнить раскрытую команду, ответить сразу (ошибка git) или отказать. */
export type AliasPlan =
  | { kind: 'run'; /** Слова раскрытой команды: подкоманда и аргументы (после `git`). */ words: string[]; value: string }
  | { kind: 'answer'; outcome: Outcome }

/**
 * Раскрывает алиас `name` с аргументами `args`. `null` — такого алиаса нет (диспетчер отвечает
 * «is not a git command»). Имя ищется без учёта регистра (П7.68, П7.76).
 *
 * Git раскрывает алиасы по цепочке: у первого слова значения сначала проверяются настоящие команды, потом
 * алиасы. Имена в истории сравниваются точно (с регистром), поиск алиаса — без регистра (П7.76):
 *  - первое слово значения совпало с раскрываемым именем — `fatal: recursive alias: <слово>` (П7.74, П7.76);
 *  - первое слово уже встречалось в цепочке — `fatal: alias loop detected` с метками `<==` и `==>` (П7.74, П7.75);
 *  - первое слово не команда и не алиас — `expansion of alias '<имя>' failed; '<слово>' is not a git command` (П7.74).
 * Цепочки, которые кончаются настоящей командой, `!`-алиасы и пустые значения в середине цепочки не сверены —
 * отказ области.
 */
export function planAlias(state: PracticesState, name: string, args: readonly string[]): AliasPlan | null {
  if (lookupAlias(state, name).kind === 'none') return null
  const history: string[] = []
  let current = name
  for (;;) {
    const found = lookupAlias(state, current)
    if (found.kind === 'ambiguous') return { kind: 'answer', outcome: refuse(state, pa.inBothConfigs(current)) }
    if (found.kind === 'none') return null
    const value = found.value
    const chained = history.length > 0
    if (value.startsWith('!')) {
      // П7.25: git отдаёт значение оболочке; оболочку тренажёр не моделирует (место 18).
      if (chained) return { kind: 'answer', outcome: refuse(state, pa.startsWithAlias(name, history[1] ?? current)) }
      return { kind: 'answer', outcome: refuse(state, pa.shellAlias(name, [value.slice(1), ...args].join(' ').trim())) }
    }
    const words = value.trim() === '' ? [] : value.trim().split(/\s+/)
    if (words.length === 0) {
      // П7.74: пустое значение и значение из пробелов — одна и та же ошибка с аргументами и без, код 1.
      if (chained) return { kind: 'answer', outcome: refuse(state, pa.startsWithAlias(name, history[1] ?? current)) }
      return { kind: 'answer', outcome: exited(state, `expansion of alias '${name}' failed; '' is not a git command`, 1, pa.emptyAliasCall(name)) }
    }
    const first = words[0]
    if (first === current) return { kind: 'answer', outcome: exited(state, `fatal: recursive alias: ${first}`, 128, pa.recursive(first)) }
    history.push(current)
    const at = history.indexOf(first)
    if (at >= 0) {
      const lines = history.map((h, k) => `  ${h}${k === at ? ' <==' : k === history.length - 1 ? ' ==>' : ''}`)
      const output = [`fatal: alias loop detected: expansion of '${name}' does not terminate:`, ...lines].join('\n')
      return { kind: 'answer', outcome: exited(state, output, 128, pa.loop(name)) }
    }
    if (isRealGitCommand(first) || isGlobalGitOption(first)) {
      if (chained) return { kind: 'answer', outcome: refuse(state, pa.startsWithAlias(name, history[1])) }
      return { kind: 'run', words: [...words, ...args], value }
    }
    if (lookupAlias(state, first).kind === 'none') {
      if (chained || first.startsWith('-')) {
        // Цепочка с несуществующей командой в конце и слово-опция в начале значения прогонами не сверены.
        return { kind: 'answer', outcome: refuse(state, chained ? pa.startsWithAlias(name, history[1]) : pa.unknownTarget(name, first)) }
      }
      return { kind: 'answer', outcome: exited(state, `expansion of alias '${name}' failed; '${first}' is not a git command`, 1, pa.unknownCommand(name, first)) }
    }
    current = first
  }
}

/**
 * `git help <имя>` для алиаса: `'<имя>' is aliased to '<значение>'`, код 0 (П7.25, П7.74: и для пустого значения,
 * `!`-алиаса и самоссылки; П7.67: имя как набрано, поиск без регистра). Алиас с именем настоящей команды —
 * git открывает страницу справки (П7.78): отказ области.
 */
export function handleHelp(state: PracticesState, args: readonly string[]): Outcome {
  if (args.length !== 1 || args[0].startsWith('-')) return refuse(state, pa.helpForm(args.join(' ')))
  const name = args[0]
  const found = lookupAlias(state, name)
  if (found.kind !== 'found' || isRealGitCommand(name)) return refuse(state, pa.helpForm(args.join(' ')))
  return exited(state, `'${name}' is aliased to '${found.value}'`, 0, pa.helpAliased(name, found.value))
}
