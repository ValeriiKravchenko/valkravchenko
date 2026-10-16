// ============================================================
// Раздел 7 git-тренажёра: миссии «Что попробовать» (target.md, часть IX, «Миссии»).
//
// Миссии 1–3 засчитываются по СОСТОЯНИЮ `.gitignore`: вердикт правил для названных файлов (как в
// исходной версии тренажёра, S7-20…S7-22). Прогон П7.19 подтверждает все три условия на одном
// наборе правил. Запускать команду git для зачёта не обязательно. Отслеживаемость (индекс) не
// учитывается: миссии говорят «игнорируется / не игнорируется».
//
// Миссия 4 засчитывается по СОБЫТИЮ: успешный (код 0) вызов алиаса, который git раскрыл в
// команду git, а тренажёр её выполнил. Флаг ставит диспетчер (practicesCommands.ts); здесь он
// только читается. Не засчитывают: алиас с именем настоящей команды (git его не применил),
// `!`-алиас, ответ по правилу области.
//
// Засчитанная миссия остаётся засчитанной (часть I, п. 2): `updatePracticesMissions` только
// добавляет `true`, никогда не сбрасывает.
// ============================================================
import type { PracticesMissionId, PracticesMissionView, PracticesState } from './practicesTypes'
import { PRACTICES_MISSION_IDS } from './practicesTypes'
import { evaluatePath, GITIGNORE_FILE, parseGitignore } from './practicesGitignore'
import { ru } from '../locales/ru'
import { has } from './util'

/** Файлы `.log` сценария: миссия 2 требует игнорировать все, кроме `important.log`. */
const OTHER_LOG_FILES = ['debug.log', 'logs/error.log'] as const

/** Вердикт для файла по текущему содержимому `.gitignore` (нет файла — нет правил). */
function ignoredBy(state: PracticesState, path: string): boolean {
  const rules = has(state.working, GITIGNORE_FILE) ? parseGitignore(state.working[GITIGNORE_FILE]) : []
  return evaluatePath(rules, path).ignored
}

const CHECKS: Record<PracticesMissionId, (state: PracticesState) => boolean> = {
  /** Миссия 1: `.env` игнорируется, `.env.example` — нет. */
  envExample: (state) => ignoredBy(state, '.env') && !ignoredBy(state, '.env.example'),
  /** Миссия 2: все `.log` игнорируются, `important.log` — нет. */
  importantLog: (state) => OTHER_LOG_FILES.every((p) => ignoredBy(state, p)) && !ignoredBy(state, 'important.log'),
  /** Миссия 3: содержимое `build/` игнорируется, `build/output.map` — нет. */
  buildContents: (state) => ignoredBy(state, 'build/bundle.js') && !ignoredBy(state, 'build/output.map'),
  /** Миссия 4: событие, его пишет диспетчер; пересчётом по состоянию не вычисляется. */
  aliasRun: (state) => state.missionsDone.aliasRun,
}

/** Все миссии не выполнены. */
export function initialPracticesMissionsDone(): Record<PracticesMissionId, boolean> {
  return { envExample: false, importantLog: false, buildContents: false, aliasRun: false }
}

/** Пересчёт миссий 1–3 по состоянию; уже засчитанные остаются. Состояние не меняется, если нового зачёта нет. */
export function updatePracticesMissions(state: PracticesState): PracticesState {
  const next = { ...state.missionsDone }
  let changed = false
  for (const id of PRACTICES_MISSION_IDS) {
    if (!next[id] && CHECKS[id](state)) {
      next[id] = true
      changed = true
    }
  }
  return changed ? { ...state, missionsDone: next } : state
}

/** Миссии для показа в порядке target.md. */
export function getPracticesMissions(state: PracticesState): PracticesMissionView[] {
  return PRACTICES_MISSION_IDS.map((id) => ({ id, text: ru.practices.missions[id].text, hint: ru.practices.missions[id].hint, done: state.missionsDone[id] }))
}

/** Засчитать миссию 4 (событие «алиас выполнен»). Повторный вызов состояние не меняет. */
export function markAliasRun(state: PracticesState): PracticesState {
  return state.missionsDone.aliasRun ? state : { ...state, missionsDone: { ...state.missionsDone, aliasRun: true } }
}
