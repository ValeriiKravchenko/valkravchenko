// Общий модуль конфликтов (target.md, часть XI). Дословные тексты сверяются с docs/git-trainer/reports/conflicts-git-runs.txt
// (блоки К1–К18): ожидаемая строка берётся из протокола, а не набирается руками. Вывод `cat` в протоколе кончается строкой
// `>>>>>>> …` без пустой строки после неё, а в файле после неё перевод строки есть, поэтому к протокольному тексту дописывается `\n`.
// Id в протоколе настоящие: тесты подставляют те, что в тексте протокола, чтобы сверка шла посимвольно.
import { describe, expect, it } from 'vitest'
import { protocolEntry } from './appendixProtocolKit'
import { abortTo, conflictOutput, editorChoice, enterConflict, markResolved, markerBlocks, mergeFileWithMarkers, refusal, shortCode, statusBlock, type ConflictMerge, type ConflictState, type RebaseOperation } from './conflicts'
import { mergeFileContent, mergeTrees } from './branchRepo'
import { ru } from '../locales/ru'

const seed = ru.appendix.seed
const HEAD_LABELS = { top: 'HEAD', bottom: 'conflict-demo' }
const cat = (block: string, command = 'cat app.js') => `${protocolEntry(block, command).output}\n`

function mergeOf(base: Record<string, string>, ours: Record<string, string>, theirs: Record<string, string>): ConflictMerge {
  return { ...mergeTrees(base, ours, theirs), base, ours, theirs }
}
const emptyState = (over: Partial<ConflictState> = {}): ConflictState => ({ index: {}, working: {}, unmerged: {}, operation: null, ...over })

