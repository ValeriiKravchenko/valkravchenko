// Общий модуль новых разделов: форматирование git status без коммитов. Построчная сверка с
// прогонами — practicesProtocol.test.ts; здесь свёртка каталогов по таблице части IX, места 10,
// и границы воспроизведения.
import { describe, expect, it } from 'vitest'
import { checkSafety, formatStatusNoCommits, fullCommitId, shortCommitId, type StatusEntry } from './sectionsCommon'

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

describe('id коммита из 40 знаков (решение В2)', () => {
  const tree = { 'app.js': 'a', 'README.md': 'b' }

  it('длина 40, только [0-9a-f]', () => {
    for (const message of ['', 'first', 'Базовая версия приложения']) {
      expect(fullCommitId(message, tree, [], 1)).toMatch(/^[0-9a-f]{40}$/)
    }
  })

  it('детерминирован: одинаковый вход даёт одинаковый id, порядок ключей дерева не важен', () => {
    expect(fullCommitId('m', tree, ['p'], 3)).toBe(fullCommitId('m', tree, ['p'], 3))
    expect(fullCommitId('m', { 'README.md': 'b', 'app.js': 'a' }, ['p'], 3)).toBe(fullCommitId('m', tree, ['p'], 3))
  })

  it('разные сообщение, дерево, родители и часы дают разные id', () => {
    const base = fullCommitId('m', tree, ['p'], 3)
    const others = [
      fullCommitId('n', tree, ['p'], 3),
      fullCommitId('m', { ...tree, 'app.js': 'c' }, ['p'], 3),
      fullCommitId('m', { ...tree, extra: '' }, ['p'], 3),
      fullCommitId('m', tree, ['q'], 3),
      fullCommitId('m', tree, ['p', 'q'], 3),
      fullCommitId('m', tree, [], 3),
      fullCommitId('m', tree, ['p'], 4),
    ]
    expect(new Set([base, ...others]).size).toBe(others.length + 1)
  })

  it('короткая форма равна первым 7 знакам полного id', () => {
    const id = fullCommitId('m', tree, [], 1)
    expect(shortCommitId(id)).toBe(id.slice(0, 7))
    expect(shortCommitId(id)).toHaveLength(7)
    expect(shortCommitId('8d359c14b555c2faceb0015231196418ee81a89d')).toBe('8d359c1')
  })
})

describe('checkSafety: переход не должен затереть несохранённые правки', () => {
  it('чистое дерево — переход проходит', () => {
    const head = { 'a.txt': '1' }
    expect(checkSafety(head, head, head, { 'a.txt': '2' })).toEqual({ modified: [], untracked: [] })
  })

  it('незастейдженная правка файла, который цель тоже меняет, блокирует', () => {
    const head = { 'a.txt': '1' }
    expect(checkSafety(head, head, { 'a.txt': 'моя правка' }, { 'a.txt': '2' }).modified).toEqual(['a.txt'])
  })

  it('правка файла, у которого цель совпадает с HEAD, не блокирует', () => {
    const head = { 'a.txt': '1', 'b.txt': '1' }
    expect(checkSafety(head, head, { ...head, 'a.txt': 'правка' }, { 'a.txt': '1', 'b.txt': '2' })).toEqual({ modified: [], untracked: [] })
  })

  it('неотслеживаемый файл переживает переход, если у цели нет файла с тем же именем', () => {
    const head = { 'a.txt': '1' }
    expect(checkSafety(head, head, { ...head, 'notes.txt': 'заметки' }, { 'a.txt': '2' })).toEqual({ modified: [], untracked: [] })
  })

  it('неотслеживаемый файл блокирует, если цель кладёт на его место свой', () => {
    const head = { 'a.txt': '1' }
    expect(checkSafety(head, head, { ...head, 'new.txt': 'мой' }, { 'a.txt': '1', 'new.txt': 'чужой' })).toEqual({ modified: [], untracked: ['new.txt'] })
  })

  it('застейдженная правка, равная цели, не блокирует даже с незастейдженной поверх', () => {
    const head = { 'a.txt': '1' }
    expect(checkSafety(head, { 'a.txt': '2' }, { 'a.txt': 'ещё правка' }, { 'a.txt': '2' })).toEqual({ modified: [], untracked: [] })
  })

  it('застейдженная правка, не равная цели, блокирует', () => {
    const head = { 'a.txt': '1' }
    expect(checkSafety(head, { 'a.txt': '5' }, { 'a.txt': '5' }, { 'a.txt': '2' }).modified).toEqual(['a.txt'])
  })

  it('незастейдженная правка, случайно равная цели, всё равно блокирует (индекс не менялся)', () => {
    const head = { 'a.txt': '1' }
    expect(checkSafety(head, head, { 'a.txt': '2' }, { 'a.txt': '2' }).modified).toEqual(['a.txt'])
  })

  it('файл удалён из рабочего дерева напрямую (rm без git rm) — отказа нет', () => {
    const head = { 'a.txt': '1' }
    expect(checkSafety(head, head, {}, { 'a.txt': '2' })).toEqual({ modified: [], untracked: [] })
  })

  it('удаление застейджено (git rm) — отказ остаётся', () => {
    const head = { 'a.txt': '1' }
    expect(checkSafety(head, {}, {}, { 'a.txt': '2' }).modified).toEqual(['a.txt'])
  })

  it('результат отсортирован по имени', () => {
    const head = { 'b.txt': '1', 'a.txt': '1' }
    const working = { 'b.txt': 'x', 'a.txt': 'x' }
    expect(checkSafety(head, head, working, { 'b.txt': '2', 'a.txt': '2' }).modified).toEqual(['a.txt', 'b.txt'])
  })

  // Прогоны О7, О16, О24 (docs/git-trainer/reports/detached-head-git-runs.txt): seed раздела 8,
  // base ← fix (feature~1, app.js изменён); base ← README (master). С ветки на коммит и обратно.
  const base = { 'app.js': 'console.log(0)\n' }
  const fixed = { 'app.js': 'console.log(1)\n' }
  const master = { ...base, 'README.md': '# demo\n' }

  it('О7: правка README.md на master, цель master~1 без README.md — отказ, перечислен README.md', () => {
    expect(checkSafety(master, master, { ...master, 'README.md': '# demo\ndirty\n' }, base).modified).toEqual(['README.md'])
  })

  it('О7: правка app.js на master, цель feature~1 меняет app.js — отказ', () => {
    expect(checkSafety(master, master, { ...master, 'app.js': 'dirty\n' }, { ...fixed }).modified).toEqual(['app.js'])
  })

  it('О16, О24: правка app.js, цель master~1 с тем же app.js — отказа нет, правка переезжает', () => {
    expect(checkSafety(master, master, { ...master, 'app.js': 'x\n' }, base)).toEqual({ modified: [], untracked: [] })
  })

  it('О16, О24: с коммита feature~1 на master правка app.js затёрлась бы — отказ', () => {
    expect(checkSafety(fixed, fixed, { 'app.js': 'x\n' }, master).modified).toEqual(['app.js'])
  })

  it('правка файла, который цель не меняет, не мешает', () => {
    expect(checkSafety(master, master, { ...master, 'README.md': 'x\n' }, master)).toEqual({ modified: [], untracked: [] })
  })
})
