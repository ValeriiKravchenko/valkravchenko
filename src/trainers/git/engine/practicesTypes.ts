// ============================================================
// Раздел 7 git-тренажёра («Эффективная работа»): типы состояния. Модель отдельная (решение
// владельца В1): без коммитов, пути с каталогами, два конфига. Разделы 1–6 не затрагиваются;
// из `types.ts` берутся только независимые от их моделей `CommandResult`, `HistoryEntry`,
// `FileTree` (так же делают `branchTypes.ts`, `inspectTypes.ts`).
// ============================================================
import type { CommandResult, FileTree, HistoryEntry } from './types'

export type { CommandResult, FileTree, HistoryEntry }

/** Одна запись конфига «ключ → значение». */
export interface ConfigEntry {
  key: string
  value: string
}

/**
 * Состояние раздела 7. Один репозиторий на ветке `master`, коммитов нет (поля с коммитами нет
 * вовсе: `git log` в этом состоянии всегда отвечает, что коммитов нет). Значения неизменяемые:
 * каждая функция движка возвращает новый объект.
 */
export interface PracticesState {
  /** Имя текущей ветки; в разделе всегда `master`. */
  branch: string
  /**
   * Рабочий каталог: путь от корня (с каталогами, `packages/ui/node_modules/x.js`) → содержимое.
   * Каталог существует, пока в нём есть файл. Порядок ключей — порядок создания.
   */
  working: FileTree
  /**
   * Индекс: путь → содержимое на момент `git add`. Пуст, пока игрок не сделал `git add -f`.
   * Файл из индекса отслеживаемый, правила `.gitignore` на него не действуют (П7.23).
   */
  index: FileTree
  /** `~/.gitconfig`: упорядоченный список «ключ → значение»; в разделе в него попадают только ключи `alias.<имя>`. */
  globalConfig: ConfigEntry[]
  /** `.git/config`: то же. В реальном файле перед записями алиасов стоит секция `[core]`, она в список не входит. */
  localConfig: ConfigEntry[]
  history: HistoryEntry[]
  /**
   * Засчитанные миссии (target.md, часть IX, «Миссии»). Значение, ставшее `true`, остаётся им
   * (часть I, п. 2). Миссии 1–3 пересчитываются по `.gitignore`, миссия 4 ставится событием
   * «алиас успешно выполнен».
   */
  missionsDone: Record<PracticesMissionId, boolean>
}

/** Четыре миссии раздела 7 в порядке target.md. */
export type PracticesMissionId = 'envExample' | 'importantLog' | 'buildContents' | 'aliasRun'

export const PRACTICES_MISSION_IDS: readonly PracticesMissionId[] = ['envExample', 'importantLog', 'buildContents', 'aliasRun']

/** Миссия для показа: текст и подсказка из словаря, отметка выполнения. */
export interface PracticesMissionView {
  id: PracticesMissionId
  text: string
  hint: string
  done: boolean
}