describe('mergeFileWithMarkers: метки в файле (часть XI, «Метки в файле»)', () => {
  it('stash pop: верхняя часть Updated upstream, нижняя Stashed changes, однострочные файлы целиком (К4.1, К17.3)', () => {
    const labels = { top: 'Updated upstream', bottom: 'Stashed changes' }
    const result = mergeFileWithMarkers(seed.appBase, seed.appFixed, 'console.log("v1"); // локальная правка, ещё не готова коммититься\n', labels)
    expect(result).toEqual({ conflict: true, content: cat('К17.3') })
    expect(cat('К4.1')).toBe(cat('К17.3'))
  })

  it('cherry-pick: HEAD вверху, `<id7> (<тема>)` внизу (К5.1, К17.4)', () => {
    const labels = { top: 'HEAD', bottom: 'b3057c2 (fix: опечатка в логе)' }
    const result = mergeFileWithMarkers(seed.appBase, 'console.log("v2");\n', seed.appFixed, labels)
    expect(result).toEqual({ conflict: true, content: cat('К17.4') })
  })

  it('общая первая строка остаётся вне меток (К1.1)', () => {
    const base = 'body { background: white; color: black; }\n/* база */\n'
    const ours = 'body { background: white; color: black; }\n/* правка в текущей ветке: сузили отступы */\n'
    const theirs = 'body { background: white; color: black; }\n/* правка в conflict-demo: увеличили шрифт */\n'
    expect(mergeFileWithMarkers(base, ours, theirs, HEAD_LABELS)).toEqual({ conflict: true, content: cat('К1.1', 'cat style.css') })
  })

  it('add/add: база пуста, общая первая строка вне меток (К3.1)', () => {
    const result = mergeFileWithMarkers('', '## Изменения\n- Моя строка\n', '## Изменения\n- Добавлена лицензия MIT\n', { top: 'HEAD', bottom: 'f4a0abb5149afd7e1462a1f82fab8a8fde9b17bb' })
    expect(result).toEqual({ conflict: true, content: cat('К3.1', 'cat CHANGELOG.md') })
  })

  it('обе стороны дописали по строке после общих трёх: метки только вокруг различающихся строк (К3.3)', () => {
    const base = '## Изменения\n- Добавлена лицензия MIT\n- Моя строка\n'
    const result = mergeFileWithMarkers(base, `${base}- Ещё моя строка\n`, `${base}- Правка коллеги №2\n`, { top: 'HEAD', bottom: 'c86efaf2cf31cdbc126eab2eb796c295aeb8dbee' })
    expect(result).toEqual({ conflict: true, content: cat('К3.3', 'cat CHANGELOG.md') })
  })

  it('без конфликта результат совпадает с mergeFileContent: правки в разных строках и одинаковая правка', () => {
    const base = 'a\nb\nc\nd\n'
    for (const [ours, theirs] of [
      ['A\nb\nc\nd\n', 'a\nb\nc\nD\n'],
      ['a\nX\nc\nd\n', 'a\nX\nc\nd\n'],
      ['a\nb\nc\nd\n', 'a\nb\nc\nZ\n'],
    ] as const) {
      const clean = mergeFileContent(base, ours, theirs)
      expect(clean.conflict).toBe(false)
      expect(mergeFileWithMarkers(base, ours, theirs, HEAD_LABELS)).toEqual({ conflict: false, content: clean.conflict ? '' : clean.content })
    }
  })

  it('правки, которые ни с чем не пересеклись, применяются, а конфликтный блок размечен (блок меток один)', () => {
    const base = 'a\nb\nc\nd\ne\nf\n'
    const ours = 'a\nB\nc\nd\ne\nF\n'
    const theirs = 'a\nX\nc\nD\ne\nf\n'
    expect(mergeFileWithMarkers(base, ours, theirs, HEAD_LABELS)).toEqual({
      conflict: true,
      content: 'a\n<<<<<<< HEAD\nB\n=======\nX\n>>>>>>> conflict-demo\nc\nD\ne\nF\n',
    })
  })

  it('правки соседних строк разными сторонами — один блок: git тоже считает их конфликтом', () => {
    expect(mergeFileWithMarkers('a\nb\nc\nd\ne\n', 'a\nB\nc\nd\nE\n', 'a\nX\nc\nD\ne\n', HEAD_LABELS).content).toBe(
      'a\n<<<<<<< HEAD\nB\n=======\nX\n>>>>>>> conflict-demo\nc\n<<<<<<< HEAD\nd\nE\n=======\nD\ne\n>>>>>>> conflict-demo\n',
    )
  })

  it('два независимых конфликта в одном файле дают два блока', () => {
    const base = 'a\nb\nc\nd\ne\n'
    const result = mergeFileWithMarkers(base, 'a\nB\nc\nD\ne\n', 'a\nX\nc\nY\ne\n', HEAD_LABELS)
    expect(result.conflict).toBe(true)
    expect(markerBlocks(result.content)).toHaveLength(2)
    expect(result.content).toBe('a\n<<<<<<< HEAD\nB\n=======\nX\n>>>>>>> conflict-demo\nc\n<<<<<<< HEAD\nD\n=======\nY\n>>>>>>> conflict-demo\ne\n')
  })

  it('соприкасающиеся правки образуют один блок (ветка «соприкосновение» hunksOverlap); общие строки внутри блока выносятся за метки', () => {
    expect(mergeFileWithMarkers('a\nb\nc\n', 'a\nX\nc\n', 'a\nb\nY\n', HEAD_LABELS)).toEqual({
      conflict: true,
      content: 'a\n<<<<<<< HEAD\nX\nc\n=======\nb\nY\n>>>>>>> conflict-demo\n',
    })
    expect(mergeFileWithMarkers('o\n', 'x\ny1\nz\n', 'x\ny2\nz\n', HEAD_LABELS)).toEqual({
      conflict: true,
      content: 'x\n<<<<<<< HEAD\ny1\n=======\ny2\n>>>>>>> conflict-demo\nz\n',
    })
  })

  it('после строки `>>>>>>>` перевод строки есть всегда, даже если файл им не кончался (К1.1)', () => {
    expect(mergeFileWithMarkers('c', 'a', 'b', HEAD_LABELS)).toEqual({ conflict: true, content: '<<<<<<< HEAD\na\n=======\nb\n>>>>>>> conflict-demo\n' })
  })
})

