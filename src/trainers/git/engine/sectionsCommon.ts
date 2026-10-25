// ============================================================
// Общий небольшой модуль новых разделов (7 и 8): решение владельца В1. Разделы 1–6 его не
// используют и не меняются. Здесь три части:
// - форматирование `git status` для репозитория без коммитов;
// - id коммита из 40 знаков и его короткая форма из 7 (в выводе git показываются 7);
// - `checkSafety`: не затрёт ли переход несохранённые правки.
//
// Строки вывода git — английские литералы, не переводятся (target.md, часть III, правило 2;
// решение В4). Каждая строка и порядок строк сверены с прогонами git 2.53.0
// (docs/git-trainer/reports/section7-git-runs.txt, П7.1–П7.21, П7.27–П7.45).
//
// Модуль чистый: состояния нет, DOM, таймеров и сети нет. Ошибки игрока здесь не возникают —
// только «эту форму модуль не воспроизводит» (`ok: false` с причиной), и вызывающий раздел
// отвечает честным отказом области, а не выдуманным выводом git.
// ============================================================
import type { FileTree } from './types'
import { has } from './util'
import { compareBytes as compareUtf8Bytes } from './appendixRefs'

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

// ---------- id коммита: 40 шестнадцатеричных знаков ----------
//
// Решение В2: разделы 1–5 хранят 7 знаков и не меняются; раздел 6 держит свой `searchCommitId`.
// Коммиты раздела 8 рождаются по ходу игры, поэтому входы те же, что у `commitHashCore` (util.ts):
// сообщение, дерево файлов, родители и логические часы. Функция независимая: FNV-1a (не
// криптографическая, нужен только детерминизм), пять 32-битных раундов с разной солью,
// 5 × 8 hex = 40 знаков.

