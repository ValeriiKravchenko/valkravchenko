// Общий модуль новых разделов: форматирование git status без коммитов. Построчная сверка с
// прогонами — practicesProtocol.test.ts; здесь свёртка каталогов по таблице части IX, места 10,
// и границы воспроизведения.
import { describe, expect, it } from 'vitest'
import { formatStatusNoCommits, type StatusEntry } from './sectionsCommon'

const e = (path: string, kind: StatusEntry['kind']): StatusEntry => ({ path, kind })
const short = { short: true, ignored: true, uall: false }

function out(entries: StatusEntry[], options = short): string {
  const r = formatStatusNoCommits('master', entries, options)
  if (!r.ok) throw new Error(r.reason)
  return r.output
}

describe('свёртка каталога без -uall (target.md, часть IX, место 10)', () => {
  it('ни одного игнорируемого файла: «?? dir/» в обоих режимах (П7.31: build/ при *.log)', () => {
    const entries = [e('build/a', 'untracked'), e('build/b', 'untracked')]
    expect(out(entries)).toBe('?? build/')
    expect(out(entries, { short: true, ignored: false, uall: false })).toBe('?? build/')
  })

  it('все файлы игнорируются: «!! dir/» только с --ignored, без него каталога нет (П7.31: logs/, П7.35: src/)', () => {
    const entries = [e('app.js', 'untracked'), e('logs/error.log', 'ignored')]
    expect(out(entries)).toBe('?? app.js\n!! logs/')
    expect(out(entries, { short: true, ignored: false, uall: false })).toBe('?? app.js')
  })

  it('вместе: «?? dir/» и каждый игнорируемый файл отдельной строкой после всех «??» (П7.34, строки 1877–1893)', () => {
    const entries = [e('app.js', 'untracked'), e('build/bundle.js', 'ignored'), e('build/output.map', 'untracked'), e('debug.log', 'untracked')]
    expect(out(entries)).toBe('?? app.js\n?? build/\n?? debug.log\n!! build/bundle.js')
  })

  it('-uall печатает полные пути: сначала все «??», потом «!!», внутри — по байтам (П7.1)', () => {
    const entries = [e('app.js', 'untracked'), e('.gitignore', 'untracked'), e('README.md', 'untracked'), e('.env', 'ignored'), e('build/x', 'ignored')]
    expect(out(entries, { short: true, ignored: true, uall: true })).toBe('?? .gitignore\n?? README.md\n?? app.js\n!! .env\n!! build/x')
  })
})

describe('границы воспроизведения: форма, которой нет в прогонах, вывода не получает', () => {
  const entries = [e('app.js', 'untracked')]

  it('сочетания ключей, которых нет в протоколе', () => {
    for (const options of [
      { short: false, ignored: true, uall: false },
      { short: false, ignored: false, uall: true },
      { short: true, ignored: false, uall: true },
      { short: false, ignored: true, uall: true },
    ]) {
      expect(formatStatusNoCommits('master', entries, options)).toEqual({ ok: false, reason: 'unverifiedCombo' })
    }
  })

  it('нет ни одного неотслеживаемого файла', () => {
    expect(formatStatusNoCommits('master', [e('a', 'ignored')], short)).toEqual({ ok: false, reason: 'noUntracked' })
    expect(formatStatusNoCommits('master', [], short)).toEqual({ ok: false, reason: 'noUntracked' })
  })

  it('смешанный каталог с вложенностью глубже одного уровня', () => {
    const nested = [e('a/b/c', 'ignored'), e('a/d', 'untracked')]
    expect(formatStatusNoCommits('master', nested, short)).toEqual({ ok: false, reason: 'unsupportedLayout' })
    // с -uall каталоги не сворачиваются
    expect(formatStatusNoCommits('master', nested, { short: true, ignored: true, uall: true }).ok).toBe(true)
  })

  it('П7.21 (section7-git-runs.txt:811–825): длинный формат — дословный текст, табуляция перед именем', () => {
    const r = formatStatusNoCommits('master', [e('.gitignore', 'untracked'), e('src/build.js', 'untracked')], { short: false, ignored: false, uall: false })
    expect(r).toEqual({
      ok: true,
      output:
        'On branch master\n\nNo commits yet\n\nUntracked files:\n  (use "git add <file>..." to include in what will be committed)\n\t.gitignore\n\tsrc/\n\nnothing added to commit but untracked files present (use "git add" to track)',
    })
  })
})