describe('блоки меток и кнопки редактора (часть XI, «Кнопки редактора»)', () => {
  const marked = cat('К17.4')

  it('markerBlocks читает подписи и обе части; незакрытый блок и файл без меток блоков не дают', () => {
    expect(markerBlocks(marked)).toEqual([
      { top: 'HEAD', bottom: 'b3057c2 (fix: опечатка в логе)', topLines: ['console.log("v2");'], bottomLines: ['console.log("v1"); // исправлена опечатка в логе'], from: 0, to: 4 },
    ])
    expect(markerBlocks('<<<<<<< HEAD\nx\n')).toEqual([])
    expect(markerBlocks(seed.appBase)).toEqual([])
  })

  it('верхняя часть даёт файл HEAD байт в байт: sed из К17.4 «same-as-HEAD»', () => {
    expect(editorChoice(marked, 'top')).toBe('console.log("v2");\n')
    expect(protocolEntry('К17.4', "sed -i '/^<<<<<<< /d; /^=======$/,/^>>>>>>> /d' app.js; git show HEAD:app.js | cmp - app.js && echo same-as-HEAD").output).toBe('same-as-HEAD')
  })

  it('нижняя часть и обе части без меток; «обе» — верхняя, за ней нижняя (К1.4)', () => {
    expect(editorChoice(marked, 'bottom')).toBe('console.log("v1"); // исправлена опечатка в логе\n')
    expect(editorChoice(marked, 'both')).toBe('console.log("v2");\nconsole.log("v1"); // исправлена опечатка в логе\n')
  })

  it('текст вне блоков не меняется, блоков несколько', () => {
    const text = 'a\n<<<<<<< HEAD\nB\n=======\nX\n>>>>>>> t\nc\n<<<<<<< HEAD\nD\n=======\nY\n>>>>>>> t\ne\n'
    expect(editorChoice(text, 'top')).toBe('a\nB\nc\nD\ne\n')
    expect(editorChoice(text, 'bottom')).toBe('a\nX\nc\nY\ne\n')
    expect(editorChoice(text, 'both')).toBe('a\nB\nX\nc\nD\nY\ne\n')
    expect(editorChoice('просто текст\n', 'top')).toBe('просто текст\n')
  })

  it('суффикс ✎ в конце закрывающей метки метку не ломает', () => {
    expect(editorChoice('<<<<<<< HEAD\nA\n=======\nB\n>>>>>>> t + правка\n', 'bottom')).toBe('B\n')
  })
})

describe('enterConflict, markResolved, abortTo', () => {
  const base = { 'app.js': seed.appBase, 'README.md': seed.readme }
  const ours = { 'app.js': 'console.log("v2");\n', 'README.md': seed.readme }
  const theirs = { 'app.js': seed.appFixed, 'README.md': '# Мини-сайт!\n' }
  const labels = { top: 'HEAD', bottom: 'ae28885 (fix: опечатка в логе)' }

  it('конфликтный файл: метки в каталоге, нет в индексе, три версии в unmerged; слитый — и в индексе, и в каталоге (К4.6: M  README.md)', () => {
    const merge = mergeOf(base, ours, theirs)
    const state = emptyState({ index: { ...ours }, working: { ...ours } })
    const entered = enterConflict(state, merge, labels)
    expect(entered.index).toEqual({ 'README.md': '# Мини-сайт!\n' })
    expect(entered.working['README.md']).toBe('# Мини-сайт!\n')
    expect(entered.working['app.js']).toBe(`<<<<<<< HEAD\nconsole.log("v2");\n=======\n${seed.appFixed}>>>>>>> ae28885 (fix: опечатка в логе)\n`)
    expect(entered.unmerged).toEqual({ 'app.js': { kind: 'both-modified', base: seed.appBase, ours: 'console.log("v2");\n', theirs: seed.appFixed } })
    expect(entered.operation).toBeNull()
    expect(state.index).toEqual(ours)
  })

  it('удаление файла слиянием убирает его из индекса и каталога; файл, равный нашему, не трогается (в том числе чужая правка в каталоге)', () => {
    const b = { 'a.txt': 'a\n', 'b.txt': 'b\n', 'app.js': seed.appBase }
    const o = { 'a.txt': 'a\n', 'b.txt': 'b\n', 'app.js': 'x\n' }
    const t = { 'b.txt': 'b\n', 'app.js': 'y\n' }
    const state = emptyState({ index: { ...o }, working: { ...o, 'b.txt': 'b правка\n' } })
    const entered = enterConflict(state, mergeOf(b, o, t), labels)
    expect(Object.keys(entered.index)).toEqual(['b.txt'])
    expect(Object.keys(entered.working).sort()).toEqual(['app.js', 'b.txt'])
    expect(entered.working['b.txt']).toBe('b правка\n')
  })

  it('оба создали файл: вид both-added без базы (К3.1)', () => {
    const entered = enterConflict(emptyState({ index: { 'x.txt': 'мой\n' }, working: { 'x.txt': 'мой\n' } }), mergeOf({}, { 'x.txt': 'мой\n' }, { 'x.txt': 'чужой\n' }), labels)
    expect(entered.unmerged['x.txt']).toEqual({ kind: 'both-added', ours: 'мой\n', theirs: 'чужой\n' })
    expect(entered.working['x.txt']).toBe('<<<<<<< HEAD\nмой\n=======\nчужой\n>>>>>>> ae28885 (fix: опечатка в логе)\n')
  })

  it('конфликт «изменение и удаление» модуль не знает: нарушение условия вызова — исключение', () => {
    expect(() => enterConflict(emptyState(), mergeOf({ 'a.txt': 'a\n' }, { 'a.txt': 'b\n' }, {}), labels)).toThrow()
  })

  it('markResolved: запись уходит из unmerged, в индексе рабочая версия; метки не проверяются (К1.7)', () => {
    const state = emptyState({ working: { 'app.js': '<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> t\n' }, unmerged: { 'app.js': { kind: 'both-modified' } } })
    const resolved = markResolved(state, 'app.js')
    expect(resolved.unmerged).toEqual({})
    expect(resolved.index).toEqual({ 'app.js': '<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> t\n' })
    expect(markResolved(emptyState({ index: { 'a.txt': 'a' }, unmerged: { 'a.txt': { kind: 'both-modified' } } }), 'a.txt').index).toEqual({})
  })

  it('abortTo: пути операции возвращаются к дереву в индексе и в каталоге, прочая неподготовленная правка остаётся, подготовленная чужая возвращается (К19.1, К19.2)', () => {
    const tree = { 'app.js': 'console.log("v2");\n', 'notes.txt': 'заметки\n', 'other.txt': 'o\n' }
    const state = emptyState({
      index: { 'notes.txt': 'заметки правка\n', 'other.txt': 'o\n', 'README.md': 'новая подготовленная\n' },
      working: { 'app.js': '<<<<<<< HEAD\n', 'notes.txt': 'заметки правка\n', 'other.txt': 'o\nнеподготовленная правка\n', 'README.md': 'новая подготовленная\n', 'new.txt': 'новый\n' },
      unmerged: { 'app.js': { kind: 'both-modified' } },
      operation: { kind: 'cherry-pick', commit: 'a'.repeat(40) },
    })
    const aborted = abortTo(state, tree)
    expect(aborted.unmerged).toEqual({})
    expect(aborted.operation).toBeNull()
    expect(aborted.index).toEqual(tree)
    expect(aborted.working['app.js']).toBe('console.log("v2");\n')
    expect(aborted.working['notes.txt']).toBe('заметки\n')
    expect(aborted.working['other.txt']).toBe('o\nнеподготовленная правка\n')
    expect(aborted.working['new.txt']).toBe('новый\n')
    expect('README.md' in aborted.working).toBe(false)
  })
})

