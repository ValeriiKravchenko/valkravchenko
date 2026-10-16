// Раздел 7, g18b2: `git log` без коммитов (П7.26, section7-git-runs.txt:1367–1385) и форматирование
// линейной истории `--oneline [--graph]` (П7.24, П7.25, П8.13).
import { describe, expect, it } from 'vitest'
import { fresh, protocolEntry, run } from './practicesProtocolKit'
import { formatLogOneline } from './practicesSection'
import type { LogLine } from './practicesSection'
import protocol8 from '../../../../docs/git-trainer/reports/section8-git-runs.txt?raw'

const MARK = '[тренажёр]'

describe('П7.26: git log в репозитории без коммитов', () => {
  for (const command of ['git log --oneline', 'git log --oneline --graph', 'git log']) {
    it(`${command}: fatal, код 128 (section7-git-runs.txt:${protocolEntry(26, command).line})`, () => {
      const e = protocolEntry(26, command)
      const r = run(fresh(), command)
      expect(r.result.output).toBe(e.output)
      expect(r.result.exitCode).toBe(128)
      expect(r.result.ok).toBe(false)
      expect(r.state.history).toHaveLength(1)
    })
  }

  it('ключи --graph --oneline в другом порядке дают тот же ответ', () => {
    expect(run(fresh(), 'git log --graph --oneline').result.exitCode).toBe(128)
  })

  it('формы без прогона — отказ области: --graph без --oneline, -1, пути, повтор ключа, --all', () => {
    for (const line of ['git log --graph', 'git log -1', 'git log app.js', 'git log --oneline --oneline', 'git log --oneline --all', 'git log --format=%s', 'git log -- app.js']) {
      const r = run(fresh(), line)
      expect(r.result.output.startsWith(MARK), line).toBe(true)
      expect(r.result.exitCode, line).toBeUndefined()
    }
  })

  it('состояние не меняется, кроме истории', () => {
    const s = fresh()
    const r = run(s, 'git log --oneline')
    expect({ ...r.state, history: [] }).toEqual({ ...s, history: [] })
  })
})

describe('formatLogOneline: линейная история', () => {
  // П7.24, последний git log --oneline (section7-git-runs.txt:957–965): вне терминала подписей нет.
  const entry = protocolEntry(24, 'git log --oneline')
  const lines: LogLine[] = entry.output.split('\n').map((l) => ({ id: l.slice(0, 7), subject: l.slice(8) }))

  it('без подписей и без графа — как в П7.24 (7 коммитов, заголовок из 80 букв целиком)', () => {
    expect(lines).toHaveLength(7)
    expect(formatLogOneline(lines, { branch: 'master', graph: false, decorate: false })).toBe(entry.output)
  })

  it('с графом — звёздочка и пробел перед строкой (П7.25, section7-git-runs.txt:1019)', () => {
    const e = protocolEntry(25, 'git lg')
    expect(formatLogOneline([{ id: '135f928', subject: 'Первый коммит' }], { branch: 'master', graph: true, decorate: false })).toBe(e.output)
  })

  it('на терминале у верхушки подпись (HEAD -> master), как в П8.13 (section8-git-runs.txt:1518–1521)', () => {
    const idx = protocol8.split('\n').indexOf('$ git -c log.decorate=short log --oneline')
    expect(idx).toBeGreaterThan(0)
    expect(protocol8.split('\n')[idx + 1]).toBe('87eb4d3 (HEAD -> master, tag: v1.0.0) Добавить README')
    // без тега, который в разделе 7 не бывает: та же форма подписи
    const out = formatLogOneline([{ id: '87eb4d3', subject: 'Добавить README' }, { id: '4eefa08', subject: 'Базовая версия приложения' }], { branch: 'master', graph: false, decorate: true })
    expect(out).toBe('87eb4d3 (HEAD -> master) Добавить README\n4eefa08 Базовая версия приложения')
  })

  it('граф с подписью — как в section8-git-runs.txt:911 («* fbaf825 (HEAD -> master) …»)', () => {
    expect(protocol8.split('\n')).toContain('* fbaf825 (HEAD -> master) fix: опечатка в логе')
    expect(formatLogOneline([{ id: 'fbaf825', subject: 'fix: опечатка в логе' }], { branch: 'master', graph: true, decorate: true })).toBe('* fbaf825 (HEAD -> master) fix: опечатка в логе')
  })

  it('пустая история — пустая строка', () => {
    expect(formatLogOneline([], { branch: 'master', graph: true, decorate: true })).toBe('')
  })
})
