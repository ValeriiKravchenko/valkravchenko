// `git checkout -- <файл>` и `git checkout <файл>` (target.md, часть X, «Вернуть файл»). Вывод сверен
// с протоколами section8-git-runs.txt (П8.3, П8.10) и appendix-g18e2-git-runs.txt (П8.52–П8.56);
// целиком блоки П8.53–П8.56 проигрываются в appendixProtocol.test.ts.
import { describe, expect, it } from 'vitest'
import { fresh, protocolEntry, run, runAll, where } from './appendixProtocolKit'
import { createAppendixFile, deleteAppendixFile, editAppendixFile } from './appendixSection'
import type { AppendixState } from './appendixSection'
import { ru } from '../locales/ru'

const seed = ru.appendix.seed
const refusal = (output: string) => expect(output.startsWith('[тренажёр]')).toBe(true)
const edit = (state: AppendixState, file = 'app.js') => editAppendixFile(state, file)
const bare = (s: AppendixState) => ({ ...s, history: [] })

describe('git checkout -- <файл>: возврат из индекса', () => {
  it(`правка пропала, вывод пустой, код 0 (${where('П8.3', 'git checkout -- app.js')}, ${where('П8.10', 'git checkout -- app.js')})`, () => {
    const r = run(edit(fresh()), 'git checkout -- app.js')
    expect(r.result).toMatchObject({ output: '', exitCode: 0, ok: true })
    expect(r.state.working['app.js']).toBe(seed.appBase)
    expect(run(r.state, 'git status --short').result.output).toBe('')
    expect(protocolEntry('П8.3', 'git checkout -- app.js').output).toBe('')
    expect(protocolEntry('П8.10', 'git checkout -- app.js').output).toBe('')
  })

  it('файл не менялся: тоже молча, код 0 (П8.53)', () => {
    const s = fresh()
    const r = run(s, 'git checkout -- app.js')
    expect(r.result).toMatchObject({ output: '', exitCode: 0 })
    expect(bare(r.state)).toEqual(bare(s))
  })

  it('несколько файлов сразу; повтор имени с -- допустим (П8.53)', () => {
    const s = edit(edit(fresh()), 'README.md')
    const r = run(s, 'git checkout -- app.js README.md')
    expect(r.state.working).toEqual(s.index)
    expect(run(s, 'git checkout -- app.js app.js').result).toMatchObject({ output: '', exitCode: 0 })
  })

  it(`подготовленная правка остаётся: возвращается версия из индекса, а не из HEAD (${where('П8.54', 'git checkout -- app.js')})`, () => {
    let s = run(edit(fresh()), 'git add app.js').state
    s = edit(s)
    expect(run(s, 'git status --short').result.output).toBe('MM app.js')
    const r = run(s, 'git checkout -- app.js')
    expect(run(r.state, 'git status --short').result.output).toBe('M  app.js')
    expect(r.state.working['app.js']).toBe(s.index['app.js'])
  })

  it('удалённый файл создаётся заново (П8.54)', () => {
    const s = deleteAppendixFile(fresh(), 'app.js')
    const r = run(s, 'git checkout -- app.js')
    expect(r.result.exitCode).toBe(0)
    expect(r.state.working['app.js']).toBe(seed.appBase)
  })

  it('подготовленный новый файл: возвращается индексная версия, в том числе после удаления из каталога (П8.54)', () => {
    let s = run(createAppendixFile(fresh(), 'n.txt'), 'git add n.txt').state
    s = edit(s, 'n.txt')
    expect(run(s, 'git status --short').result.output).toBe('AM n.txt')
    s = run(s, 'git checkout -- n.txt').state
    expect(run(s, 'git status --short').result.output).toBe('A  n.txt')
    s = deleteAppendixFile(s, 'n.txt')
    s = run(s, 'git checkout -- n.txt').state
    expect(s.working['n.txt']).toBe(`${ru.fileOps.newFileContent}\n`)
  })

  it('индекс, коммиты, ветки, журнал и тайники не меняются; меняется только рабочий каталог', () => {
    const s = edit(fresh())
    const r = run(s, 'git checkout -- app.js').state
    expect({ ...bare(r), working: s.working }).toEqual({ ...bare(s), working: s.working })
  })
})

describe('ошибки путей (П8.52–П8.55)', () => {
  it(`неизвестный путь: error: pathspec … did not match any file(s) known to git, код 1; ничего не восстановлено (${where('П8.53', 'git checkout -- app.js nosuch')})`, () => {
    const s = edit(fresh())
    const r = run(s, 'git checkout -- app.js nosuch')
    expect(r.result).toMatchObject({ output: "error: pathspec 'nosuch' did not match any file(s) known to git", exitCode: 1, ok: false })
    expect(r.state.working).toEqual(s.working)
    expect(protocolEntry('П8.53', 'git checkout -- app.js nosuch').exitCode).toBe(1)
  })

  it(`несколько неизвестных путей: по строке на каждый в порядке аргументов (${where('П8.53', 'git checkout -- nosuch1 nosuch2')})`, () => {
    expect(run(fresh(), 'git checkout -- nosuch1 nosuch2').result.output).toBe(
      ["error: pathspec 'nosuch1' did not match any file(s) known to git", "error: pathspec 'nosuch2' did not match any file(s) known to git"].join('\n'),
    )
    expect(run(fresh(), 'git checkout app.js nosuch1 nosuch2').result.output.split('\n')).toHaveLength(2)
  })

  it('«известен git» значит «есть в индексе»: неотслеживаемый файл и файл ветки feature — ошибка (П8.54, П8.53 about.html)', () => {
    const untracked = createAppendixFile(fresh(), 'n.txt')
    expect(run(untracked, 'git checkout -- n.txt').result.exitCode).toBe(1)
    expect(run(untracked, 'git checkout n.txt').result.output).toBe("error: pathspec 'n.txt' did not match any file(s) known to git")
    expect(run(fresh(), 'git checkout -- about.html').result.output).toBe("error: pathspec 'about.html' did not match any file(s) known to git")
  })

  it('файл удалён из индекса и из каталога: git его больше не знает — ошибка (П8.54)', () => {
    let s = deleteAppendixFile(fresh(), 'README.md')
    s = run(s, 'git add README.md').state
    expect(run(s, 'git checkout -- README.md').result).toMatchObject({ output: "error: pathspec 'README.md' did not match any file(s) known to git", exitCode: 1 })
  })

  it('git checkout -- без путей — молча, код 0 (П8.53)', () => {
    expect(run(fresh(), 'git checkout --').result).toMatchObject({ output: '', exitCode: 0 })
  })
})