describe('conflictOutput: вывод команды при конфликте (часть XI, «Вывод команды при конфликте»)', () => {
  const commit = { id: 'ae28885'.padEnd(40, '0'), subject: 'fix: опечатка в логе' }

  it('cherry-pick: Auto-merging, CONFLICT, error: could not apply и семь строк hint (К5.1)', () => {
    const merge = mergeOf({ 'app.js': seed.appBase }, { 'app.js': 'console.log("v2");\n' }, { 'app.js': seed.appFixed })
    expect(conflictOutput({ command: 'cherry-pick', merge, commit })).toBe(protocolEntry('К5.1', 'git cherry-pick ae28885').output)
  })

  it('stash: только Auto-merging и CONFLICT, без error и hint (К4.1)', () => {
    const merge = mergeOf({ 'app.js': seed.appBase }, { 'app.js': seed.appFixed }, { 'app.js': 'console.log("v1"); // локальная правка\n' })
    const expected = protocolEntry('К4.1', 'git stash pop').output.split('\n').slice(0, 2).join('\n')
    expect(conflictOutput({ command: 'stash', merge })).toBe(expected)
  })

  it('два файла: пара Auto-merging + CONFLICT на каждый по алфавиту, add/add с тем же Auto-merging (К18.1)', () => {
    const merge = mergeOf({ 'style.css': 'a\n' }, { 'style.css': 'b\n', 'index.html': 'м\n' }, { 'style.css': 'c\n', 'index.html': 'ч\n' })
    expect(conflictOutput({ command: 'stash', merge })).toBe(
      ['Auto-merging index.html', 'CONFLICT (add/add): Merge conflict in index.html', 'Auto-merging style.css', 'CONFLICT (content): Merge conflict in style.css'].join('\n'),
    )
    expect(protocolEntry('К18.1', 'git merge conflict-demo').output.split('\n').slice(0, 4).join('\n')).toBe(conflictOutput({ command: 'stash', merge }))
  })
})

