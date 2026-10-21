// ============================================================
// Помощники тестов раздела 8 (шаг A). Читают протоколы прогонов настоящего git 2.53.0
// (docs/git-trainer/reports/section8-git-runs.txt, блоки П8.1–П8.20, и appendix-g18e-git-runs.txt,
// блоки П8.21–П8.40, appendix-g18e2-git-runs.txt, блоки П8.41–П8.56, appendix-g18g-git-runs.txt, блоки П8.57–П8.68, appendix-g18g2-git-runs.txt, блоки П8.69–П8.81, и appendix-g18g3-git-runs.txt, блоки П8.82–П8.88)
// и detached-head-git-runs.txt, блоки О1–О31, и conflicts-git-runs.txt, блоки К1–К19) и выдают команды блока с выводом и кодом возврата. Блок можно проиграть на
// движке целиком: id коммитов и объектов у git настоящие, у тренажёра свои, поэтому вывод
// сверяется со скелетом, а соответствие «настоящий id → id тренажёра» запоминается и обязано
// сохраняться до конца блока (один и тот же коммит не может получить два разных id). В приложение
// не импортируется.
// ============================================================
import section8Runs from '../../../../docs/git-trainer/reports/section8-git-runs.txt?raw'
import appendixRuns from '../../../../docs/git-trainer/reports/appendix-g18e-git-runs.txt?raw'
import stashRuns from '../../../../docs/git-trainer/reports/appendix-g18e2-git-runs.txt?raw'
import switchRuns from '../../../../docs/git-trainer/reports/appendix-g18g-git-runs.txt?raw'
import resetRuns from '../../../../docs/git-trainer/reports/appendix-g18g2-git-runs.txt?raw'
import rebaseRuns from '../../../../docs/git-trainer/reports/appendix-g18g3-git-runs.txt?raw'
import detachedRuns from '../../../../docs/git-trainer/reports/detached-head-git-runs.txt?raw'
import conflictRuns from '../../../../docs/git-trainer/reports/conflicts-git-runs.txt?raw'
import { createAppendixSection, createAppendixFile, deleteAppendixFile, editAppendixFile, runAppendixCommand } from './appendixSection'
import type { AppendixState, CommandResult } from './appendixSection'

export interface ProtocolEntry {
  command: string
  /** Вывод между командой и `[exit N]`, строки через `\n`, без завершающего перевода строки. */
  output: string
  exitCode: number
  /** Номер строки команды в файле протокола (с 1). */
  line: number
  file: 'section8-git-runs.txt' | 'appendix-g18e-git-runs.txt' | 'appendix-g18e2-git-runs.txt' | 'appendix-g18g-git-runs.txt' | 'appendix-g18g2-git-runs.txt' | 'appendix-g18g3-git-runs.txt' | 'detached-head-git-runs.txt' | 'conflicts-git-runs.txt'
}

const HEADER = /^===== (П8\.\d+|О\d+|К\d+\.[0-9A-Za-z]+)\./

function readBlocks(text: string, file: ProtocolEntry['file'], into: Map<string, ProtocolEntry[]>): void {
  const lines = text.split('\n')
  let current: ProtocolEntry[] | null = null
  for (let i = 0; i < lines.length; i++) {
    const header = HEADER.exec(lines[i])
    if (header) {
      current = []
      into.set(header[1], current)
      continue
    }
    // Строка из одних `=` вне вывода команды — не заголовок блока (метка конфликта `=======` лежит внутри вывода).
    if (lines[i].startsWith('=====') && !/^=+$/.test(lines[i])) {
      current = null
      continue
    }
    if (current === null || !lines[i].startsWith('$ ')) continue
    const command = lines[i].slice(2)
    const start = i + 1
    const out: string[] = []
    i++
    // Метка кода возврата бывает приклеена к последней строке вывода (файл без перевода строки в конце): такая команда
    // поглощает следующие до настоящей метки, но не заголовок следующего блока (К19.3 перед К7.11).
    while (i < lines.length && !/^\[exit \d+\]$/.test(lines[i]) && !HEADER.test(lines[i])) {
      out.push(lines[i])
      i++
    }
    const stoppedAtHeader = HEADER.test(lines[i] ?? '')
    const exitCode = stoppedAtHeader ? -1 : Number(/\d+/.exec(lines[i] ?? '')?.[0] ?? -1)
    if (stoppedAtHeader) i--
    current.push({ command, output: out.join('\n'), exitCode, line: start, file })
  }
}

