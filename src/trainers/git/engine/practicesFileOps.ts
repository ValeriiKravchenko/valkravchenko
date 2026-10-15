// ============================================================
// Раздел 7 git-тренажёра: запись содержимого `.gitignore` из поля-редактора (target.md,
// часть IX, «Правка .gitignore»). Правило действует сразу, без коммита: это обычный файл
// рабочего каталога, правила разбираются при каждой команде заново.
//
// Кнопка ✎ (суффикс к содержимому остальных файлов) не входит в поток g18a.
// ============================================================
import type { HistoryEntry, PracticesState } from './practicesTypes'
import { GITIGNORE_FILE } from './practicesGitignore'
import { ru } from '../locales/ru'

/**
 * Записывает `content` в `.gitignore` целиком. Если текст не изменился, состояние возвращается
 * как есть (заметки в историю не попадает). Иначе в историю дописывается заметка. Что ни
 * записали — любой текст допустим, разбор не падает (непарная `[` просто ничего не совпадает, П7.17).
 */
export function writeGitignore(state: PracticesState, content: string): PracticesState {
  if (state.working[GITIGNORE_FILE] === content) return state
  const note: HistoryEntry = { kind: 'note', text: ru.practices.fileOps.gitignoreSavedNote }
  return { ...state, working: { ...state.working, [GITIGNORE_FILE]: content }, history: [...state.history, note] }
}