describe('statusBlock и shortCode (часть XI, «git status»)', () => {
  const commit = 'ae28885'.padEnd(40, '0')
  const pick = { kind: 'cherry-pick' as const, commit }

  it('cherry-pick с неслитым путём: заголовок из четырёх строк, раздел без подсказки restore --staged (К5.1)', () => {
    const parts = statusBlock({ unmerged: { 'app.js': { kind: 'both-modified' } }, operation: pick })
    const status = protocolEntry('К5.1', 'git status').output.split('\n')
    expect(parts.header).toEqual(status.slice(1, 5))
    expect(parts.unmerged).toEqual(status.slice(6, 9))
    expect(parts.restoreStagedHint).toBe(false)
    expect(parts.short).toEqual([{ path: 'app.js', code: 'UU' }])
  })

  it('все пути добавлены: вторая строка заголовка меняется на `all conflicts fixed` (К5.4)', () => {
    const parts = statusBlock({ unmerged: {}, operation: pick })
    expect(parts.header).toEqual(protocolEntry('К5.4', 'git status').output.split('\n').slice(1, 5))
    expect(parts.unmerged).toEqual([])
  })

  it('тайник: заголовка нет, подсказка restore --staged есть (К4.1)', () => {
    const parts = statusBlock({ unmerged: { 'app.js': { kind: 'both-modified' } }, operation: null })
    expect(parts.header).toEqual([])
    expect(parts.unmerged).toEqual(protocolEntry('К4.1', 'git status').output.split('\n').slice(1, 5))
    expect(parts.restoreStagedHint).toBe(true)
  })

  it('оба создали: подпись `both added:` дополнена пробелами до 17 знаков, код AA, пути по алфавиту (К18.1)', () => {
    const parts = statusBlock({ unmerged: { 'style.css': { kind: 'both-modified' }, 'index.html': { kind: 'both-added' } }, operation: null })
    expect(parts.unmerged.slice(-2)).toEqual(['\tboth added:      index.html', '\tboth modified:   style.css'])
    expect(protocolEntry('К18.1', 'git status').output).toContain('\tboth added:      index.html\n\tboth modified:   style.css')
    expect(parts.short).toEqual([
      { path: 'index.html', code: 'AA' },
      { path: 'style.css', code: 'UU' },
    ])
    expect(protocolEntry('К18.1', 'git status --short').output).toBe('AA index.html\nUU style.css')
    expect([shortCode({ kind: 'both-added' }), shortCode({ kind: 'both-modified' })]).toEqual(['AA', 'UU'])
  })

  it('нет ни операции, ни неслитых путей — частей нет', () => {
    expect(statusBlock({ unmerged: {}, operation: null })).toEqual({ header: [], unmerged: [], restoreStagedHint: true, short: [] })
  })
})

