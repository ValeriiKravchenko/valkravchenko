// ============================================================
// Раздел 8 git-тренажёра, шаги A и B: миссии «Что попробовать» (target.md, часть X, «Миссии»).
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
// 5. Cherry-pick: успешный `git cherry-pick`, создавший коммит — на ветке и в отсоединённом HEAD (ставит обработчик `git cherry-pick`).
//    Отказ git, отказ области и пустая копия не засчитываются.
// 6. Спасти коммит: успешный `git reset --hard HEAD@{n}` на ветке, после которого ветка стоит на коммите, недостижимом перед этим
//    ни из одной ветки и ни из одного тега (ставит обработчик `git reset`). В отсоединённом HEAD ветка не двигается, и миссия
//    не засчитывается; `--soft`, смешанный и ссылки вида `HEAD~n` или id тоже нет.
// 7. Rebase: успешный `git rebase` на ветке, перенёсший коммиты или перемотавший ветку (ставит обработчик `git rebase`). `Current branch … is up to date.`,
//    отказ git, отказ области и `rebase` в отсоединённом HEAD не засчитываются.
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
