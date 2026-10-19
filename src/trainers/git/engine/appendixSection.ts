// ============================================================
// Раздел 8 git-тренажёра («Приложение: пять важных тем»), шаги A и B (кроме rebase): публичная точка
// входа движка. Аналог practicesSection.ts. Внутренние модули (appendix*.ts, sectionsCommon.ts,
// detachedHead.ts) снаружи напрямую не импортируются: экран берёт всё отсюда.
//
// Состояние неизменяемое: каждая функция возвращает новый объект. Команда ничего не бросает:
// отказ git (вывод и код возврата в `exitCode`) и отказ области (без `exitCode`, вывод начинается
// с метки «[тренажёр]») — обычные результаты.
//
// Шаг B (без rebase): HEAD может стоять на коммите (`state.head.kind === 'detached'`). Команды:
// `git checkout` во всех формах перехода (ветка, тег, `tags/<тег>`, id, `<ссылка>~n`, `HEAD@{n}`,
// `refs/heads/<ветка>`, `--detach [<ссылка>]`, `-`, `-b`, `HEAD`), `git switch` (`<ветка>`, `--detach
// [<ссылка>]`, `-c <имя>`, `-`; на коммит и тег без `--detach` отказ git с кодом 128), `git reflog [-<n>]`
// и `git log -g --oneline [-<n>]`, `git branch -d/-D`, `git reset [--soft | --mixed | --hard] [<ссылка>]` (на ветке двигает
// ветку, в отсоединённом HEAD только HEAD) и `git cherry-pick <ссылка>`. Ссылка `HEAD@{n}` принимается там же,
// где другие ссылки (`show`, `log`, `tag`, `branch`, `checkout`, `switch`, `reset`, `cherry-pick`); за концом
// журнала — `fatal: log for 'HEAD' only has N entries`, код 128. `rebase`, `merge` и `pull` отвечают отказом области.
//
// Исходы команды различаются по `CommandResult`: ответ git — с `exitCode` (0 — успех), отказ области — без `exitCode`,
// вывод начинается с метки «[тренажёр]». Миссий шесть (`APPENDIX_MISSION_IDS`): 5 — `cherry-pick`, 6 — `reset --hard HEAD@{n}`
// на брошенный коммит.
// ============================================================
import type { AppendixMissionId, AppendixMissionView, AppendixState, CommandResult, FileTree, Head, HistoryEntry } from './appendixTypes'
import { executeAppendixCommand } from './appendixCommands'
import { createFile as createFileRaw, deleteFile as deleteFileRaw, editFile as editFileRaw } from './appendixFileOps'
import { getAppendixMissions as getAppendixMissionsRaw } from './appendixMissions'
import { branchNames, createAppendixSection as createAppendixSectionRaw, decorationMap, fadedCommitIds, listWorkingFiles, subjectOf, tagNames } from './appendixRepo'
import { compareBytes } from './appendixRefs'
import { shortCommitId } from './sectionsCommon'
import { has } from './util'

export type { AppendixMissionId, AppendixMissionView, AppendixState, CommandResult, FileTree, Head, HistoryEntry }
export { APPENDIX_MISSION_IDS } from './appendixTypes'

/** Начальное состояние: `master` и `feature`, 4 коммита, HEAD на `master`, чистый рабочий каталог, тегов и тайников нет. */
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

/** Ветка для списка: `current` — на ней стоит HEAD; в отсоединённом HEAD текущей нет ни у одной. */
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
  /** Подписи по порядку git: `HEAD -> master`, `tag: v1`, `feature`; в отсоединённом HEAD начинаются с `HEAD` без стрелки. */
  decorations: string[]
  /**
   * Бледный коммит: недостижим ни из одной ветки, ни из одного тега и не лежит под HEAD. Коммит не удалён
   * (его видно в `git reflog`), но на него ничто не указывает; снова обычным он становится, когда на него укажет ветка или тег.
   */
  faded: boolean
}

/**
 * Все коммиты репозитория, новые сверху (по логическому моменту: родитель всегда ниже потомка), в том числе
 * брошенные (`faded`): они остаются на графе бледными.
 */
export function getCommits(state: AppendixState): CommitView[] {
  const decorations = decorationMap(state)
  const faded = fadedCommitIds(state)
  const ids = Object.keys(state.commits).sort((a, b) => state.commits[b].clock - state.commits[a].clock || compareBytes(a, b))
  return ids.map((id) => ({
    id,
    shortId: shortCommitId(id),
    subject: subjectOf(state, id),
    parents: state.commits[id].parents,
    decorations: decorations.get(id) ?? [],
    faded: faded.has(id),
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

/** Тайник для списка в экране: подпись `stash@{n}`, как её печатает `git stash list`, и текст записи. */
export interface StashView {
  /** `stash@{0}` у вершины стопки. */
  ref: string
  /** Полный id (40 знаков) и первые 7 знаков. */
  id: string
  shortId: string
  /** Текст записи: `WIP on master: 9e73ccb Добавить README` или `On master: <сообщение>`. */
  text: string
  /** Метка ветки, на которой тайник сделан: `master` или `(no branch)`. */
  branch: string
}

/** Стопка тайников, свежий первым (`stash@{0}`). */
export function getStashes(state: AppendixState): StashView[] {
  return state.stashes.map((stash, i) => ({
    ref: `stash@{${i}}`,
    id: stash.id,
    shortId: shortCommitId(stash.id),
    text: stash.text,
    branch: stash.branch,
  }))
}

/**
 * Миссии (1 — лёгкий тег, 2 — `git show` аннотированного тега, 3 — спрятать правку, 4 — вернуть спрятанное, 5 — `git cherry-pick`,
 * 6 — `git reset --hard HEAD@{n}` на брошенный коммит); засчитанная остаётся засчитанной.
 */
export function getAppendixMissions(state: AppendixState): AppendixMissionView[] {
  return getAppendixMissionsRaw(state)
}
