// ============================================================
// Раздел 7: помощники тестов g18b2. Читают протокол прогонов настоящего git 2.53.0
// (docs/git-trainer/reports/section7-git-runs.txt) и выдают команды блока с выводом и кодом
// возврата, чтобы тесты сверяли вывод побайтно и называли строку протокола. В приложение не
// импортируется.
// ============================================================
import protocol from '../../../../docs/git-trainer/reports/section7-git-runs.txt?raw'
import configFixes from '../../../../docs/git-trainer/reports/section7-config-alias-fixes-git-runs.txt?raw'
import { createPracticesSection, runPracticesCommand } from './practicesSection'
import type { CommandResult, PracticesState } from './practicesSection'

export interface ProtocolEntry {
  command: string
  output: string
  exitCode: number
  /** Номер строки команды в файле протокола (с 1). */
  line: number
}

/** Блоки `===== П7.N.` → команды `$ …` с выводом до `[exit N]`. Строки `--- .gitignore:` пропускаются. */
function readBlocks(text: string, blankIsNewline = false): Map<number, ProtocolEntry[]> {
  const lines = text.split('\n')
  const blocks = new Map<number, ProtocolEntry[]>()
  let current: ProtocolEntry[] | null = null
  for (let i = 0; i < lines.length; i++) {
    const header = /^===== П7\.(\d+)\./.exec(lines[i])
    if (header) {
      current = []
      blocks.set(Number(header[1]), current)
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
    // В файле g18b3 одна пустая строка между командой и [exit] это вывод «\n» (git печатает пустую строку), а не отсутствие вывода.
    const output = blankIsNewline && out.length === 1 && out[0] === '' ? '\n' : out.join('\n')
    current.push({ command, output, exitCode: Number(/\d+/.exec(lines[i] ?? '')?.[0] ?? -1), line: start })
  }
  return blocks
}

const blocks = readBlocks(protocol)
const fixBlocks = readBlocks(configFixes, true)

/** Команды блока П7.<id> в порядке протокола. */
export function protocolBlock(id: number): ProtocolEntry[] {
  const block = blocks.get(id)
  if (!block) throw new Error(`в протоколе нет блока П7.${id}`)
  return block
}

/** Команда протокола по точному тексту (n-е вхождение, с нуля). */
export function protocolEntry(id: number, command: string, nth = 0): ProtocolEntry {
  const found = protocolBlock(id).filter((e) => e.command === command)[nth]
  if (!found) throw new Error(`в блоке П7.${id} нет команды «${command}» (${nth})`)
  return found
}

/** Команды блока П7.<id> файла section7-config-alias-fixes-git-runs.txt (g18b3, П7.60 и далее). */
export function fixBlock(id: number): ProtocolEntry[] {
  const block = fixBlocks.get(id)
  if (!block) throw new Error(`в файле прогонов g18b3 нет блока П7.${id}`)
  return block
}

/** Команда блока g18b3 по точному тексту (n-е вхождение, с нуля). */
export function fixEntry(id: number, command: string, nth = 0): ProtocolEntry {
  const found = fixBlock(id).filter((e) => e.command === command)[nth]
  if (!found) throw new Error(`в блоке П7.${id} (g18b3) нет команды «${command}» (${nth})`)
  return found
}

/** Выполняет строку терминала; пустая строка здесь ошибка теста. */
export function run(state: PracticesState, line: string): { state: PracticesState; result: CommandResult } {
  const r = runPracticesCommand(state, line)
  if (r.result === null) throw new Error('пустая строка')
  return { state: r.state, result: r.result }
}

/** Выполняет несколько строк подряд на одном состоянии. */
export function runAll(state: PracticesState, lines: readonly string[]): PracticesState {
  return lines.reduce((s, l) => run(s, l).state, state)
}

export const fresh = (): PracticesState => createPracticesSection()
