// ============================================================
// Раздел 7: сверка движка с протоколом прогонов настоящего git 2.53.0
// (docs/git-trainer/reports/section7-git-runs.txt). Файл протокола читается как есть, блоки
// разбираются по заголовкам `=====`, поэтому вывод сверяется побайтно: порядок строк, табуляции,
// коды возврата. В названии каждого теста стоит номер П7 и строка протокола.
//
// Блоки П7.1–П7.20: набор правил → `git check-ignore -v --non-matching $FILES` и
// `git status --short --ignored -uall`. Блоки П7.27–П7.45 — те же наборы правил (П7.2–П7.20)
// → `git status`, `git status -s`, `git status --short --ignored` без -uall.
// ============================================================
import { describe, expect, it } from 'vitest'
import protocol from '../../../../docs/git-trainer/reports/section7-git-runs.txt?raw'
import { createPracticesSection, runPracticesCommand, writeGitignore, PRACTICES_FILES } from './practicesSection'
import type { PracticesState } from './practicesSection'

interface ProtocolCommand {
  command: string
  output: string
  exitCode: number
  /** Номер строки команды в файле протокола (с 1). */
  line: number
}

interface ProtocolBlock {
  id: number
  title: string
  /** Номер строки заголовка `=====` (с 1). */
  line: number
  /** Содержимое `.gitignore` из блока; `null`, если блока `--- .gitignore:` нет. */
  gitignore: string | null
  commands: ProtocolCommand[]
}

/** Разбор протокола: блоки `===== П7.N. …`, `--- .gitignore:` с маркерами `$` конца строки, команды `$ …` с выводом до `[exit N]`. */
function parseProtocol(text: string): ProtocolBlock[] {
  const lines = text.split('\n')
  const blocks: ProtocolBlock[] = []
  let current: ProtocolBlock | null = null
  for (let i = 0; i < lines.length; i++) {
    const header = /^===== П7\.(\d+)\. (.*)$/.exec(lines[i])
    if (header) {
      current = { id: Number(header[1]), title: header[2], line: i + 1, gitignore: null, commands: [] }
      blocks.push(current)
      continue
    }
    if (lines[i].startsWith('=====')) {
      current = null
      continue
    }
    if (current === null) continue
    if (lines[i] === '--- .gitignore:') {
      const body: string[] = []
      i++
      while (lines[i] !== '---') {
        // cat -A: каждая строка файла оканчивается маркером `$`
        expect(lines[i].endsWith('$')).toBe(true)
        body.push(lines[i].slice(0, -1))
        i++
      }
      current.gitignore = body.map((l) => `${l}\n`).join('')
      continue
    }
    if (lines[i].startsWith('$ ')) {
      const command = lines[i].slice(2)
      const start = i + 1
      const out: string[] = []
      i++
      let exitCode = -1
      while (i < lines.length) {
        const m = /^\[exit (\d+)\]$/.exec(lines[i])
        if (m) {
          exitCode = Number(m[1])
          break
        }
        out.push(lines[i])
        i++
      }
      current.commands.push({ command, output: out.join('\n'), exitCode, line: start })
    }
  }
  return blocks
}

const blocks = parseProtocol(protocol)
const byId = (id: number) => {
  const block = blocks.find((b) => b.id === id)
  if (!block) throw new Error(`в протоколе нет блока П7.${id}`)
  return block
}

function stateFor(block: ProtocolBlock): PracticesState {
  const fresh = createPracticesSection()
  return block.gitignore === null ? fresh : writeGitignore(fresh, block.gitignore)
}

/** Прогоняет команды блока по порядку на одном состоянии и сверяет вывод и код возврата. */
function replay(block: ProtocolBlock): void {
  let state = stateFor(block)
  for (const entry of block.commands) {
    const command = entry.command.replace('$FILES', PRACTICES_FILES.join(' '))
    const run = runPracticesCommand(state, command)
    state = run.state
    expect(run.result, `${block.title}: ${command}`).not.toBeNull()
    expect(run.result?.output, `П7.${block.id}, строка ${entry.line}: ${entry.command}`).toBe(entry.output)
    expect(run.result?.exitCode, `П7.${block.id}, строка ${entry.line}: код возврата`).toBe(entry.exitCode)
    expect(run.result?.ok).toBe(entry.exitCode === 0)
  }
}