describe('git checkout <файл> без «--» (П8.55)', () => {
  it(`Updated 1 path from the index для изменённого файла; Updated 0 paths для неизменённого (${where('П8.55', 'git checkout app.js')})`, () => {
    const changed = run(edit(fresh()), 'git checkout app.js')
    expect(changed.result).toMatchObject({ output: 'Updated 1 path from the index', exitCode: 0 })
    expect(changed.state.working['app.js']).toBe(seed.appBase)
    expect(run(changed.state, 'git checkout app.js').result.output).toBe('Updated 0 paths from the index')
  })

  it('число считает файлы, которые отличались от индекса; удалённый файл тоже (П8.55)', () => {
    expect(run(edit(fresh()), 'git checkout app.js README.md').result.output).toBe('Updated 1 path from the index')
    expect(run(edit(edit(fresh()), 'README.md'), 'git checkout app.js README.md').result.output).toBe('Updated 2 paths from the index')
    expect(run(deleteAppendixFile(fresh(), 'app.js'), 'git checkout app.js').result.output).toBe('Updated 1 path from the index')
    const staged = run(edit(fresh()), 'git add app.js').state
    expect(run(staged, 'git checkout app.js').result.output).toBe('Updated 0 paths from the index')
  })

  it('неизвестное слово: все слова — пути, ошибка по каждому неизвестному (П8.55)', () => {
    expect(run(fresh(), 'git checkout nosuch').result).toMatchObject({ output: "error: pathspec 'nosuch' did not match any file(s) known to git", exitCode: 1 })
    expect(run(fresh(), 'git checkout app.js nosuch').result.output).toBe("error: pathspec 'nosuch' did not match any file(s) known to git")
    expect(run(fresh(), 'git checkout nosuch app.js').result.output).toBe("error: pathspec 'nosuch' did not match any file(s) known to git")
  })

  it('имя ветки сильнее имени файла: git переходит на ветку (П8.56)', () => {
    const s = edit(runAll(fresh(), ['git branch app.js']))
    const r = run(s, 'git checkout app.js')
    expect(r.result.output).toBe("M\tapp.js\nSwitched to branch 'app.js'")
    expect(protocolEntry('П8.56', 'git checkout app.js').output).toBe("M\tapp.js\nSwitched to branch 'app.js'")
    expect(r.state.head).toEqual({ kind: 'branch', name: 'app.js' })
  })

  it('речь: без «--» git читает слово как ветку; с «--» этого пояснения нет', () => {
    expect(run(edit(fresh()), 'git checkout app.js').result.explanation).toContain(ru.appendix.explain.restoreWithoutDashes)
    expect(run(edit(fresh()), 'git checkout -- app.js').result.explanation).not.toContain(ru.appendix.explain.restoreWithoutDashes)
    expect(run(edit(fresh()), 'git checkout -- app.js').result.explanation).toContain(ru.appendix.explain.restoreDone)
    expect(run(fresh(), 'git checkout -- app.js').result.explanation).toBe(ru.appendix.explain.restoreNothing)
    expect(run(fresh(), 'git checkout -- nosuch').result.explanation).toBe(ru.appendix.explain.restorePathspec)
  })
})

describe('формы вне области: отказ области, файлы не тронуты', () => {
  it('ссылка и -- (берёт файл из коммита), ссылка и файл, дубликаты без --, маски, каталоги, «.»', () => {
    const s = edit(fresh())
    const forms = [
      'git checkout master -- app.js',
      'git checkout HEAD -- app.js',
      'git checkout feature -- app.js',
      'git checkout HEAD app.js',
      'git checkout feature app.js',
      'git checkout app.js app.js',
      'git checkout -- .',
      'git checkout -- src/app.js',
      'git checkout -- ../app.js',
      'git checkout -- :/app.js',
      "git checkout -- 'a*'",
    ]
    for (const form of forms) {
      const r = run(s, form)
      expect(r.result.exitCode, form).toBeUndefined()
      refusal(r.result.output)
      expect(r.state.working, form).toEqual(s.working)
    }
    // Настоящий git молча берёт файл из коммита (П8.53, П8.55).
    expect(protocolEntry('П8.53', 'git checkout master -- app.js').exitCode).toBe(0)
    expect(protocolEntry('П8.55', 'git checkout app.js app.js').output).toBe('Updated 0 paths from the index')
  })

  it('отказ области для дубликатов называет причину; для ссылки — что git берёт файл из коммита', () => {
    expect(run(fresh(), 'git checkout app.js app.js').result.output).toBe(ru.appendix.errors.checkoutDuplicate)
    expect(run(fresh(), 'git checkout master -- app.js').result.output).toBe(ru.appendix.errors.checkoutFromRevision('master -- app.js'))
    expect(ru.appendix.errors.checkoutFromRevision('x')).toContain('из коммита')
  })
})