describe('rebase: вывод остановки, заголовок статуса, отказы (часть XI; К6, К13.b, К14.3, П8.11)', () => {
  const id = (short: string) => short.padEnd(40, '0')
  const step = (short: string, subject: string) => ({ id: id(short), subject })
  const fix = step('a48b638', 'fix: опечатка в логе')
  const about = step('c290621', 'Добавить страницу «О проекте»')
  const op = (over: Partial<RebaseOperation> = {}): RebaseOperation => ({ kind: 'rebase', branch: 'feature', origHead: id('c290621'), onto: id('2e13bdd'), done: [fix], todo: [about], mergeMsg: true, committed: false, ...over })
  const conflicted = { 'app.js': { kind: 'both-modified' as const } }
  const status = (block: string, command = 'git status') => protocolEntry(block, command).output.split('\n')

  it('conflictOutput: Auto-merging, CONFLICT, error: could not apply, пять строк hint и `Could not apply <id7>... # <тема>` (К6.1, П8.11)', () => {
    const merge = mergeOf({ 'app.js': seed.appBase }, { 'app.js': 'console.log("v2");\n' }, { 'app.js': seed.appFixed })
    const output = conflictOutput({ command: 'rebase', merge, commit: fix })
    const expected = protocolEntry('К6.1', 'git rebase master').output.replace(/^Rebasing \(1\/2\)<CR>/, '')
    expect(output).toBe(expected.replaceAll('871ab0c', 'a48b638'))
    expect(protocolEntry('П8.11', 'git rebase master').output).toContain('hint: Resolve all conflicts manually, mark them as resolved with')
    expect(output.split('\n')).toHaveLength(9)
  })

  it('conflictOutput: add/add на последнем коммите, строка `Auto-merging` и `CONFLICT (add/add)` (К14.3)', () => {
    const merge = mergeOf({}, { 'about.html': '<h1>About</h1>\n' }, { 'about.html': '<h1>О проекте</h1>\n' })
    const output = conflictOutput({ command: 'rebase', merge, commit: about })
    const expected = protocolEntry('К14.3', 'git rebase master').output.replace(/^Rebasing \(1\/2\)<CR>Rebasing \(2\/2\)<CR>/, '')
    expect(output).toBe(expected.replaceAll('f2c0279', 'c290621'))
  })

  it('заголовок с неслитым путём: pick сделанного и оставшегося, три подсказки, раздел с restore --staged (П8.11, О10)', () => {
    const parts = statusBlock({ unmerged: conflicted, operation: op() })
    const expected = status('П8.11')
    expect(parts.header).toEqual(expected.slice(0, 10))
    expect(parts.unmerged).toEqual(expected.slice(11, 15))
    expect(parts.restoreStagedHint).toBe(true)
    expect(status('О10').slice(7, 10)).toEqual(parts.header.slice(7))
  })

  it('все пути добавлены: три подсказки заменены одной `all conflicts fixed` (К6.3)', () => {
    const parts = statusBlock({ unmerged: {}, operation: op() })
    const expected = status('К6.3')
    expect(parts.header).toEqual([...expected.slice(0, 7), expected[7]].map((line) => line.replace('542be3b', '2e13bdd').replace('871ab0c', 'a48b638').replace('b3fa05e', 'c290621')))
    expect(parts.header).toHaveLength(8)
  })

  it('запись о коммите ушла (после commit, reset, reset --hard): `editing a commit` и две подсказки (К6.4, К6.6, К10.b)', () => {
    const parts = statusBlock({ unmerged: {}, operation: op({ mergeMsg: false }) })
    const expected = status('К6.6', 'git status')
    expect(parts.header).toEqual(expected.slice(0, 9).map((line) => line.replace('3546b3e', '2e13bdd').replace('de1bafa', 'a48b638').replace('ccaa5e5', 'c290621')))
    expect(parts.header.slice(6)).toEqual(status('К10.b').slice(6, 9).map((line) => line.replace('8405d75', '2e13bdd')))
  })

  it('шагов не осталось: `No commands remaining.` вместо `Next command…` и `(use "git rebase --edit-todo"…)`; сделано два: `Last commands done (2 commands done):` (К14.3)', () => {
    const first = step('91abab0', 'fix: опечатка в логе')
    const last = step('f2c0279', 'Добавить страницу «О проекте»')
    const parts = statusBlock({ unmerged: { 'about.html': { kind: 'both-added' } }, operation: op({ onto: id('080bc61'), done: [first, last], todo: [] }) })
    expect(parts.header).toEqual(status('К14.3').slice(0, 9))
    expect(parts.unmerged[parts.unmerged.length - 1]).toBe('\tboth added:      about.html')
    expect(parts.short).toEqual([{ path: 'about.html', code: 'AA' }])
    const single = statusBlock({ unmerged: conflicted, operation: op({ todo: [] }) }).header
    expect(single.slice(1, 4)).toEqual(['Last command done (1 command done):', '   pick a48b638 # fix: опечатка в логе', 'No commands remaining.'])
    expect(protocolEntry('К3.5', 'git status').output).toContain('Last command done (1 command done):\n   pick 368ff08 # Ещё строка\nNo commands remaining.')
  })

  it('HEAD на ветке после checkout -b: строки `interactive rebase in progress` нет, остальное то же (К13.b)', () => {
    const header = statusBlock({ unmerged: conflicted, operation: op() }, { headOnBranch: true }).header
    expect(header).toEqual(status('К13.b').slice(1, 10).map((line) => line.replace('023e640', 'a48b638').replace('ee9a707', 'c290621').replace('b010cba', '2e13bdd')))
  })

  it('число шагов, которого нет в прогонах, — нарушение условия вызова: исключение', () => {
    expect(() => statusBlock({ unmerged: conflicted, operation: op({ done: [fix, about, fix] }) })).toThrow()
    expect(() => statusBlock({ unmerged: conflicted, operation: op({ todo: [about, about] }) })).toThrow()
  })

  it('rebase --continue при неслитых путях: `needs merge` и две строки, код 1 (К6.2)', () => {
    const entry = protocolEntry('К6.2', 'git rebase --continue')
    expect(refusal({ name: 'rebase-continue' }, { unmerged: conflicted, operation: op() })).toEqual({ output: entry.output, exitCode: entry.exitCode })
    expect(refusal({ name: 'rebase-continue' }, { unmerged: {}, operation: op() })).toBeNull()
  })

  it('новый rebase <база>, пока идёт rebase: блок о каталоге rebase-merge с пустой строкой в конце, код 128, и при неслитых путях, и без них (К6.2)', () => {
    const entry = protocolEntry('К6.2', 'git rebase master')
    const expected = { output: entry.output, exitCode: 128 }
    expect(refusal({ name: 'rebase' }, { unmerged: conflicted, operation: op() })).toEqual(expected)
    expect(refusal({ name: 'rebase' }, { unmerged: {}, operation: op({ mergeMsg: false }) })).toEqual(expected)
    expect(entry.output.endsWith('valuable there.\n')).toBe(true)
  })

  it('матрица `--abort` и `--continue` не своей команды: rebase без операции — `fatal: no rebase in progress`; cherry-pick без операции — две строки (К6.3, К6.7, К6.2)', () => {
    const noRebase = protocolEntry('К6.7', 'git rebase --continue')
    expect(refusal({ name: 'rebase-step' }, { unmerged: {}, operation: null })).toEqual({ output: noRebase.output, exitCode: noRebase.exitCode })
    expect(protocolEntry('К6.3', 'git rebase --abort').output).toBe(noRebase.output)
    // чужая операция и конфликт тайника отвечают так же «по признаку»
    expect(refusal({ name: 'rebase-step' }, { unmerged: {}, operation: { kind: 'cherry-pick', commit: id('ae28885') } })?.output).toBe(noRebase.output)
    expect(refusal({ name: 'rebase-step' }, { unmerged: conflicted })?.output).toBe(noRebase.output)
    expect(refusal({ name: 'rebase-step' }, { unmerged: conflicted, operation: op() })).toBeNull()
    const noPick = protocolEntry('К6.2', 'git cherry-pick --abort')
    expect(refusal({ name: 'cherry-pick-step' }, { unmerged: conflicted, operation: op() })).toEqual({ output: noPick.output, exitCode: noPick.exitCode })
    expect(protocolEntry('К6.7', 'git cherry-pick --continue').output).toBe(noPick.output)
    expect(refusal({ name: 'cherry-pick-step' }, { unmerged: {}, operation: null })?.output).toBe(noPick.output)
    expect(refusal({ name: 'cherry-pick-step' }, { unmerged: conflicted, operation: { kind: 'cherry-pick', commit: id('ae28885') } })).toBeNull()
  })

  it('switch <ветка> посреди rebase: `cannot switch branch while rebasing` и строка про --quit, код 128 (О10)', () => {
    const entry = protocolEntry('О10', 'git switch master')
    expect(refusal({ name: 'switch-branch' }, { unmerged: conflicted, operation: op() })).toEqual({ output: entry.output, exitCode: entry.exitCode })
    expect(refusal({ name: 'switch-branch' }, { unmerged: conflicted, operation: null })).toBeNull()
    expect(refusal({ name: 'switch-branch' }, { unmerged: {}, operation: { kind: 'cherry-pick', commit: id('ae28885') } })).toBeNull()
  })

  it('прочие отказы таблицы не зависят от вида операции: commit, checkout <ветка>, stash, stash pop, reset --soft, cherry-pick (К6.2, К6.4, К10.b, К16.b)', () => {
    const state = { unmerged: conflicted, operation: op() }
    expect(refusal({ name: 'commit' }, state)?.output).toBe(protocolEntry('К6.4', 'git commit -m x').output)
    expect(refusal({ name: 'checkout-branch' }, state)?.output).toBe(protocolEntry('К6.2', 'git checkout master').output)
    expect(refusal({ name: 'stash' }, state)?.output).toBe(protocolEntry('К6.2', 'git stash').output)
    expect(refusal({ name: 'stash-pop' }, state)?.output).toBe(protocolEntry('К16.b', 'git stash pop').output)
    expect(refusal({ name: 'stash-apply' }, state)?.output).toBe(protocolEntry('К16.b', 'git stash apply').output)
    expect(refusal({ name: 'reset-soft' }, state)?.output).toBe(protocolEntry('К10.b', 'git reset --soft HEAD').output)
    expect(refusal({ name: 'cherry-pick' }, state)?.output).toBe(protocolEntry('К6.2', 'git cherry-pick master').output)
  })
})

