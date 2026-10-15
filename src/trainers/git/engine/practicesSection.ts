// ============================================================
// Раздел 7 git-тренажёра («Эффективная работа»): публичная точка входа движка, поток g18a
// (`.gitignore`, `status`, `check-ignore`, `add`). Аналог branchSection.ts. Внутренние модули
// (practicesCommands.ts, practicesGitignore.ts, practicesRepo.ts, sectionsCommon.ts) снаружи
// напрямую не импортируются. Поток g18b дополнит этот файл конфигами, алиасами и миссиями.
// ============================================================
import type { CommandResult, ConfigEntry, FileTree, HistoryEntry, PracticesState } from './practicesTypes'
import { executePracticesCommand } from './practicesCommands'
import { writeGitignore as writeGitignoreRaw } from './practicesFileOps'
import {
  createPracticesSection as createPracticesSectionRaw,
  currentRules,
  ignoreVerdict as ignoreVerdictRaw,
  isTracked as isTrackedRaw,
  listWorkingFiles,
} from './practicesRepo'
import { GITIGNORE_FILE, type IgnoreRule, type IgnoreVerdict } from './practicesGitignore'

export type { CommandResult, ConfigEntry, FileTree, HistoryEntry, PracticesState }
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
  return executePracticesCommand(state, rawInput)
}

/** Запись `.gitignore` из поля-редактора: правило действует сразу. Тот же текст — состояние не меняется. */
export function writeGitignore(state: PracticesState, content: string): PracticesState {
  return writeGitignoreRaw(state, content)
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