const blocks = new Map<string, ProtocolEntry[]>()
readBlocks(section8Runs, 'section8-git-runs.txt', blocks)
readBlocks(appendixRuns, 'appendix-g18e-git-runs.txt', blocks)
readBlocks(stashRuns, 'appendix-g18e2-git-runs.txt', blocks)
readBlocks(switchRuns, 'appendix-g18g-git-runs.txt', blocks)
readBlocks(resetRuns, 'appendix-g18g2-git-runs.txt', blocks)
readBlocks(rebaseRuns, 'appendix-g18g3-git-runs.txt', blocks)
readBlocks(detachedRuns, 'detached-head-git-runs.txt', blocks)
readBlocks(conflictRuns, 'conflicts-git-runs.txt', blocks)

/** Команды блока (`П8.21`) в порядке протокола. */
export function protocolBlock(block: string): ProtocolEntry[] {
  const list = blocks.get(block)
  if (!list) throw new Error(`в протоколе нет блока ${block}`)
  return list
}

/** Команда блока по точному тексту (n-е вхождение, с нуля). */
export function protocolEntry(block: string, command: string, nth = 0): ProtocolEntry {
  const found = protocolBlock(block).filter((e) => e.command === command)[nth]
  if (!found) throw new Error(`в блоке ${block} нет команды «${command}» (${nth})`)
  return found
}

// ---------- нормализация ----------

const ID = /\b[0-9a-f]{7}(?:[0-9a-f]{33})?\b/g

/**
 * Вывод git приводится к тому, что печатает тренажёр: без строк `Author:`, `Date:` и `Tagger:`,
 * без диффстата и `create mode` после первой строки `git commit` и `git cherry-pick`, без маркера
 * `\ No newline at end of file`, с одинаковыми хэшами блобов в строках `index` и с путём `/site` вместо
 * каталога прогона в отказе `branch -d` текущей ветки (там тренажёр, как раздел 2, ставит плейсхолдер). Строки хода rebase
 * `Rebasing (k/n)<CR>` (возврат каретки, опасное место 16) в протоколе есть, тренажёр их не печатает: они срезаются.
 */
export function normalizeGitOutput(command: string, output: string): string {
  let lines = output.split('\n')
  if (/(^|; )git (commit|cherry-pick)/.test(command) && lines[0]?.startsWith('[')) lines = [lines[0]]
  lines = lines
    .filter((l) => !/^(Author|Tagger): /.test(l) && !/^Date: {3}/.test(l) && l !== '\\ No newline at end of file')
    .map((l) => l.replace(/Rebasing \(\d+\/\d+\)<CR>/g, '').replace(/^index [0-9a-f]{7}\.\.[0-9a-f]{7}/, 'index <blob>..<blob>').replace("used by worktree at '/work'", "used by worktree at '/site'"))
  return lines.join('\n')
}

/** Соответствие «настоящий id (первые 7 знаков) → id тренажёра», накапливается по ходу блока. */
export type IdMap = Map<string, string>

function skeleton(text: string, ids: string[]): string {
  return text.replace(ID, (m) => {
    ids.push(m)
    return '<id>'
  })
}

/**
 * Скелеты вывода совпадают, а id попарно соответствуют друг другу и прежним парам. Возвращает
 * `null`, если всё сходится, иначе описание расхождения.
 */
