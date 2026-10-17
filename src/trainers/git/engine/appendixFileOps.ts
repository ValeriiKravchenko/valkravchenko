// ============================================================
// Раздел 8 git-тренажёра, шаг A: файловые операции над рабочим каталогом — кнопки «✎ изменить»,
// «🗑 удалить из каталога» и «создать файл». Как в разделах 2–6 (branchFileOps.ts), они меняют
// только рабочий каталог: индекс и коммиты не трогаются. Версий содержимого для `app.js` нет
// (решение владельца В3): правка дописывает суффикс из словаря («+ правка»).
//
// Файлы раздела кончаются переводом строки, и это сохраняется: суффикс встаёт перед ним, а
// новый файл создаётся с переводом строки (иначе `git diff` и `git show` обязаны были бы
// печатать `\ No newline at end of file`, а тренажёр этот маркер не печатает).
// Имя нового файла — латинские буквы, цифры, `.`, `_`, `-`, не с точки и не с дефиса, без каталогов:
// git печатает такие имена в status без кавычек, а тренажёр не показывает каталоги и скрытые файлы.
// ============================================================
import type { AppendixState, HistoryEntry } from './appendixTypes'
import { has } from './util'
import { ru } from '../locales/ru'

const VALID_FILE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,63}$/

function pushNote(state: AppendixState, text: string): AppendixState {
  const entry: HistoryEntry = { kind: 'note', text }
  return { ...state, history: [...state.history, entry] }
}

/** «✎ изменить»: дописывает суффикс к содержимому перед концом файла. Файла нет — ничего не происходит. */
export function editFile(state: AppendixState, file: string): AppendixState {
  if (!has(state.working, file)) return state
  const current = state.working[file]
  const ending = current.endsWith('\n') ? '\n' : ''
  const content = current.slice(0, current.length - ending.length) + ru.fileOps.editedSuffix + ending
  const noted = pushNote(state, ru.fileOps.editedNote(file))
  return { ...noted, working: { ...noted.working, [file]: content } }
}

/** «🗑 удалить из каталога»: убирает файл только из рабочего каталога (индекс и коммиты не трогаются). */
export function deleteFile(state: AppendixState, file: string): AppendixState {
  if (!has(state.working, file)) return state
  const working = { ...state.working }
  delete working[file]
  const noted = pushNote(state, ru.fileOps.deletedNote(file))
  return { ...noted, working }
}

/**
 * «создать файл». Пустое имя — ничего не происходит, даже заметки. Занятое имя — файл не
 * затирается, только заметка. Недопустимое имя — заметка с объяснением, файла нет.
 */
export function createFile(state: AppendixState, rawName: string): AppendixState {
  const name = rawName.trim()
  if (name === '') return state
  if (!VALID_FILE_NAME.test(name)) return pushNote(state, ru.appendix.fileOps.invalidName(name))
  if (has(state.working, name)) return pushNote(state, ru.fileOps.duplicateNote(name))
  const noted = pushNote(state, ru.fileOps.createdNote(name))
  return { ...noted, working: { ...noted.working, [name]: `${ru.fileOps.newFileContent}\n` } }
}
