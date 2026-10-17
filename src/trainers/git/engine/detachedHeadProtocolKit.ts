// ============================================================
// Помощники тестов detachedHead.test.ts. Читают протоколы прогонов настоящего git 2.53.0
// (docs/git-trainer/reports/detached-head-git-runs.txt, блоки О1–О31, и section8-git-runs.txt,
// блоки П8.*) и выдают команды блока с выводом и кодом возврата, чтобы тесты сверяли вывод
// побайтно. В приложение не импортируется.
// ============================================================
import detachedRuns from '../../../../docs/git-trainer/reports/detached-head-git-runs.txt?raw'
import section8Runs from '../../../../docs/git-trainer/reports/section8-git-runs.txt?raw'

export interface DetachedProtocolEntry {
  command: string
  /** Вывод между командой и `[exit N]`, строки через `\n`, без завершающего перевода строки. */
  output: string
  exitCode: number
  /** Номер строки команды в файле протокола (с 1). */
  line: number
  file: 'detached-head-git-runs.txt' | 'section8-git-runs.txt'
}

/** Блоки `===== О<N>.` и `===== П8.<N>.` → команды `$ …` с выводом до `[exit N]`. */
function readBlocks(text: string, file: DetachedProtocolEntry['file'], into: Map<string, DetachedProtocolEntry[]>): void {
  const lines = text.split('\n')
  let current: DetachedProtocolEntry[] | null = null
  for (let i = 0; i < lines.length; i++) {
    const header = /^===== (О\d+|П8\.\d+)\./.exec(lines[i])
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

const blocks = new Map<string, DetachedProtocolEntry[]>()
readBlocks(detachedRuns, 'detached-head-git-runs.txt', blocks)
readBlocks(section8Runs, 'section8-git-runs.txt', blocks)

/** Команда блока (`О3`, `П8.19`) по точному тексту (n-е вхождение, с нуля). */
export function entry(block: string, command: string, nth = 0): DetachedProtocolEntry {
  const list = blocks.get(block)
  if (!list) throw new Error(`в протоколе нет блока ${block}`)
  const found = list.filter((e) => e.command === command)[nth]
  if (!found) throw new Error(`в блоке ${block} нет команды «${command}» (${nth})`)
  return found
}

const fullIds = [...new Set([...detachedRuns.matchAll(/\b[0-9a-f]{40}\b/g), ...section8Runs.matchAll(/\b[0-9a-f]{40}\b/g)].map((m) => m[0]))]

/**
 * Полный id коммита по первым 7 знакам. Если настоящий 40-значный хэш есть в протоколе (в
 * reflog, в `Note:` у `checkout -`), берётся он. Иначе протокол показывает только 7 знаков, и
 * хвост добирается нулями: модель его не печатает, в выводе участвуют первые 7.
 */
export function fullId(id7: string): string {
  return fullIds.find((id) => id.startsWith(id7)) ?? id7.padEnd(40, '0')
}

/** Строка reflog без префикса `<id7> (подпись) HEAD@{n}: ` → текст записи. */
export function reflogMessage(line: string): string {
  const at = line.indexOf('}: ')
  if (at < 0) throw new Error(`не строка reflog: ${line}`)
  return line.slice(at + 3)
}