describe('refusal: что запрещено посреди конфликта (часть XI, «Что запрещено»)', () => {
  const one = { unmerged: { 'app.js': { kind: 'both-modified' as const } } }

  it('commit и commit -m: блок A и строка `U\\t<файл>`, код 128 (К4.2, К5.2)', () => {
    const entry = protocolEntry('К5.2', 'git commit -m x')
    expect(refusal({ name: 'commit' }, one)).toEqual({ output: entry.output, exitCode: entry.exitCode })
    expect(protocolEntry('К4.2', 'git commit -m x').output).toBe(entry.output)
  })

  it('`U` на каждый неслитый путь по алфавиту (К18.1)', () => {
    const two = { unmerged: { 'style.css': { kind: 'both-modified' as const }, 'index.html': { kind: 'both-added' as const } } }
    expect(refusal({ name: 'commit' }, two)?.output.split('\n').slice(4)).toEqual(['U\tindex.html', 'U\tstyle.css'])
    expect(protocolEntry('К18.1', 'git commit -m x').output).toContain('U\tstyle.css')
  })

  it('cherry-pick <коммит>: Cherry-picking is not possible…, fatal: cherry-pick failed, код 128 (К5.2, К4.2)', () => {
    const entry = protocolEntry('К5.2', 'git cherry-pick f12dd83')
    expect(refusal({ name: 'cherry-pick' }, one)).toEqual({ output: entry.output, exitCode: entry.exitCode })
    expect(protocolEntry('К4.2', 'git cherry-pick master').output).toBe(entry.output)
  })

  it('checkout <ветка>: `you need to resolve your current index first` и `needs merge`, код 1 (К5.2, К4.2)', () => {
    const entry = protocolEntry('К5.2', 'git checkout feature')
    expect(refusal({ name: 'checkout-branch' }, one)).toEqual({ output: entry.output, exitCode: entry.exitCode })
    expect(protocolEntry('К4.2', 'git checkout master').output).toBe(entry.output)
  })

  it('checkout -- <файл>: `path is unmerged`; только когда неслитые все пути (К4.2)', () => {
    const entry = protocolEntry('К4.2', 'git checkout -- app.js')
    expect(refusal({ name: 'checkout-paths', paths: ['app.js'] }, one)).toEqual({ output: entry.output, exitCode: entry.exitCode })
    expect(refusal({ name: 'checkout-paths', paths: ['app.js', 'README.md'] }, one)).toBeNull()
    expect(refusal({ name: 'checkout-paths', paths: ['README.md'] }, one)).toBeNull()
  })

  it('stash, stash pop, stash apply: `could not write index`, `needs merge`; у pop ещё строка про тайник (К5.2, К4.2, К16.c)', () => {
    expect(refusal({ name: 'stash' }, one)?.output).toBe(protocolEntry('К5.2', 'git stash').output)
    expect(refusal({ name: 'stash' }, one)?.exitCode).toBe(1)
    expect(refusal({ name: 'stash-pop' }, one)?.output).toBe(protocolEntry('К16.c', 'git stash pop').output)
    expect(refusal({ name: 'stash-apply' }, one)?.output).toBe(protocolEntry('К16.c', 'git stash apply').output)
    expect(refusal({ name: 'stash-pop' }, one)?.output).toBe(protocolEntry('К4.2', 'git stash pop').output)
  })

  it('reset --soft: `Cannot do a soft reset in the middle of a merge.`, код 128 (К5.9, К10.c, К10.s)', () => {
    const entry = protocolEntry('К5.9', 'git reset --soft HEAD')
    expect(refusal({ name: 'reset-soft' }, one)).toEqual({ output: entry.output, exitCode: entry.exitCode })
  })

  it('rebase <база> без идущего rebase: `needs merge` и три строки об отказе, код 1 (К4.2)', () => {
    const entry = protocolEntry('К4.2', 'git rebase master')
    expect(refusal({ name: 'rebase' }, one)).toEqual({ output: entry.output, exitCode: entry.exitCode })
  })

  it('неслитых путей нет — отказа нет ни у одной команды', () => {
    for (const name of ['commit', 'cherry-pick', 'checkout-branch', 'stash', 'stash-pop', 'stash-apply', 'reset-soft', 'rebase'] as const) {
      expect(refusal({ name }, { unmerged: {} }), name).toBeNull()
    }
  })
})