export function compareOutputs(expected: string, actual: string, map: IdMap): string | null {
  const expectedIds: string[] = []
  const actualIds: string[] = []
  const a = skeleton(expected, expectedIds)
  const b = skeleton(actual, actualIds)
  if (a !== b) return `скелеты различаются:\n--- git\n${a}\n--- тренажёр\n${b}`
  for (let i = 0; i < expectedIds.length; i++) {
    const real = expectedIds[i].slice(0, 7)
    const own = actualIds[i].slice(0, 7)
    const known = map.get(real)
    if (known !== undefined && known !== own) return `id ${real} уже соответствовал ${known}, а теперь ${own}`
    for (const [other, mapped] of map) if (mapped === own && other !== real) return `id ${own} тренажёра уже соответствует ${other}, а не ${real}`
    map.set(real, own)
  }
  return null
}

/** Слово команды, похожее на id коммита (4–40 знаков), заменяется id тренажёра, если соответствие уже известно. */
export function translateCommand(command: string, map: IdMap, fullIds: readonly string[]): string {
  return command
    .split(' ')
    .map((word) => {
      if (!/^[0-9a-f]{4,40}$/.test(word)) return word
      for (const [real, own] of map) {
        if (real.startsWith(word.slice(0, 7)) || word.startsWith(real)) {
          const full = fullIds.find((id) => id.startsWith(own))
          return full === undefined ? word : full.slice(0, word.length)
        }
      }
      return word
    })
    .join(' ')
}

// ---------- проигрывание блока ----------

export interface ReplayStep {
  entry: ProtocolEntry
  /** Файловая операция (`edit`, `mkfile`, `rm`): у неё нет вывода. */
  fileOperation: boolean
  result: CommandResult | null
  /** Расхождение с протоколом; `null`, если вывод и код возврата совпали. */
  mismatch: string | null
}

export interface Replay {
  steps: ReplayStep[]
  state: AppendixState
  ids: IdMap
}

/** Ответ тренажёра — отказ области: кода возврата нет, вывод начинается с метки. */
function isScopeRefusal(result: CommandResult): boolean {
  return result.exitCode === undefined && !result.ok && result.output.startsWith('[тренажёр]')
}

export interface ReplayOptions {
  /** Шаги, на которых тренажёр обязан ответить отказом области вместо вывода git. */
  refused?: (entry: ProtocolEntry, index: number) => boolean
  /** Состояние, с которого начинается блок. */
  from?: AppendixState
  /** Шаги, которые не проигрываются (команды вне области раздела, например `git checkout <тег>`). */
  skip?: (entry: ProtocolEntry, index: number) => boolean
  /** Проигрывать только шаги с номерами до этого (не включая). */
  until?: number
  /**
   * Шаги, у которых строки протокола стоят в другом порядке: вне терминала git сбрасывает stdout (`M\t<файл>`) в конце команды,
   * на терминале — первым (О24, target.md, часть XII). Такие шаги сверяются как наборы строк.
   */
  unordered?: (entry: ProtocolEntry, index: number) => boolean
}

/**
 * Части строки протокола: `a; b; c`. Цикл `for i in 1 2 3; do <тело>; done; <остальное>` разворачивается
 * в тело для каждого значения (`$i` заменяется числом).
 */
function commandParts(command: string): string[] {
  const loop = /^for i in ([\d ]+); do (.*); done(?:; (.*))?$/.exec(command)
  if (loop === null) return command.split('; ')
  const body = loop[2].split('; ')
  const unrolled = loop[1].split(' ').flatMap((n) => body.map((part) => part.replace(/\$i/g, n)))
  return loop[3] === undefined ? unrolled : [...unrolled, ...loop[3].split('; ')]
}

/** Команда с ключом `-q`, `-qm` или `-qam`: подготовка в протоколе, её вывод образцом не служит. */
function isQuiet(command: string): boolean {
  return /(^|\s)-q[am]*(\s|$)/.test(command)
}

