// ============================================================
// Общий небольшой модуль новых разделов (7 и 8): решение владельца В1. Разделы 1–6 его не
// используют и не меняются. Сейчас здесь только форматирование `git status` для репозитория
// без коммитов; id коммита из 40 знаков и `checkSafety` добавят следующие потоки.
//
// Строки вывода git — английские литералы, не переводятся (target.md, часть III, правило 2;
// решение В4). Каждая строка и порядок строк сверены с прогонами git 2.53.0
// (docs/git-trainer/reports/section7-git-runs.txt, П7.1–П7.21, П7.27–П7.45).
//
// Модуль чистый: состояния нет, DOM, таймеров и сети нет. Ошибки игрока здесь не возникают —
// только «эту форму модуль не воспроизводит» (`ok: false` с причиной), и вызывающий раздел
// отвечает честным отказом области, а не выдуманным выводом git.
// ============================================================

/** Состояние файла рабочего каталога для `git status` (отслеживаемых файлов в этих разделах нет). */
export type StatusEntryKind = 'untracked' | 'ignored'

export interface StatusEntry {
  /** Путь от корня репозитория, без `./`. */
  path: string
  kind: StatusEntryKind
}

/**
 * Разобранные ключи. Воспроизводятся только четыре набора, сверенные прогонами:
 * `git status` (П7.21), `-s` (П7.27…), `--short --ignored` (П7.27…), `--short --ignored -uall`
 * (П7.1…П7.20). Остальные сочетания дают `unverifiedCombo`.
 */
export interface StatusOptions {
  short: boolean
  ignored: boolean
  uall: boolean
}

export type StatusFormatResult =
  | { ok: true; output: string }
  | {
      ok: false
      /**
       * - `unverifiedCombo` — сочетание ключей, которого нет в прогонах;
       * - `noUntracked` — нет ни одного неотслеживаемого файла: прогонов такого вывода нет;
       * - `unsupportedLayout` — каталог с игнорируемыми и неигнорируемыми файлами глубже одного
       *   уровня: свёртка такого каталога прогонами не сверена.
       */
      reason: 'unverifiedCombo' | 'noUntracked' | 'unsupportedLayout'
    }

/** Один печатаемый элемент: файл или свёрнутый каталог с `/` в конце. */
interface Line {
  name: string
  kind: StatusEntryKind
}

function compareBytes(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Свёртка каталогов без `-uall` (target.md, часть IX, место 10, П7.27–П7.45). Верхний каталог
 * сворачивается в одну строку с `/` по тому, что в нём лежит:
 * - ни одного игнорируемого файла: `?? dir/`;
 * - все файлы игнорируются: `!! dir/` (виден только с `--ignored`);
 * - вместе: `?? dir/` и отдельной строкой каждый игнорируемый файл (П7.34).
 * Файлы в корне печатаются как есть.
 */
function collapse(entries: readonly StatusEntry[]): Line[] | null {
  const lines: Line[] = []
  const byDir = new Map<string, StatusEntry[]>()
  for (const entry of entries) {
    const slash = entry.path.indexOf('/')
    if (slash < 0) {
      lines.push({ name: entry.path, kind: entry.kind })
      continue
    }
    const dir = entry.path.slice(0, slash)
    const bucket = byDir.get(dir)
    if (bucket === undefined) byDir.set(dir, [entry])
    else bucket.push(entry)
  }
  for (const [dir, files] of byDir) {
    const hasUntracked = files.some((f) => f.kind === 'untracked')
    const hasIgnored = files.some((f) => f.kind === 'ignored')
    if (hasUntracked && hasIgnored) {
      // П7.34 сверена только на плоском каталоге (`build/`); с вложенными каталогами не сверено.
      if (files.some((f) => f.path.indexOf('/', dir.length + 1) >= 0)) return null
      lines.push({ name: `${dir}/`, kind: 'untracked' })
      for (const f of files) if (f.kind === 'ignored') lines.push({ name: f.path, kind: 'ignored' })
    } else {
      lines.push({ name: `${dir}/`, kind: hasIgnored ? 'ignored' : 'untracked' })
    }
  }
  return lines
}

/**
 * Вывод `git status` для репозитория на ветке `branch` без коммитов (П7.21: «No commits yet»).
 * Строки идут так: сначала все `??`, потом все `!!`, внутри группы — в порядке байтов имени
 * (П7.1); каталог встаёт в общий порядок вместе с файлами (П7.34).
 */
export function formatStatusNoCommits(branch: string, entries: readonly StatusEntry[], options: StatusOptions): StatusFormatResult {
  const verified =
    (!options.short && !options.ignored && !options.uall) ||
    (options.short && !options.ignored && !options.uall) ||
    (options.short && options.ignored && !options.uall) ||
    (options.short && options.ignored && options.uall)
  if (!verified) return { ok: false, reason: 'unverifiedCombo' }
  if (!entries.some((e) => e.kind === 'untracked')) return { ok: false, reason: 'noUntracked' }

  let lines: Line[]
  if (options.uall) {
    lines = entries.map((e) => ({ name: e.path, kind: e.kind }))
  } else {
    const collapsed = collapse(entries)
    if (collapsed === null) return { ok: false, reason: 'unsupportedLayout' }
    lines = collapsed
  }
  const untracked = lines.filter((l) => l.kind === 'untracked').sort((a, b) => compareBytes(a.name, b.name))
  const ignored = options.ignored ? lines.filter((l) => l.kind === 'ignored').sort((a, b) => compareBytes(a.name, b.name)) : []

  if (options.short) {
    const out = [...untracked.map((l) => `?? ${l.name}`), ...ignored.map((l) => `!! ${l.name}`)]
    return { ok: true, output: out.join('\n') }
  }
  const out = [
    `On branch ${branch}`,
    '',
    'No commits yet',
    '',
    'Untracked files:',
    '  (use "git add <file>..." to include in what will be committed)',
    ...untracked.map((l) => `\t${l.name}`),
    '',
    'nothing added to commit but untracked files present (use "git add" to track)',
  ]
  return { ok: true, output: out.join('\n') }
}
