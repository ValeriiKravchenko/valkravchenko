// ============================================================
// Раздел 8 git-тренажёра («Приложение: пять важных тем»), шаг A: публичная точка входа движка.
// Аналог practicesSection.ts. Внутренние модули (appendix*.ts, sectionsCommon.ts,
// detachedHead.ts) снаружи напрямую не импортируются: экран берёт всё отсюда.
//
// Состояние неизменяемое: каждая функция возвращает новый объект. Команда ничего не бросает:
// отказ git (вывод и код возврата в `exitCode`) и отказ области (без `exitCode`, вывод начинается
// с метки «[тренажёр]») — обычные результаты.
// ============================================================
import type { AppendixMissionId, AppendixMissionView, AppendixState, CommandResult, FileTree, Head, HistoryEntry } from './appendixTypes'
import { executeAppendixCommand } from './appendixCommands'
import { createFile as createFileRaw, deleteFile as deleteFileRaw, editFile as editFileRaw } from './appendixFileOps'
import { getAppendixMissions as getAppendixMissionsRaw } from './appendixMissions'
import { allStarts, branchNames, createAppendixSection as createAppendixSectionRaw, decorationMap, listWorkingFiles, logOrder, subjectOf, tagNames } from './appendixRepo'
import { shortCommitId } from './sectionsCommon'
import { has } from './util'

export type { AppendixMissionId, AppendixMissionView, AppendixState, CommandResult, FileTree, Head, HistoryEntry }
export { APPENDIX_MISSION_IDS } from './appendixTypes'

/** Начальное состояние: `master` и `feature`, 4 коммита, HEAD на `master`, чистый рабочий каталог, тегов нет. */
export function createAppendixSection(): AppendixState {
  return createAppendixSectionRaw()
}

/** Кнопка «↺ Начать раздел заново»: исходное состояние. */
export function resetAppendixSection(): AppendixState {
  return createAppendixSectionRaw()
}

/**
 * Выполняет одну строку терминала. Пустая строка не меняет состояние и возвращает `result === null`.
 * Ничего не бросает: отказ git и отказ области — обычный результат.
 */
export function runAppendixCommand(state: AppendixState, rawInput: string): { state: AppendixState; result: CommandResult | null } {
  return executeAppendixCommand(state, rawInput)
}

/** Кнопка «✎ изменить»: дописывает суффикс к содержимому перед концом файла. Файла нет — состояние не меняется. */
export function editAppendixFile(state: AppendixState, file: string): AppendixState {
  return editFileRaw(state, file)
}

/** Кнопка «🗑 удалить из каталога»: убирает файл только из рабочего каталога. Файла нет — состояние не меняется. */
export function deleteAppendixFile(state: AppendixState, file: string): AppendixState {
  return deleteFileRaw(state, file)
}

/** «Создать файл». Пустое имя — состояние не меняется; занятое или недопустимое имя — только заметка в истории. */
export function createAppendixFile(state: AppendixState, rawName: string): AppendixState {
  return createFileRaw(state, rawName)
}

/** Пути файлов рабочего каталога в порядке байтов — для панели файлов. */
export function getWorkingFiles(state: AppendixState): string[] {
  return listWorkingFiles(state)
}

/** Содержимое файла рабочего каталога; `null`, если файла нет. */
export function getFileContent(state: AppendixState, file: string): string | null {
  return has(state.working, file) ? state.working[file] : null
}

/** Ветка для списка: `current` — на ней стоит HEAD. */
export interface BranchView {
  name: string
  /** Полный id коммита (40 знаков). */
  id: string
  /** Первые 7 знаков, как в выводе git. */
  shortId: string
  current: boolean
}

/** Ветки в порядке байтов имени. */
export function getBranches(state: AppendixState): BranchView[] {
  return branchNames(state).map((name) => ({
    name,
    id: state.branches[name],
    shortId: shortCommitId(state.branches[name]),
    current: state.head.kind === 'branch' && state.head.name === name,
  }))
}

/** Коммит для списка или графа: подписи — те же, что `git log` печатает в скобках. */
export interface CommitView {
  id: string
  shortId: string
  subject: string
  parents: string[]
  /** Подписи по порядку git: `HEAD -> master`, `tag: v1`, `feature`. */
  decorations: string[]
}

/** Все коммиты репозитория, новые сверху (по логическому моменту: родитель всегда ниже потомка). */
export function getCommits(state: AppendixState): CommitView[] {
  const decorations = decorationMap(state)
  return logOrder(state, allStarts(state)).map((id) => ({
    id,
    shortId: shortCommitId(id),
    subject: subjectOf(state, id),
    parents: state.commits[id].parents,
    decorations: decorations.get(id) ?? [],
  }))
}

/** Тег для списка. */
export interface TagView {
  name: string
  kind: 'light' | 'annotated'
  /** Коммит, на который указывает тег (у аннотированного — после раскрытия объекта). */
  commit: string
  shortCommit: string
  /** Сообщение аннотированного тега; у лёгкого `null`. */
  message: string | null
}

/** Теги в порядке байтов имени, как их печатает `git tag`. */
export function getTags(state: AppendixState): TagView[] {
  return tagNames(state).map((name) => {
    const tag = state.tags[name]
    return { name, kind: tag.kind, commit: tag.commit, shortCommit: shortCommitId(tag.commit), message: tag.kind === 'annotated' ? tag.message : null }
  })
}

/** Миссии шага A (1 — лёгкий тег, 2 — `git show` аннотированного тега); засчитанная остаётся засчитанной. */
export function getAppendixMissions(state: AppendixState): AppendixMissionView[] {
  return getAppendixMissionsRaw(state)
}
