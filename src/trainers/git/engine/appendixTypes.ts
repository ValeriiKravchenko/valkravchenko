// ============================================================
// Раздел 8 git-тренажёра («Приложение: пять важных тем»), шаг A: типы состояния. Модель
// отдельная (решение владельца В1): ветки и теги, 40-значные id коммитов, HEAD как `Head` из
// общего модуля `detachedHead.ts`, журнал HEAD. Разделы 1–7 не затрагиваются; из `types.ts`
// берутся только независимые от их моделей `CommandResult`, `HistoryEntry`, `FileTree` (так же
// делают `branchTypes.ts`, `practicesTypes.ts`).
// ============================================================
import type { CommandResult, FileTree, HistoryEntry } from './types'
import type { Head, LastCheckout } from './detachedHead'

export type { CommandResult, FileTree, HistoryEntry, Head, LastCheckout }

/** Один коммит. `id` — 40 шестнадцатеричных знаков; показываются первые 7. */
export interface AppendixCommit {
  id: string
  parents: string[]
  message: string
  tree: FileTree
  /** Логический момент создания (`AppendixState.clock` в момент коммита): по нему `git log --all` ставит новые сверху. */
  clock: number
}

/**
 * Тег. Лёгкий — только имя коммита. Аннотированный — отдельный объект со своим id (считается от
 * имени, сообщения, коммита и логического момента), коммитом и сообщением. Автора и даты у
 * объекта в модели нет: тренажёр их не печатает (target.md, часть X, «Автор и дата в разделе 8»).
 */
export type AppendixTag = { kind: 'light'; commit: string } | { kind: 'annotated'; object: string; commit: string; message: string }

/** Запись журнала HEAD: коммит, на котором стоял HEAD после действия, и текст записи. */
export interface ReflogEntry {
  id: string
  message: string
}

/** Миссии шага A, которые закрывает эта часть: 1 — лёгкий тег, 2 — `git show` аннотированного тега. */
export type AppendixMissionId = 'lightTag' | 'annotatedShow'

export const APPENDIX_MISSION_IDS: readonly AppendixMissionId[] = ['lightTag', 'annotatedShow']

/** Миссия для показа: текст и подсказка из словаря, отметка выполнения. */
export interface AppendixMissionView {
  id: AppendixMissionId
  text: string
  hint: string
  done: boolean
}

/**
 * Состояние раздела 8. Значения неизменяемые: каждая функция движка возвращает новый объект.
 * HEAD в шаге A всегда на ветке, но тип `Head` допускает и отсоединённый HEAD: строкой его
 * кодировать нельзя (id в поле с именем ветки молча даёт `undefined`).
 */
export interface AppendixState {
  /** Все коммиты по id. */
  commits: Record<string, AppendixCommit>
  /** Имя ветки → id коммита. */
  branches: Record<string, string>
  head: Head
  /** Последний переход, записанный в журнал как `checkout: moving from … to …`. */
  lastCheckout: LastCheckout | null
  /** Индекс: путь → содержимое. Полный снимок, а не только подготовленное. */
  index: FileTree
  /** Рабочий каталог: путь → содержимое. Файлы без каталогов, каждый кончается переводом строки. */
  working: FileTree
  /** Имя тега → тег. */
  tags: Record<string, AppendixTag>
  /** Журнал HEAD, новая запись первой. */
  reflog: ReflogEntry[]
  history: HistoryEntry[]
  /** Засчитанные миссии; значение, ставшее `true`, остаётся им (часть I, п. 2). */
  missionsDone: Record<AppendixMissionId, boolean>
  /** Логические часы: растут на единицу при каждом новом коммите и каждом новом объекте аннотированного тега. */
  clock: number
}