describe('разбор протокола', () => {
  it('в протоколе есть все нужные блоки П7.1–П7.22 и П7.27–П7.45', () => {
    for (const id of [...Array(22).keys()].map((i) => i + 1)) expect(blocks.some((b) => b.id === id), `П7.${id}`).toBe(true)
    for (let id = 27; id <= 45; id++) expect(blocks.some((b) => b.id === id), `П7.${id}`).toBe(true)
  })

  it('порядок 14 файлов совпадает с $FILES протокола: так печатает check-ignore (П7.1, строки 19–32)', () => {
    const first = byId(1).commands[0]
    const paths = first.output.split('\n').map((l) => l.slice(l.indexOf('\t') + 1))
    expect(paths).toEqual([...PRACTICES_FILES])
    expect(PRACTICES_FILES).toHaveLength(14)
  })

  it('каждый блок П7.1–П7.20 содержит check-ignore и status -uall, а П7.27–П7.45 — три формы status', () => {
    for (let id = 1; id <= 20; id++) expect(byId(id).commands.map((c) => c.command)).toEqual(['git check-ignore -v --non-matching $FILES', 'git status --short --ignored -uall'])
    for (let id = 27; id <= 45; id++) expect(byId(id).commands.map((c) => c.command)).toEqual(['git status', 'git status -s', 'git status --short --ignored'])
  })
})

describe('П7.1–П7.20: check-ignore -v --non-matching и status --short --ignored -uall, побайтно', () => {
  for (let id = 1; id <= 20; id++) {
    const block = byId(id)
    it(`П7.${id} ${block.title} (section7-git-runs.txt:${block.line})`, () => {
      replay(block)
    })
  }
})

describe('П7.27–П7.45: status, status -s, status --short --ignored без -uall, побайтно', () => {
  for (let id = 27; id <= 45; id++) {
    const block = byId(id)
    it(`П7.${id} ${block.title} (section7-git-runs.txt:${block.line})`, () => {
      replay(block)
    })
  }
})

describe('П7.21: status без -uall на правилах по умолчанию', () => {
  it(`git status и git status --short --ignored (section7-git-runs.txt:${byId(21).line})`, () => {
    replay(byId(21))
  })
})

describe('П7.22: git add игнорируемого файла и git add -f', () => {
  const block = byId(22)
  const [addFile, addDir, addForce] = block.commands

  it(`git add debug.log: отказ с hint, код 1 (section7-git-runs.txt:${addFile.line})`, () => {
    const run = runPracticesCommand(createPracticesSection(), 'git add debug.log')
    expect(run.result?.output).toBe(addFile.output)
    expect(run.result?.exitCode).toBe(addFile.exitCode)
    expect(run.result?.ok).toBe(false)
    // отказ не меняет индекс
    expect(run.state.index).toEqual({})
  })

  it(`git add build/bundle.js: вторая строка отказа называет каталог build, код 1 (section7-git-runs.txt:${addDir.line})`, () => {
    const run = runPracticesCommand(createPracticesSection(), 'git add build/bundle.js')
    expect(run.result?.output).toBe(addDir.output)
    expect(run.result?.exitCode).toBe(addDir.exitCode)
  })

  it(`git add -f debug.log молчит, затем git status --short debug.log печатает «A  debug.log» (section7-git-runs.txt:${addForce.line})`, () => {
    expect(addForce.command).toBe('git add -f debug.log && git status --short debug.log')
    const forced = runPracticesCommand(createPracticesSection(), 'git add -f debug.log')
    expect(forced.result?.output).toBe('')
    expect(forced.result?.exitCode).toBe(0)
    const status = runPracticesCommand(forced.state, 'git status --short debug.log')
    expect(status.result?.output).toBe(addForce.output)
    expect(status.result?.exitCode).toBe(addForce.exitCode)
  })
})

describe('П7.23: git check-ignore без пути', () => {
  it('fatal: no path specified, код 128 (section7-git-runs.txt:904–906)', () => {
    const entry = byId(23).commands.find((c) => c.command === 'git check-ignore')
    expect(entry?.output).toBe('fatal: no path specified')
    const run = runPracticesCommand(createPracticesSection(), 'git check-ignore')
    expect(run.result?.output).toBe(entry?.output)
    expect(run.result?.exitCode).toBe(entry?.exitCode)
    expect(run.result?.ok).toBe(false)
  })
})

describe('П7.25: git st без алиаса', () => {
  it('«is not a git command», первая строка, код 1 (section7-git-runs.txt:968–976)', () => {
    const entry = byId(25).commands[0]
    expect(entry.command).toBe('git st')
    expect(entry.exitCode).toBe(1)
    const run = runPracticesCommand(createPracticesSection(), 'git st')
    // список похожих команд не печатается (target.md, место 20): остаётся первая строка протокола
    expect(run.result?.output).toBe(entry.output.split('\n')[0])
    expect(run.result?.exitCode).toBe(1)
  })
})
