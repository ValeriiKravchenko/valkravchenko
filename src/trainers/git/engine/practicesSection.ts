// ============================================================
// Раздел 7 git-тренажёра («Эффективная работа»): публичная точка входа движка. Аналог
// branchSection.ts. Поток g18a: `.gitignore`, `status`, `check-ignore`, `add`. Поток g18b2:
// конфиги и алиасы (`git config`, вызов алиаса, `git help <алиас>`), `git log`, `git commit -m`,
// миссии 1–4. Внутренние модули (practices*.ts, sectionsCommon.ts) снаружи напрямую не
// импортируются: экран берёт всё отсюда.
// ============================================================
import type { CommandResult, ConfigEntry, FileTree, HistoryEntry, PracticesMissionId, PracticesMissionView, PracticesState } from './practicesTypes'
import { executePracticesCommand } from './practicesCommands'
import { configEntries, formatConfigFile, type ConfigScope } from './practicesConfig'
import { getPracticesMissions as getPracticesMissionsRaw, updatePracticesMissions } from './practicesMissions'
import { writeGitignore as writeGitignoreRaw } from './practicesFileOps'
import {
  createPracticesSection as createPracticesSectionRaw,
  currentRules,
  ignoreVerdict as ignoreVerdictRaw,
  isTracked as isTrackedRaw,
  listWorkingFiles,
} from './practicesRepo'
import { GITIGNORE_FILE, type IgnoreRule, type IgnoreVerdict } from './practicesGitignore'

export type { CommandResult, ConfigEntry, FileTree, HistoryEntry, PracticesMissionId, PracticesMissionView, PracticesState }
export type { ConfigScope } from './practicesConfig'
export type { LogLine } from './practicesLog'
export type { ParsedCommitMessage } from './practicesCommit'
export { PRACTICES_MISSION_IDS } from './practicesTypes'
export { formatLogOneline } from './practicesLog'
export { parseCommitMessage } from './practicesCommit'
export type { IgnoreRule, IgnoreVerdict }
export { DEFAULT_GITIGNORE, PRACTICES_FILES } from './practicesRepo'

/** Начальное состояние: master, коммитов нет, 14 файлов и `.gitignore`, всё неотслеживаемое, индекс и оба конфига пусты. */
export function createPracticesSection(): PracticesState {
  return createPracticesSectionRaw()
}

/** Кнопка «↺ Начать раздел заново»: исходное состояние. */
export function resetPracticesSection(): PracticesState {
  return createPracticesSectionRaw()
}

/**
 * Выполняет одну строку терминала. Пустая строка не меняет состояние и возвращает `result === null`.
 * Ничего не бросает: отказ git и отказ области — обычный результат.
 */
export function runPracticesCommand(state: PracticesState, rawInput: string): { state: PracticesState; result: CommandResult | null } {
  const run = executePracticesCommand(state, rawInput)
  return run.result === null ? run : { state: updatePracticesMissions(run.state), result: run.result }
}

/** Запись `.gitignore` из поля-редактора: правило действует сразу. Тот же текст — состояние не меняется. */
export function writeGitignore(state: PracticesState, content: string): PracticesState {
  return updatePracticesMissions(writeGitignoreRaw(state, content))
}

/** Текущее содержимое `.gitignore` — для поля-редактора. */
export function getGitignoreText(state: PracticesState): string {
  return state.working[GITIGNORE_FILE] ?? ''
}

/** Пути файлов рабочего каталога в порядке байтов — для панели файлов (без отметок «игнорируется»). */
export function getWorkingFiles(state: PracticesState): string[] {
  return listWorkingFiles(state)
}

/** Правила `.gitignore` в порядке файла (для миссий и речи тренажёра). */
export function getIgnoreRules(state: PracticesState): IgnoreRule[] {
  return currentRules(state)
}

/**
 * Вердикт правил по файлу — для зачёта миссий 1–3 «по состоянию .gitignore» (target.md, часть
 * IX, «Миссии»). Индекс не учитывается: об отслеживаемом файле см. `isTracked`.
 */
export function getIgnoreVerdict(state: PracticesState, path: string): IgnoreVerdict {
  return ignoreVerdictRaw(state, path)
}

/** Файл в индексе (после `git add -f`) — правила на него не действуют. */
export function isTracked(state: PracticesState, path: string): boolean {
  return isTrackedRaw(state, path)
}

/** Миссии 1–4 в порядке target.md; засчитанная остаётся засчитанной. */
export function getPracticesMissions(state: PracticesState): PracticesMissionView[] {
  return getPracticesMissionsRaw(state)
}

/** Записи конфига «ключ → значение» в порядке первой записи: `global` — `~/.gitconfig`, `local` — `.git/config`. */
export function getConfigEntries(state: PracticesState, scope: ConfigScope): ConfigEntry[] {
  return configEntries(state, scope)
}

/**
 * Текст файла конфига для панели, как его печатает `cat` (П7.25). Локальный начинается с
 * секции `[core]`, глобальный пуст, пока нет записей (пустая строка).
 */
export function getConfigFileText(state: PracticesState, scope: ConfigScope): string {
  return formatConfigFile(configEntries(state, scope), scope === 'local')
}