/** Та же команда без `-q`: тренажёр ключа не знает. */
function withoutQuiet(command: string): string {
  return command.replace(/(^|\s)-q(\s|$)/g, '$1').replace(/(^|\s)-q([am]+)(\s|$)/g, '$1-$2$3').replace(/\s+/g, ' ').trim()
}

/** Проигрывает блок протокола на движке и сверяет вывод и код возврата каждой команды git. */
export function replayBlock(block: string | readonly string[], options: ReplayOptions = {}): Replay {
  let state = options.from ?? createAppendixSection()
  const ids: IdMap = new Map()
  const steps: ReplayStep[] = []
  // Несколько блоков подряд — одна история (О12–О23 сняты в одном репозитории).
  const entries = (typeof block === 'string' ? [block] : block).flatMap((name) => protocolBlock(name))
  const limit = options.until ?? entries.length
  entries.forEach((entry, index) => {
    if (index >= limit) return
    if (options.skip?.(entry, index)) return
    const file = /^(edit|mkfile|rm) (\S+)$/.exec(entry.command)
    if (file) {
      state = file[1] === 'edit' ? editAppendixFile(state, file[2]) : file[1] === 'mkfile' ? createAppendixFile(state, file[2]) : deleteAppendixFile(state, file[2])
      steps.push({ entry, fileOperation: true, result: null, mismatch: null })
      return
    }
    // Строка протокола бывает составной (`echo a >> app.js; git commit -qam "…"; git log -1`): каждая часть выполняется,
    // вывод частей с ключом `-q` (подготовка) в сверку не входит, код возврата берётся у последней части.
    let result = null as unknown as CommandResult
    const printed: string[] = []
    for (const part of commandParts(entry.command)) {
      const echoed = /^echo .* >> (\S+)$/.exec(part)
      if (echoed) {
        state = editAppendixFile(state, echoed[1])
        result = { ok: true, output: '', explanation: null, exitCode: 0 }
        continue
      }
      const quiet = isQuiet(part)
      const run = runAppendixCommand(state, translateCommand(quiet ? withoutQuiet(part) : part, ids, Object.keys(state.commits)))
      state = run.state
      result = run.result as CommandResult
      if (!quiet && result.output !== '') printed.push(result.output)
    }
    const shown = printed.join('\n')
    let mismatch: string | null = null
    if (options.refused?.(entry, index)) {
      if (!isScopeRefusal(result)) mismatch = `ожидался отказ области, получено: ${result.output}`
    } else if (result.exitCode !== entry.exitCode) {
      mismatch = `код возврата ${result.exitCode}, в протоколе ${entry.exitCode}`
    } else {
      const sorted = options.unordered?.(entry, index) === true
      const lines = (text: string) => (sorted ? text.split('\n').sort().join('\n') : text)
      mismatch = compareOutputs(lines(normalizeGitOutput(entry.command, entry.output)), lines(normalizeGitOutput(entry.command, shown)), ids)
    }
    steps.push({ entry, fileOperation: false, result: { ...result, output: shown }, mismatch })
  })
  return { steps, state, ids }
}

// ---------- короткие помощники тестов ----------

/** Выполняет строку терминала; пустая строка здесь ошибка теста. */
export function run(state: AppendixState, line: string): { state: AppendixState; result: CommandResult } {
  const r = runAppendixCommand(state, line)
  if (r.result === null) throw new Error('пустая строка')
  return { state: r.state, result: r.result }
}

/** Выполняет несколько строк подряд на одном состоянии. */
export function runAll(state: AppendixState, lines: readonly string[]): AppendixState {
  return lines.reduce((s, l) => run(s, l).state, state)
}

export const fresh = (): AppendixState => createAppendixSection()

/** Подпись `файл:строка` протокола для названия теста. */
export function where(block: string, command: string, nth = 0): string {
  const e = protocolEntry(block, command, nth)
  return `${e.file}:${e.line}`
}
