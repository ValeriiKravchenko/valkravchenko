// ============================================================
// Раздел 8 git-тренажёра, шаг A: миссии «Что попробовать» (target.md, часть X, «Миссии»).
//
// 1. Лёгкий тег: успешный `git tag <имя> [<ссылка>]` без `-a` и `-m`, который создал или переставил
//    тег (ставит обработчик `git tag`).
// 2. Аннотированный тег и `git show`: успешный `git show <имя>`, где `<имя>` — аннотированный тег;
//    `git show` лёгкого тега и коммита миссию не засчитывает (ставит обработчик `git show`).
// 3. Спрятать правку: успешный `git stash` (`-m`, `push`, `save`), после которого в стопке появился
//    тайник (ставит обработчик `git stash`). `No local changes to save` — код 0, но тайника нет и
//    миссию он не засчитывает.
// 4. Вернуть спрятанное: успешный `git stash pop` или `git stash apply` (ставит тот же обработчик).
//    Отказ из-за правки в файле и конфликт не засчитываются.
//
// Все засчитываются по событию. Засчитанная миссия остаётся засчитанной (часть I, п. 2): удаление
// тега `git tag -d` миссию 1 не снимает.
// ============================================================
import type { AppendixMissionId, AppendixMissionView, AppendixState } from './appendixTypes'
import { APPENDIX_MISSION_IDS } from './appendixTypes'
import { ru } from '../locales/ru'

/** Засчитать миссию. Уже засчитанная остаётся: состояние возвращается как есть. */
export function markMission(state: AppendixState, id: AppendixMissionId): AppendixState {
  return state.missionsDone[id] ? state : { ...state, missionsDone: { ...state.missionsDone, [id]: true } }
}

/** Миссии в порядке target.md: текст и подсказка из словаря, отметка выполнения. */
export function getAppendixMissions(state: AppendixState): AppendixMissionView[] {
  return APPENDIX_MISSION_IDS.map((id) => ({ id, text: ru.appendix.missions[id].text, hint: ru.appendix.missions[id].hint, done: state.missionsDone[id] }))
}
