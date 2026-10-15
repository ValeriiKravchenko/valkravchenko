// Публичная точка входа раздела 7 (поток g18a): запись .gitignore, чтение модели, перезапуск.
import { describe, expect, it } from 'vitest'
import {
  createPracticesSection,
  getGitignoreText,
  getIgnoreRules,
  getIgnoreVerdict,
  getWorkingFiles,
  isTracked,
  resetPracticesSection,
  runPracticesCommand,
  writeGitignore,
  DEFAULT_GITIGNORE,
  PRACTICES_FILES,
} from './practicesSection'

describe('writeGitignore', () => {
  it('правка действует сразу, без коммита: следующая команда видит новые правила', () => {
    const s = writeGitignore(createPracticesSection(), '*.log\n')
    expect(runPracticesCommand(s, 'git check-ignore -v --non-matching .env').result?.output).toBe('::\t.env')
    expect(getGitignoreText(s)).toBe('*.log\n')
  })

  it('тот же текст — то же состояние, истории не прибавляется; новый текст — заметка', () => {
    const s = createPracticesSection()
    expect(writeGitignore(s, DEFAULT_GITIGNORE)).toBe(s)
    const edited = writeGitignore(s, 'x\n')
    expect(edited.history).toHaveLength(1)
    expect(edited.history[0].kind).toBe('note')
  })

  it('любой текст допустим: пустой файл, непарная [, одни комментарии; ничего не бросает', () => {
    for (const text of ['', '[', '[[[\n]]]', '# ничего\n', '\\', '***', '!', '/'] as const) {
      const s = writeGitignore(createPracticesSection(), text)
      expect(() => runPracticesCommand(s, 'git status --short --ignored -uall')).not.toThrow()
    }
  })

  it('остальные файлы, индекс и конфиги не затрагиваются', () => {
    const s = createPracticesSection()
    const edited = writeGitignore(s, 'x\n')
    expect(edited.index).toEqual({})
    expect({ ...edited.working, '.gitignore': '' }).toEqual({ ...s.working, '.gitignore': '' })
    expect(edited.globalConfig).toEqual([])
    expect(edited.localConfig).toEqual([])
  })

  it('исходное состояние не мутируется', () => {
    const s = createPracticesSection()
    const snapshot = JSON.stringify(s)
    writeGitignore(s, 'x\n')
    runPracticesCommand(s, 'git add -f debug.log')
    expect(JSON.stringify(s)).toBe(snapshot)
  })
})

describe('чтение модели', () => {
  it('getWorkingFiles: 15 путей в порядке байтов, с каталогами', () => {
    const files = getWorkingFiles(createPracticesSection())
    expect(files).toHaveLength(15)
    expect(files.slice(0, 4)).toEqual(['.env', '.env.example', '.gitignore', 'README.md'])
    expect(files).toContain('packages/ui/node_modules/x.js')
    expect(new Set(files)).toEqual(new Set([...PRACTICES_FILES, '.gitignore']))
  })

  it('getIgnoreVerdict и getIgnoreRules отражают текущий .gitignore (для миссий 1–3)', () => {
    const s = writeGitignore(createPracticesSection(), '.env*\n!.env.example\n')
    expect(getIgnoreRules(s)).toHaveLength(2)
    expect(getIgnoreVerdict(s, '.env').ignored).toBe(true)
    expect(getIgnoreVerdict(s, '.env.example').ignored).toBe(false)
  })

  it('isTracked: файл в индексе после git add -f, остальные нет', () => {
    const s = runPracticesCommand(createPracticesSection(), 'git add -f debug.log').state
    expect(isTracked(s, 'debug.log')).toBe(true)
    expect(isTracked(s, 'app.js')).toBe(false)
  })

  it('resetPracticesSection возвращает исходное состояние', () => {
    expect(resetPracticesSection()).toEqual(createPracticesSection())
  })
})
