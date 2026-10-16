// Раздел 7, g18b2: `git commit -m` и разбор сообщения по П7.24 (section7-git-runs.txt:908–965).
import { describe, expect, it } from 'vitest'
import { fresh, protocolBlock, protocolEntry, run, runAll } from './practicesProtocolKit'
import { parseCommitMessage } from './practicesSection'

const MARK = '[тренажёр]'
const staged = () => runAll(fresh(), ['git add -f debug.log'])

describe('П7.24: пустое сообщение', () => {
  for (const [command, shell] of [['git commit -m ""', 'git commit -m ""'], ['git commit -m "   "', 'git commit -m "   "']] as const) {
    it(`${command} при непустом индексе: Aborting commit due to empty commit message., код 1 (section7-git-runs.txt:${protocolEntry(24, `c; ${shell}`).line})`, () => {
      const e = protocolEntry(24, `c; ${shell}`)
      const r = run(staged(), command)
      expect(r.result.output).toBe(e.output)
      expect(e.output).toBe('Aborting commit due to empty commit message.')
      expect(r.result.exitCode).toBe(e.exitCode)
      expect(r.result.exitCode).toBe(1)
      expect(r.result.ok).toBe(false)
    })
  }

  it('коммит не создаётся: индекс остался, коммитов в состоянии нет', () => {
    const before = staged()
    const r = run(before, 'git commit -m ""')
    expect(r.state.index).toEqual(before.index)
    expect('commits' in r.state).toBe(false)
  })

  it('сообщение из одних переводов строк тоже пустое', () => {
    expect(run(staged(), 'git commit -m "  "').result.exitCode).toBe(1)
  })
})

describe('формы без прогона — отказ области (target.md, место 8, желательное)', () => {
  function refused(line: string, state = staged()) {
    const r = run(state, line)
    expect(r.result.output.startsWith(MARK), line).toBe(true)
    expect(r.result.exitCode, line).toBeUndefined()
    expect(r.result.ok).toBe(false)
    expect(r.state.index).toEqual(state.index)
  }

  it('непустое сообщение: коммиты в разделе не создаются', () => {
    refused('git commit -m "Первый коммит"')
    refused('git commit -m x', fresh())
  })

  it('пустое сообщение при пустом индексе: порядок «нечего коммитить / пустое сообщение» прогонами не сверен', () => {
    refused('git commit -m ""', fresh())
  })

  it('без -m, с -F, --cleanup, -a, -q, несколькими -m, --allow-empty, -m без значения', () => {
    for (const line of ['git commit', 'git commit -F msg', 'git commit --cleanup=strip -m "x"', 'git commit -a -m "x"', 'git commit -q -m "x"', 'git commit -m "a" -m "b"', 'git commit --allow-empty -m ""', 'git commit -m']) {
      refused(line)
    }
  })
})

describe('parseCommitMessage: что git сохраняет (П7.24)', () => {
  it('перевод строки внутри без пустой строки: заголовок — первый абзац, склеен пробелом, тело пустое (section7-git-runs.txt:909–913)', () => {
    const p = parseCommitMessage(['Заголовок\nвторая строка без пустой'])
    expect(p).toEqual({ empty: false, subject: 'Заголовок вторая строка без пустой', body: '' })
    // команда занимает две строки протокола, вывод первой записи блока начинается с её продолжения
    expect(protocolBlock(24)[0].output).toContain('subject=[Заголовок вторая строка без пустой]\nbody=[]')
  })

  it('два -m: каждое — абзац; заголовок первое, тело второе (section7-git-runs.txt:916–921)', () => {
    expect(parseCommitMessage(['Заголовок', 'Тело после пустой строки'])).toEqual({ empty: false, subject: 'Заголовок', body: 'Тело после пустой строки' })
  })

  it('пустая строка внутри одного -m отделяет тело', () => {
    expect(parseCommitMessage(['Заголовок\n\nТело'])).toEqual({ empty: false, subject: 'Заголовок', body: 'Тело' })
  })

  it('ведущие пустые строки отбрасываются (section7-git-runs.txt:923–929)', () => {
    expect(parseCommitMessage(['\n\nИсправить расчёт скидки']).subject).toBe('Исправить расчёт скидки')
  })

  it('хвостовые пробелы отбрасываются (section7-git-runs.txt:931–934)', () => {
    expect(parseCommitMessage(['Заголовок с хвостовыми пробелами   ']).subject).toBe('Заголовок с хвостовыми пробелами')
  })

  it('пустое и пробельное — empty (section7-git-runs.txt:936–942)', () => {
    expect(parseCommitMessage([''])).toEqual({ empty: true, subject: '', body: '' })
    expect(parseCommitMessage(['   '])).toEqual({ empty: true, subject: '', body: '' })
    expect(parseCommitMessage([' \n \n'])).toMatchObject({ empty: true })
    expect(parseCommitMessage([])).toMatchObject({ empty: true })
  })

  it('# — обычный символ, не комментарий (section7-git-runs.txt:944–946)', () => {
    expect(parseCommitMessage(['# не комментарий при -m']).subject).toBe('# не комментарий при -m')
  })

  it('заголовок из 80 букв хранится целиком (section7-git-runs.txt:953–955)', () => {
    const long = 'А'.repeat(80)
    expect(protocolEntry(24, 'c; git commit -q -m "$(printf "%0.sА" $(seq 1 80))" && git log -1 --oneline').output).toContain(long)
    expect(parseCommitMessage([long]).subject).toHaveLength(80)
  })
})
