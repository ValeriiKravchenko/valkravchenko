// ============================================================
// Помощники тестов раздела 8 (шаг A). Читают протоколы прогонов настоящего git 2.53.0
// (docs/git-trainer/reports/section8-git-runs.txt, блоки П8.1–П8.20, и appendix-g18e-git-runs.txt,
// блоки П8.21–П8.40, и appendix-g18e2-git-runs.txt, блоки П8.41–П8.56) и выдают команды блока с выводом и кодом возврата. Блок можно проиграть на
// движке целиком: id коммитов и объектов у git настоящие, у тренажёра свои, поэтому вывод
// сверяется со скелетом, а соответствие «настоящий id → id тренажёра» запоминается и обязано
// сохраняться до конца блока (один и тот же коммит не может получить два разных id). В приложение
// не импортируется.
// ============================================================
import section8Runs from '../../../../docs/git-trainer/reports/section8-git-runs.txt?raw'
import appendixRuns from '../../../../docs/git-trainer/reports/appendix-g18e-git-runs.txt?raw'
import stashRuns from '../../../../docs/git-trainer/reports/appendix-g18e2-git-runs.txt?raw'
import { createAppendixSection, createAppendixFile, deleteAppendixFile, editAppendixFile, runAppendixCommand } from './appendixSection'
import type { AppendixState, CommandResult } from './appendixSection'

export interface ProtocolEntry {
  command: string
  /** Вывод между командой и `[exit N]`, строки через `\n`, без завершающего перевода строки. */
  output: string
  exitCode: number
  /** Номер строки команды в файле протокола (с 1). */
  line: number
  file: 'section8-git-runs.txt' | 'appendix-g18e-git-runs.txt' | 'appendix-g18e2-git-runs.txt'
}

function readBlocks(text: string, file: ProtocolEntry['file'], into: Map<string, ProtocolEntry[]>): void {
  const lines = text.split('\n')
  let current: ProtocolEntry[] | null = null
  for (let i = 0; i < lines.length; i++) {
    const header = /^===== (П8\.\d+)\./.exec(lines[i])
    if (header) {
      current = []
      into.set(header[1], current)
      continue
    }
    if (lines[i].startsWith('=====')) {
      current = null
      continue
    }
    if (current === null || !lines[i].startsWith('$ ')) continue
    const command = lines[i].slice(2)
    const start = i + 1
    const out: string[] = []
    i++
    while (i < lines.length && !/^\[exit \d+\]$/.test(lines[i])) {
      out.push(lines[i])
      i++
    }
    current.push({ command, output: out.join('\n'), exitCode: Number(/\d+/.exec(lines[i] ?? '')?.[0] ?? -1), line: start, file })
  }
}

const blocks = new Map<string, ProtocolEntry[]>()
readBlocks(section8Runs, 'section8-git-runs.txt', blocks)
readBlocks(appendixRuns, 'appendix-g18e-git-runs.txt', blocks)
readBlocks(stashRuns, 'appendix-g18e2-git-runs.txt', blocks)

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
 * без диффстата и `create mode` после первой строки `git commit`, без маркера
 * `\ No newline at end of file` и с одинаковыми хэшами блобов в строках `index`.
 */
export function normalizeGitOutput(command: string, output: string): string {
  let lines = output.split('\n')
  if (command.startsWith('git commit') && lines[0]?.startsWith('[')) lines = [lines[0]]
  lines = lines
    .filter((l) => !/^(Author|Tagger): /.test(l) && !/^Date: {3}/.test(l) && l !== '\\ No newline at end of file')
    .map((l) => l.replace(/^index [0-9a-f]{7}\.\.[0-9a-f]{7}/, 'index <blob>..<blob>'))
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
}

/** Проигрывает блок протокола на движке и сверяет вывод и код возврата каждой команды git. */
export function replayBlock(block: string, options: ReplayOptions = {}): Replay {
  let state = options.from ?? createAppendixSection()
  const ids: IdMap = new Map()
  const steps: ReplayStep[] = []
  const entries = protocolBlock(block)
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
    const command = translateCommand(entry.command, ids, Object.keys(state.commits))
    const run = runAppendixCommand(state, command)
    state = run.state
    const result = run.result as CommandResult
    let mismatch: string | null = null
    if (options.refused?.(entry, index)) {
      if (!isScopeRefusal(result)) mismatch = `ожидался отказ области, получено: ${result.output}`
    } else if (result.exitCode !== entry.exitCode) {
      mismatch = `код возврата ${result.exitCode}, в протоколе ${entry.exitCode}`
    } else {
      mismatch = compareOutputs(normalizeGitOutput(entry.command, entry.output), normalizeGitOutput(entry.command, result.output), ids)
    }
    steps.push({ entry, fileOperation: false, result, mismatch })
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
