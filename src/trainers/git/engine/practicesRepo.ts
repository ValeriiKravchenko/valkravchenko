// ============================================================
// Раздел 7 git-тренажёра: исходное состояние и чтение модели (без команд).
// Исходное состояние — target.md, часть IX, «Исходное состояние»: ветка master, коммитов нет,
// 14 файлов виджета и `.gitignore` из четырёх строк, всё неотслеживаемое, индекс пуст.
// ============================================================
import type { PracticesState } from './practicesTypes'
import { evaluatePath, GITIGNORE_FILE, parseGitignore, type IgnoreRule, type IgnoreVerdict } from './practicesGitignore'
import { ru } from '../locales/ru'
import { initialPracticesMissionsDone } from './practicesMissions'
import { has } from './util'

/**
 * 14 файлов виджета в порядке `$FILES` из прогонов П7.1–П7.20 (так их печатает
 * `git check-ignore -v --non-matching`, порядок аргументов сохраняется).
 */
export const PRACTICES_FILES: readonly string[] = [
  'app.js',
  'style.css',
  'README.md',
  'debug.log',
  'important.log',
  'logs/error.log',
  'node_modules/react/index.js',
  'packages/ui/node_modules/x.js',
  '.env',
  '.env.example',
  'build/bundle.js',
  'build/output.map',
  'src/build.js',
  'docs/build/index.html',
]

/** `.gitignore` исходного состояния — четыре строки (S7-62, П7.1). */
export const DEFAULT_GITIGNORE = '*.log\nnode_modules/\n.env*\nbuild/\n'

/** Начальное состояние раздела 7. Содержимое 14 файлов — данные сценария (словарь), на поведение git не влияет. */
export function createPracticesSection(): PracticesState {
  const seed: Record<string, string> = ru.practices.seedFiles
  const working: Record<string, string> = {}
  for (const path of PRACTICES_FILES) working[path] = seed[path] ?? ''
  working[GITIGNORE_FILE] = DEFAULT_GITIGNORE
  return { branch: 'master', working, index: {}, globalConfig: [], localConfig: [], history: [], missionsDone: initialPracticesMissionsDone() }
}

/** Правила из текущего содержимого `.gitignore` (нет файла — нет правил). */
export function currentRules(state: PracticesState): IgnoreRule[] {
  return has(state.working, GITIGNORE_FILE) ? parseGitignore(state.working[GITIGNORE_FILE]) : []
}

/** Вердикт правил по файлу без учёта индекса. */
export function ignoreVerdict(state: PracticesState, path: string): IgnoreVerdict {
  return evaluatePath(currentRules(state), path)
}

/** Файл отслеживается (есть в индексе): правила на него не действуют (П7.23). */
export function isTracked(state: PracticesState, path: string): boolean {
  return has(state.index, path)
}

/** Пути рабочего каталога в порядке байтов — для панели файлов. */
export function listWorkingFiles(state: PracticesState): string[] {
  return Object.keys(state.working).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}