function fnv1a32(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function hex8(n: number): string {
  return n.toString(16).padStart(8, '0')
}

/** Полный id коммита: 40 знаков `[0-9a-f]`; одинаковый вход даёт одинаковый id. */
export function fullCommitId(message: string, tree: FileTree, parents: readonly string[], clock: number): string {
  const filesPart = Object.keys(tree)
    .sort()
    .map((f) => `${f}\0${tree[f]}`)
    .join('\n')
  const base = `${parents.join(',')}\n${message}\n${filesPart}\n${clock}`
  let out = ''
  for (let round = 0; round < 5; round++) out += hex8(fnv1a32(`${round}:${base}`))
  return out
}

/** Короткая форма, как её показывает git: первые 7 знаков полного id. */
export function shortCommitId(id: string): string {
  return id.slice(0, 7)
}

// ---------- checkSafety: «было бы затёрто» ----------

/** Файлы, у которых HEAD, индекс и рабочее дерево не совпадают. */
function localChangeFiles(head: FileTree, index: FileTree, working: FileTree): Set<string> {
  const files = new Set<string>([...Object.keys(head), ...Object.keys(index), ...Object.keys(working)])
  const dirty = new Set<string>()
  files.forEach((f) => {
    const h = has(head, f) ? head[f] : undefined
    const idx = has(index, f) ? index[f] : undefined
    const w = has(working, f) ? working[f] : undefined
    if (idx !== h || w !== idx) dirty.add(f)
  })
  return dirty
}

export interface SafetyBlock {
  /** Отслеживаемые файлы с несохранённой правкой, которую переход затёр бы («would be overwritten by checkout»). */
  modified: string[]
  /** Неотслеживаемые файлы, на место которых переход положил бы файл с тем же именем. */
  untracked: string[]
}

/**
 * Проверка «переход затрёт несохранённые правки» для checkout, switch и им подобных переходов.
 * `resultTree` — дерево, к которому приводит переход (для перехода на ветку или коммит — дерево
 * цели). Сигнатура и поведение те же, что у `checkSafety` в remoteRepo.ts (раздел 5): HEAD,
 * индекс и рабочее дерево передаются отдельными деревьями.
 *
 * Правило: две разные проверки git (unpack-trees.c, twoway_merge()), а не одна общая.
 *
 * Первое: путь трогают, только если переход меняет его содержимое относительно HEAD
 * (head !== target). Если у цели путь такой же, как в HEAD, git его не касается и никогда не
 * блокирует, какая бы правка ни была.
 *
 * Второе: если путь трогать надо, проверок две.
 * а) Застейдженная правка (index !== head). git сравнивает индекс с целью: если индекс уже равен
 *    цели, отказа нет, даже когда поверх лежит ещё и незастейдженная правка. Если индекс с
 *    целью не совпал, отказ.
 * б) Незастейдженная правка (working !== index, индекс не менялся). Работает verify_uptodate():
 *    рабочее дерево сравнивается с индексом, а не с целью. Раз индекс равен HEAD и отличается от
 *    цели, git обязан переписать путь, и отказывает, даже если итог случайно совпал бы с целью.
 * Обе половины сводятся к одной формуле: путь блокируется, если head !== target (переход путь
 * трогает) и index !== target (индекс ещё не на месте цели).
 *
 * Частный случай: файл удалён из рабочего дерева напрямую (без `git rm`), индекс не тронут.
 * verify_uptodate() делает lstat() и, если файла на диске нет, считает путь свежим: отказа нет
 * никогда, и файл создаётся заново с содержимым цели. Если удаление застейджено (`git rm`),
 * это случай (а), и отказ остаётся.
 *
 * Неотслеживаемые файлы (нет ни в HEAD, ни в индексе) проверяются отдельно и иначе:
 * блокируют только если у цели есть файл с тем же именем. Остальные неотслеживаемые файлы
 * переходят как есть. В `untracked` попадают только такие совпавшие по имени файлы.
 *
 * Правило сверено в разделах 2 и 5; для переходов с ветки на коммит и обратно его подтверждают
 * прогоны О7, О16 и О24 (docs/git-trainer/reports/detached-head-git-runs.txt).
 */
export function checkSafety(head: FileTree, index: FileTree, working: FileTree, resultTree: FileTree): SafetyBlock {
  const dirty = localChangeFiles(head, index, working)
  const modified: string[] = []
  const untracked: string[] = []
  dirty.forEach((f) => {
    const oldVal = has(head, f) ? head[f] : undefined
    const newVal = has(resultTree, f) ? resultTree[f] : undefined
    const knownToGit = has(head, f) || has(index, f)
    if (!knownToGit) {
      if (newVal !== undefined) untracked.push(f)
      return
    }
    const idxVal = has(index, f) ? index[f] : undefined
    const notStaged = idxVal === oldVal
    const missingOnDisk = !has(working, f)
    if (notStaged && missingOnDisk) return
    if (oldVal !== newVal && idxVal !== newVal) modified.push(f)
  })
  return { modified: modified.sort(compareUtf8Bytes), untracked: untracked.sort(compareUtf8Bytes) }
}

// ---------- git status для репозитория с коммитами ----------

/** Ключи `git status` для репозитория с коммитами: воспроизводятся `git status` и `git status -s` (`--short`). */
export interface CommitStatusOptions {
  short: boolean
}

export type CommitStatusResult =
  | { ok: true; output: string }
  | {
      ok: false
      /**
       * - `nestedPaths` — путь с каталогом: свёртка каталогов в этом выводе не воспроизводится;
       * - `renameDetection` — в подготовленном есть и удалённый, и добавленный файл: git ищет среди
       *   них переименования по сходству содержимого (П8.24), модуль сходство не считает.
       */
      reason: 'nestedPaths' | 'renameDetection'
    }

type StagedKind = 'new file' | 'modified' | 'deleted'
type UnstagedKind = 'modified' | 'deleted'

interface FileChange {
  path: string
  staged: StagedKind | null
  unstaged: UnstagedKind | null
}

const SHORT_LETTER: Record<StagedKind | UnstagedKind, string> = { 'new file': 'A', modified: 'M', deleted: 'D' }

/**
 * Вывод `git status` для репозитория с коммитами (target.md, часть X, место «Локальная работа»;
 * прогоны П8.1, П8.3, П8.21–П8.24 в docs/git-trainer/reports/). Входы — три снимка: HEAD, индекс
 * и рабочий каталог (путь → содержимое). `firstLine` — `On branch master` или `HEAD detached at …`
 * (его даёт `statusFirstLine` из detachedHead.ts); в коротком выводе строки ветки нет.
 *
 * Порядок строк: подготовленное, неподготовленное, неотслеживаемое; внутри блока по байтам имени.
 * Короткий вид: сначала отслеживаемые файлы по имени (`XY путь`), потом `?? путь`. Файл, удалённый
 * из индекса и созданный заново, — подготовленное удаление и неотслеживаемый файл одновременно
 * (П8.21). Подсказка неподготовленного блока читается `git add/rm`, если среди его файлов есть
 * удалённый (П8.21). Если подготовленное непусто, строки итога нет и вывод кончается пустой
 * строкой (П8.21); иначе итог — одна из трёх строк (П8.1, П8.21).
 */
export function formatStatusWithCommits(
  firstLine: string,
  head: FileTree,
  index: FileTree,
  working: FileTree,
  options: CommitStatusOptions,
): CommitStatusResult {
  const paths = [...new Set([...Object.keys(head), ...Object.keys(index), ...Object.keys(working)])].sort(compareBytes)
  if (paths.some((p) => p.includes('/'))) return { ok: false, reason: 'nestedPaths' }

  const changes: FileChange[] = []
  const untracked: string[] = []
  for (const path of paths) {
    const inHead = has(head, path)
    const inIndex = has(index, path)
    const inWorking = has(working, path)
    let staged: StagedKind | null = null
    if (inIndex && !inHead) staged = 'new file'
    else if (!inIndex && inHead) staged = 'deleted'
    else if (inIndex && inHead && index[path] !== head[path]) staged = 'modified'
    let unstaged: UnstagedKind | null = null
    if (inIndex && inWorking && index[path] !== working[path]) unstaged = 'modified'
    else if (inIndex && !inWorking) unstaged = 'deleted'
    if (staged !== null || unstaged !== null) changes.push({ path, staged, unstaged })
    if (!inIndex && inWorking) untracked.push(path)
  }

  const stagedList = changes.filter((c) => c.staged !== null)
  if (stagedList.some((c) => c.staged === 'new file') && stagedList.some((c) => c.staged === 'deleted')) {
    return { ok: false, reason: 'renameDetection' }
  }

  if (options.short) {
    const rows = changes.map((c) => `${c.staged === null ? ' ' : SHORT_LETTER[c.staged]}${c.unstaged === null ? ' ' : SHORT_LETTER[c.unstaged]} ${c.path}`)
    return { ok: true, output: [...rows, ...untracked.map((p) => `?? ${p}`)].join('\n') }
  }

  const row = (kind: string, path: string) => `\t${(kind + ':').padEnd(12)}${path}`
  const blocks: string[][] = []
  if (stagedList.length > 0) {
    blocks.push(['Changes to be committed:', '  (use "git restore --staged <file>..." to unstage)', ...stagedList.map((c) => row(c.staged as string, c.path))])
  }
  const unstagedList = changes.filter((c) => c.unstaged !== null)
  if (unstagedList.length > 0) {
    const addOrRm = unstagedList.some((c) => c.unstaged === 'deleted') ? 'git add/rm' : 'git add'
    blocks.push([
      'Changes not staged for commit:',
      `  (use "${addOrRm} <file>..." to update what will be committed)`,
      '  (use "git restore <file>..." to discard changes in working directory)',
      ...unstagedList.map((c) => row(c.unstaged as string, c.path)),
    ])
  }
  if (untracked.length > 0) {
    blocks.push(['Untracked files:', '  (use "git add <file>..." to include in what will be committed)', ...untracked.map((p) => `\t${p}`)])
  }
  if (stagedList.length === 0) {
    if (unstagedList.length > 0) blocks.push(['no changes added to commit (use "git add" and/or "git commit -a")'])
    else if (untracked.length > 0) blocks.push(['nothing added to commit but untracked files present (use "git add" to track)'])
    else blocks.push(['nothing to commit, working tree clean'])
  }
  let output = firstLine
  blocks.forEach((block, i) => {
    output += (i === 0 ? '\n' : '\n\n') + block.join('\n')
  })
  // С подготовленным блоком итоговой строки нет, и вывод кончается пустой строкой (П8.21).
  if (stagedList.length > 0) output += '\n'
  return { ok: true, output }
}
