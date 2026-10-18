// Локальная работа раздела 8: status, add, commit, branch, checkout, diff (target.md, часть X,
// «Что входит», строка «Локальная работа»). Вывод git сверен с протоколами; строки протокола
// названы в заголовках тестов.
import { describe, expect, it } from 'vitest'
import { commitOf, currentCommitId, headTree } from './appendixRepo'
import { fresh, protocolBlock, protocolEntry, run, runAll, where } from './appendixProtocolKit'
import type { AppendixState } from './appendixSection'
import { ru } from '../locales/ru'

const seed = ru.appendix.seed
const idOf = (state: AppendixState, message: string) => Object.values(state.commits).find((c) => c.message === message)!.id
const refusal = (output: string) => expect(output.startsWith('[тренажёр]')).toBe(true)

/** Состояние с отсоединённым HEAD на коммите: в шаге A недостижимо, тип его допускает. */
function detachedAt(state: AppendixState, id: string): AppendixState {
  return { ...state, head: { kind: 'detached', id }, lastCheckout: { spec: id.slice(0, 7), id } }
}

describe('git status', () => {
  it('чисто: On branch master, код 0', () => {
    const r = run(fresh(), 'git status')
    expect(r.result).toMatchObject({ ok: true, output: 'On branch master\nnothing to commit, working tree clean', exitCode: 0 })
  })

  it(`-s и --short: короткий вид (${where('П8.21', 'git status -s')}, ${where('П8.21', 'git status --short')})`, () => {
    expect(run(fresh(), 'git status -s').result.output).toBe('')
  })

  it('после ✎ у app.js: ` M app.js`', () => {
    // Файловая операция — через публичный API; здесь достаточно прямой правки рабочего каталога.
    const s = fresh()
    const edited = { ...s, working: { ...s.working, 'app.js': 'x\n' } }
    expect(run(edited, 'git status -s').result.output).toBe(' M app.js')
    expect(run(edited, 'git status --short').result.output).toBe(' M app.js')
  })

  it('на feature строка ветки — On branch feature', () => {
    const s = runAll(fresh(), ['git checkout feature'])
    expect(run(s, 'git status').result.output).toBe('On branch feature\nnothing to commit, working tree clean')
  })

  it(`отсоединённый HEAD: первая строка HEAD detached at <id7> (${where('П8.19', 'git status')})`, () => {
    const s = fresh()
    const base = idOf(s, seed.baseMessage)
    const out = run(detachedAt(s, base), 'git status').result.output
    expect(out.split('\n')[0]).toBe(`HEAD detached at ${base.slice(0, 7)}`)
    expect(protocolEntry('П8.19', 'git status').output.split('\n')[0]).toMatch(/^HEAD detached at [0-9a-f]{7}$/)
  })

  it('другие ключи и пути — отказ области, а не unknown switch', () => {
    for (const args of ['--porcelain', '-b', '-sb', '--ignored', 'app.js', '--', '-s -z']) {
      const r = run(fresh(), `git status ${args}`).result
      expect(r.exitCode, args).toBeUndefined()
      expect(r.ok).toBe(false)
      refusal(r.output)
    }
  })

  it('удалённый и добавленный файлы в подготовленном — отказ области про переименование (П8.24)', () => {
    const staged = { ...fresh(), index: { 'app.js': 'console.log("v1");\n', 'y.txt': 'новый файл\n' }, working: { 'app.js': 'console.log("v1");\n', 'y.txt': 'новый файл\n' } }
    const r = run(staged, 'git status').result
    refusal(r.output)
    expect(r.output).toContain('renamed')
    expect(r.exitCode).toBeUndefined()
  })

  it('путь с каталогом в рабочем каталоге — отказ области (файлы с каталогами в разделе не создаются)', () => {
    const s = fresh()
    const r = run({ ...s, working: { ...s.working, 'dir/f': 'x\n' } }, 'git status').result
    refusal(r.output)
    expect(r.output).toContain('каталог')
  })

  it('status ничего не меняет в состоянии, кроме истории терминала', () => {
    const s = fresh()
    const next = run(s, 'git status').state
    expect({ ...next, history: [] }).toEqual(s)
    expect(next.history).toHaveLength(1)
  })
})

describe('git add', () => {
  it(`без аргументов: Nothing specified и две подсказки, код 0 (${where('П8.26', 'git add')})`, () => {
    const r = run(fresh(), 'git add').result
    expect(r.output).toBe(protocolEntry('П8.26', 'git add').output)
    expect(r.exitCode).toBe(0)
  })

  it(`несуществующий путь: fatal: pathspec … did not match any files, код 128 (${where('П8.26', 'git add nosuch')})`, () => {
    const r = run(fresh(), 'git add nosuch').result
    expect(r.output).toBe("fatal: pathspec 'nosuch' did not match any files")
    expect(r.exitCode).toBe(128)
  })

  it(`один плохой путь отменяет весь add: ничего не подготовлено (${where('П8.26', 'git add app.js nosuch')})`, () => {
    const s = runAll(fresh(), [])
    const edited = { ...s, working: { ...s.working, 'app.js': 'x\n' } }
    const r = run(edited, 'git add app.js nosuch')
    expect(r.result.output).toBe("fatal: pathspec 'nosuch' did not match any files")
    expect(r.state.index).toEqual(edited.index)
  })

  it('подготовка изменённого, нового и удалённого файла по имени; вывод пустой, код 0', () => {
    const s = fresh()
    const work = { 'app.js': 'x\n', 'n.txt': 'n\n' }
    const state = { ...s, working: work }
    const a = run(state, 'git add app.js n.txt')
    expect(a.result).toMatchObject({ output: '', exitCode: 0, ok: true })
    // Удаление README.md add с другими путями не подготавливает.
    expect(a.state.index).toEqual({ 'app.js': 'x\n', 'n.txt': 'n\n', 'README.md': s.index['README.md'] })
    // README.md удалён из каталога: add с его именем подготавливает удаление (П8.27: git add README.md → D).
    const removed = run(a.state, 'git add README.md').state
    expect(removed.index['README.md']).toBeUndefined()
    expect(protocolEntry('П8.27', 'git status -s').output).toBe('D  README.md')
  })

  it(`git add . и -A, --all подготавливают всё, в том числе удаления (${where('П8.27', 'git add -A')})`, () => {
    const s = fresh()
    const state = { ...s, working: { 'app.js': 'x\n', 'n.txt': 'n\n' } }
    for (const form of ['git add .', 'git add -A', 'git add --all']) {
      const r = run(state, form)
      expect(r.result.output, form).toBe('')
      expect(r.state.index, form).toEqual({ 'app.js': 'x\n', 'n.txt': 'n\n' })
    }
  })

  it('-- отключает разбор ключей: git add -- app.js', () => {
    const s = fresh()
    const state = { ...s, working: { ...s.working, 'app.js': 'x\n' } }
    expect(run(state, 'git add -- app.js').state.index['app.js']).toBe('x\n')
  })

  it('маски, каталоги, ./, : и .. — отказ области; ключи -u, -p, -f — отказ области', () => {
    for (const form of ['git add "*.txt"', 'git add src/x', 'git add ./x', 'git add :/x', 'git add ..', 'git add -u', 'git add -p', 'git add -f app.js', 'git add -A app.js', 'git add . app.js']) {
      const r = run(fresh(), form).result
      expect(r.exitCode, form).toBeUndefined()
      refusal(r.output)
    }
  })

  it('add не трогает коммиты, ветки, HEAD и журнал', () => {
    const s = fresh()
    const state = { ...s, working: { ...s.working, 'app.js': 'x\n' } }
    const next = run(state, 'git add app.js').state
    expect(next.commits).toEqual(state.commits)
    expect(next.branches).toEqual(state.branches)
    expect(next.head).toEqual(state.head)
    expect(next.reflog).toEqual(state.reflog)
    expect(next.working).toEqual(state.working)
  })
})

describe('git commit', () => {
  const dirty = (): AppendixState => {
    const s = fresh()
    return { ...s, working: { ...s.working, 'app.js': 'console.log("v1"); + правка\n' } }
  }

  it(`нечего коммитить: полный status и код 1, даже при пустом сообщении (${where('П8.26', 'git commit -m "x"')}, ${where('П8.26', 'git commit -m ""')})`, () => {
    for (const form of ['git commit -m "x"', 'git commit -m ""', 'git commit']) {
      const r = run(fresh(), form).result
      expect(r.output, form).toBe('On branch master\nnothing to commit, working tree clean')
      expect(r.exitCode, form).toBe(1)
    }
    expect(protocolEntry('П8.26', 'git commit').exitCode).toBe(1)
  })

  it(`правка не подготовлена: полный status с Changes not staged и код 1 (${where('П8.26', 'git commit -m "x"', 1)})`, () => {
    const r = run(dirty(), 'git commit -m "x"').result
    expect(r.output).toBe(protocolEntry('П8.26', 'git commit -m "x"', 1).output)
    expect(r.exitCode).toBe(1)
  })

  it(`подготовлено, сообщение пустое или из пробелов: Aborting commit due to empty commit message., код 1 (${where('П8.26', 'git commit -m ""', 2)})`, () => {
    const staged = run(dirty(), 'git add app.js').state
    for (const form of ['git commit -m ""', 'git commit -m "   "']) {
      const r = run(staged, form)
      expect(r.result.output).toBe('Aborting commit due to empty commit message.')
      expect(r.result.exitCode).toBe(1)
      expect(r.result.explanation).toBe(ru.appendix.explain.commitEmptyMessage)
      expect(r.state.commits).toEqual(staged.commits)
    }
  })

  it('подготовлено, но -m нет: редактора в тренажёре нет — отказ области, коммит не создан', () => {
    const staged = run(dirty(), 'git add app.js').state
    const r = run(staged, 'git commit')
    refusal(r.result.output)
    expect(r.result.exitCode).toBeUndefined()
    expect(r.state.commits).toEqual(staged.commits)
  })

  it(`коммит: [master <id7>] <сообщение>, код 0, без диффстата (${where('П8.26', 'git commit -am "через -am"')})`, () => {
    const staged = run(dirty(), 'git add app.js').state
    const r = run(staged, 'git commit -m "Правка"')
    const id = currentCommitId(r.state)
    expect(r.result.output).toBe(`[master ${id.slice(0, 7)}] Правка`)
    expect(r.result.exitCode).toBe(0)
    expect(r.result.explanation).toBe(ru.appendix.explain.commitStatNotShown)
    expect(protocolEntry('П8.26', 'git commit -am "через -am"').output).toContain('1 file changed')
  })

  it('состояние после коммита: новый коммит с родителем, деревом индекса и моментом; ветка двинулась; журнал и часы', () => {
    const before = run(dirty(), 'git add app.js').state
    const parent = currentCommitId(before)
    const after = run(before, 'git commit -m "Правка"').state
    const id = currentCommitId(after)
    expect(id).toMatch(/^[0-9a-f]{40}$/)
    expect(commitOf(after, id)).toMatchObject({ parents: [parent], message: 'Правка', tree: before.index, clock: 4 })
    expect(after.branches.master).toBe(id)
    expect(after.branches.feature).toBe(before.branches.feature)
    expect(after.clock).toBe(5)
    expect(after.reflog[0]).toEqual({ id, message: 'commit: Правка' })
    expect(after.reflog.slice(1)).toEqual(before.reflog)
    expect(after.index).toEqual(before.index)
    expect(after.working).toEqual(before.working)
    expect(headTree(after)).toEqual(before.index)
  })

  it('коммит на feature двигает только feature', () => {
    const s = runAll(fresh(), ['git checkout feature'])
    const edited = { ...s, working: { ...s.working, 'app.js': 'z\n' } }
    const after = runAll(edited, ['git commit -am "На feature"'])
    expect(after.branches.master).toBe(s.branches.master)
    expect(after.branches.feature).not.toBe(s.branches.feature)
    expect(after.reflog[0].message).toBe('commit: На feature')
  })

  it('коммит в отсоединённом HEAD: [detached HEAD <id7>], ветки не двигаются (П8.19)', () => {
    const s = fresh()
    const base = idOf(s, seed.baseMessage)
    const d = detachedAt(s, base)
    const edited = { ...d, index: commitOf(d, base).tree, working: { 'app.js': 'q\n' } }
    const r = run(edited, 'git commit -am "В отсоединённом"')
    expect(r.result.output).toMatch(/^\[detached HEAD [0-9a-f]{7}\] В отсоединённом$/)
    expect(r.state.branches).toEqual(edited.branches)
    expect(r.state.head.kind).toBe('detached')
    expect(protocolEntry('П8.19', 'git add app.js; git commit -m "Правка в отсоединённом HEAD"').output.split('\n')[0]).toMatch(/^\[detached HEAD [0-9a-f]{7}\] /)
  })

  it(`-a подготавливает изменённые и удалённые отслеживаемые файлы, неотслеживаемые не берёт (${where('П8.26', 'git commit -a -m "через -a и -m"')})`, () => {
    const s = fresh()
    const state = { ...s, working: { 'app.js': 'x\n', 'n.txt': 'n\n' } }
    const after = run(state, 'git commit -a -m "m"').state
    expect(headTree(after)).toEqual({ 'app.js': 'x\n' })
    expect(after.working['n.txt']).toBe('n\n')
  })

  it('формы -am, -a -m, --all --message, --message=…, -m<сообщение> дают тот же коммит', () => {
    const forms = ['git commit -am "m"', 'git commit -a -m "m"', 'git commit --all --message "m"', 'git commit --all --message=m', 'git commit -a -mm']
    const ids = forms.map((f) => currentCommitId(run(dirty(), f).state))
    expect(new Set(ids).size).toBe(1)
  })

  it(`ведущие пробелы сообщения остаются, хвостовые срезаются (${where('П8.26', 'git commit -m "  лид"')})`, () => {
    const staged = run(dirty(), 'git add app.js').state
    const r = run(staged, 'git commit -m "  лид  "')
    expect(r.result.output).toMatch(/^\[master [0-9a-f]{7}\]   лид$/)
    expect(commitOf(r.state, currentCommitId(r.state)).message).toBe('  лид')
  })

  it(`-m без значения: error: switch \`m' requires a value, код 129 (${where('П8.26', 'git commit -m')})`, () => {
    const r = run(dirty(), 'git commit -m').result
    expect(r.output).toBe("error: switch `m' requires a value")
    expect(r.exitCode).toBe(129)
    expect(protocolEntry('П8.26', 'git commit -m').exitCode).toBe(129)
  })

  it('лишнее слово (путь), второй -m, неизвестный ключ, сообщение из нескольких строк — отказ области', () => {
    const staged = run(dirty(), 'git add app.js').state
    for (const form of ['git commit -m x extra', 'git commit -m a -m b', 'git commit -m a --amend', 'git commit -v -m a', 'git commit -z']) {
      const r = run(staged, form)
      expect(r.result.exitCode, form).toBeUndefined()
      refusal(r.result.output)
      expect(r.state.commits, form).toEqual(staged.commits)
    }
    const multiline = run(staged, 'git commit -m "a\nb"').result
    refusal(multiline.output)
  })

  it('одинаковая правка с одинаковым сообщением на разных моментах получает разные id', () => {
    const a = run(run(dirty(), 'git add app.js').state, 'git commit -m "m"').state
    const b = run(run({ ...a, working: { ...a.working, 'app.js': 'console.log("v1"); + правка\n' }, index: { ...a.index } }, 'git add app.js').state, 'git commit -m "m"')
    expect(b.result.output).toContain('nothing to commit')
    const c = run({ ...a, working: { ...a.working, 'app.js': 'другое\n' } }, 'git commit -am "m"').state
    expect(currentCommitId(c)).not.toBe(currentCommitId(a))
  })
})

describe('git branch', () => {
  it(`список: ветки по алфавиту, текущая со звёздочкой (${where('П8.28', 'git branch')})`, () => {
    const r = run(fresh(), 'git branch').result
    expect(r.output).toBe('  feature\n* master')
    expect(r.exitCode).toBe(0)
    expect(protocolEntry('П8.28', 'git branch').output).toBe('  feature\n* master')
  })

  it(`отсоединённый HEAD: первой строкой * (HEAD detached at <id7>) (${where('П8.19', 'git branch')})`, () => {
    const s = fresh()
    const base = idOf(s, seed.baseMessage)
    const out = run(detachedAt(s, base), 'git branch').result.output.split('\n')
    expect(out).toEqual([`* (HEAD detached at ${base.slice(0, 7)})`, '  feature', '  master'])
  })

  it(`git branch <имя>: ветка на коммите HEAD, вывод пустой, журнал HEAD не меняется (${where('П8.15', 'git branch topic master~1')})`, () => {
    const s = fresh()
    const r = run(s, 'git branch topic')
    expect(r.result).toMatchObject({ output: '', exitCode: 0, ok: true })
    expect(r.state.branches.topic).toBe(s.branches.master)
    expect(r.state.reflog).toEqual(s.reflog)
    expect(r.state.head).toEqual(s.head)
  })

  it('git branch <имя> <ссылка>: HEAD~1, ветка, тег (в том числе аннотированный), начало id', () => {
    const s = runAll(fresh(), ['git tag v1 feature', 'git tag -a v2 -m "Релиз" HEAD~1'])
    const base = idOf(s, seed.baseMessage)
    expect(run(s, 'git branch a master~1').state.branches.a).toBe(base)
    expect(run(s, 'git branch a feature').state.branches.a).toBe(s.branches.feature)
    expect(run(s, 'git branch a v1').state.branches.a).toBe(s.branches.feature)
    expect(run(s, 'git branch a v2').state.branches.a).toBe(base)
    expect(run(s, `git branch a ${base.slice(0, 7)}`).state.branches.a).toBe(base)
    expect(run(s, 'git branch a HEAD').state.branches.a).toBe(s.branches.master)
  })

  it(`уже есть: fatal: a branch named … already exists, код 128 (${where('П8.28', 'git branch topic')})`, () => {
    const s = runAll(fresh(), ['git branch topic'])
    const r = run(s, 'git branch topic')
    expect(r.result.output).toBe("fatal: a branch named 'topic' already exists")
    expect(r.result.exitCode).toBe(128)
    expect(r.state.branches).toEqual(s.branches)
  })

  const invalid: [string, string][] = [
    ['git branch "a b"', "fatal: 'a b' is not a valid branch name"],
    ['git branch v1..2', "fatal: 'v1..2' is not a valid branch name"],
    ['git branch HEAD', "fatal: 'HEAD' is not a valid branch name"],
    ['git branch -- -x', "fatal: '-x' is not a valid branch name"],
    ['git branch x~1', "fatal: 'x~1' is not a valid branch name"],
    ['git branch x.lock', "fatal: 'x.lock' is not a valid branch name"],
  ]
  for (const [command, first] of invalid) {
    it(`недопустимое имя: ${command} → три строки, код 128 (${where('П8.28', command)})`, () => {
      const r = run(fresh(), command).result
      expect(r.output).toBe(protocolEntry('П8.28', command).output)
      expect(r.output.split('\n')[0]).toBe(first)
      expect(r.exitCode).toBe(128)
    })
  }

  it(`порядок проверок: имя недопустимо раньше, чем ссылка не найдена; «уже есть» раньше ссылки (${where('П8.28', 'git branch "a b" nosuch')}, ${where('П8.28', 'git branch topic nosuch')})`, () => {
    const s = runAll(fresh(), ['git branch topic'])
    expect(run(s, 'git branch "a b" nosuch').result.output).toBe(protocolEntry('П8.28', 'git branch "a b" nosuch').output)
    expect(run(s, 'git branch topic nosuch').result.output).toBe("fatal: a branch named 'topic' already exists")
  })

  it(`ссылки нет: fatal: not a valid object name, код 128 (${where('П8.28', 'git branch topic2 nosuch')}, ${where('П8.28', 'git branch hh HEAD~9')})`, () => {
    const s = fresh()
    for (const [token, entry] of [['nosuch', 'git branch topic2 nosuch'], ['HEAD~9', 'git branch hh HEAD~9']]) {
      const r = run(s, `git branch x ${token}`).result
      expect(r.output).toBe(`fatal: not a valid object name: '${token}'`)
      expect(r.exitCode).toBe(128)
      expect(protocolEntry('П8.28', entry).output).toBe(r.output)
    }
  })

  it('ссылка в записи, которую модель не разбирает, — отказ области', () => {
    const r = run(fresh(), 'git branch x HEAD@{1}~1').result
    refusal(r.output)
    expect(r.exitCode).toBeUndefined()
  })

  it('имя с «/» и имя, совпадающее с тегом, — отказ области, а не выдуманная ошибка', () => {
    refusal(run(fresh(), 'git branch feature/x').result.output)
    const tagged = runAll(fresh(), ['git tag v1'])
    refusal(run(tagged, 'git branch v1').result.output)
  })

  it('ключи (-a, -v, --list, -d вместе с -D, --delete) и три слова — отказ области', () => {
    for (const form of ['git branch -d -D feature', 'git branch --delete feature', 'git branch -a', 'git branch -v', 'git branch --list', 'git branch a b c']) {
      const r = run(fresh(), form).result
      expect(r.exitCode, form).toBeUndefined()
      refusal(r.output)
    }
  })
})

describe('git checkout', () => {
  it(`переход на ветку: Switched to branch, код 0, HEAD и деревья меняются (${where('П8.28', 'git checkout topic')})`, () => {
    const s = runAll(fresh(), ['git branch topic master~1'])
    const r = run(s, 'git checkout topic')
    expect(r.result).toMatchObject({ output: "Switched to branch 'topic'", exitCode: 0 })
    expect(r.state.head).toEqual({ kind: 'branch', name: 'topic' })
    expect(r.state.working).toEqual({ 'app.js': 'console.log("v1");\n' })
    expect(r.state.index).toEqual(r.state.working)
  })

  it(`уже на ветке: Already on '…' (${where('П8.28', 'git checkout topic', 1)})`, () => {
    const r = run(fresh(), 'git checkout master').result
    expect(r.output).toBe("Already on 'master'")
    expect(r.exitCode).toBe(0)
  })

  it('запись журнала HEAD: checkout: moving from <откуда> to <куда>, id — коммит после перехода; lastCheckout обновляется (П8.1, П8.15)', () => {
    const s = fresh()
    const after = run(s, 'git checkout feature').state
    expect(after.reflog[0]).toEqual({ id: s.branches.feature, message: 'checkout: moving from master to feature' })
    expect(after.reflog.slice(1)).toEqual(s.reflog)
    expect(after.lastCheckout).toEqual({ spec: 'feature', id: s.branches.feature })
  })

  it(`переход на ту же ветку тоже пишет запись «moving from topic to topic» (${where('П8.28', 'git reflog -3')})`, () => {
    const s = runAll(fresh(), ['git checkout feature'])
    const after = run(s, 'git checkout feature').state
    expect(after.reflog[0].message).toBe('checkout: moving from feature to feature')
    expect(protocolEntry('П8.28', 'git reflog -3').output.split('\n')[0]).toContain('checkout: moving from topic to topic')
  })

  it(`ветки нет: error: pathspec … did not match any file(s) known to git, код 1 (${where('П8.28', 'git checkout nosuch')})`, () => {
    const r = run(fresh(), 'git checkout nosuch').result
    expect(r.output).toBe("error: pathspec 'nosuch' did not match any file(s) known to git")
    expect(r.exitCode).toBe(1)
  })

  it(`git checkout -b <имя>: Switched to a new branch, ветка на коммите HEAD, запись в журнале (${where('П8.28', 'git checkout -b new1')}, ${where('П8.15', 'git checkout -b hotfix')})`, () => {
    const s = fresh()
    const r = run(s, 'git checkout -b new1')
    expect(r.result).toMatchObject({ output: "Switched to a new branch 'new1'", exitCode: 0 })
    expect(r.state.branches.new1).toBe(s.branches.master)
    expect(r.state.head).toEqual({ kind: 'branch', name: 'new1' })
    expect(r.state.reflog[0].message).toBe('checkout: moving from master to new1')
    expect(r.state.lastCheckout).toEqual({ spec: 'new1', id: s.branches.master })
  })

  it(`-b: ветка уже есть → fatal …already exists, 128; недопустимое имя → три строки, 128; -b без значения → 129 (${where('П8.28', 'git checkout -b topic')}, ${where('П8.28', 'git checkout -b')})`, () => {
    const s = runAll(fresh(), ['git branch topic'])
    expect(run(s, 'git checkout -b topic').result).toMatchObject({ output: "fatal: a branch named 'topic' already exists", exitCode: 128 })
    expect(run(s, 'git checkout -b "a b"').result.output).toBe(protocolEntry('П8.28', 'git checkout -b "a b"').output)
    expect(run(s, 'git checkout -b').result).toMatchObject({ output: "error: switch `b' requires a value", exitCode: 129 })
    expect(run(s, 'git checkout -b').state.head).toEqual(s.head)
  })

  it('-b: имя с «/», совпадающее с тегом, начало от другой ссылки и склеенная форма — отказ области', () => {
    const tagged = runAll(fresh(), ['git tag v1'])
    for (const form of ['git checkout -b a/b', 'git checkout -b v1', 'git checkout -b x feature', 'git checkout -bx']) {
      const r = run(tagged, form).result
      expect(r.exitCode, form).toBeUndefined()
      refusal(r.output)
    }
  })

  it(`подготовленный новый файл переезжает на другую ветку, перед Switched строка A\\t<файл> (${where('П8.28', 'git checkout feature')})`, () => {
    const s = runAll(fresh(), [])
    const state = { ...s, index: { ...s.index, 'x.txt': 'новый файл\n' }, working: { ...s.working, 'x.txt': 'новый файл\n' } }
    const r = run(state, 'git checkout feature')
    expect(r.result.output).toBe("A\tx.txt\nSwitched to branch 'feature'")
    expect(protocolEntry('П8.28', 'git checkout feature').output).toBe(r.result.output)
    expect(r.state.index['x.txt']).toBe('новый файл\n')
    expect(r.state.working['x.txt']).toBe('новый файл\n')
  })

  it('-b форма из двух слов перенесённые файлы не перечисляет (П8.28: git checkout -b nb)', () => {
    const s = fresh()
    const state = { ...s, index: { ...s.index, 'x.txt': 'x\n' }, working: { ...s.working, 'x.txt': 'x\n' } }
    expect(run(state, 'git checkout -b nb').result.output).toBe("Switched to a new branch 'nb'")
  })

  it(`правка app.js переезжает на ветку, где app.js такой же: M\\tapp.js (${where('П8.28', 'git checkout topic', 2)})`, () => {
    const s = runAll(fresh(), ['git branch topic master~1'])
    const state = { ...s, working: { ...s.working, 'app.js': 'правка\n' } }
    const r = run(state, 'git checkout topic')
    expect(r.result.output).toBe("M\tapp.js\nSwitched to branch 'topic'")
    expect(r.state.working['app.js']).toBe('правка\n')
    expect(r.state.index['app.js']).toBe('console.log("v1");\n')
  })

  it(`на той же ветке: M\\t<файл> и Already on (${where('П8.28', 'git checkout master')})`, () => {
    const s = fresh()
    const state = { ...s, working: { ...s.working, 'app.js': 'правка\n' } }
    expect(run(state, 'git checkout master').result.output).toBe("M\tapp.js\nAlready on 'master'")
    // В протоколе рядом стоит подготовленный x.txt: A\tx.txt.
    const entry = protocolBlock('П8.28').find((e) => e.command === 'git checkout master' && e.output.includes("Already on 'master'"))
    expect(entry?.output).toBe("M\tapp.js\nA\tx.txt\nAlready on 'master'")
  })

  it(`отказ: правка app.js затёрлась бы — would be overwritten by checkout, код 1, ничего не меняется (${where('П8.28', 'git checkout feature', 1)})`, () => {
    const s = fresh()
    const state = { ...s, working: { ...s.working, 'app.js': 'правка\n' } }
    const r = run(state, 'git checkout feature')
    expect(r.result.output).toBe(
      ['error: Your local changes to the following files would be overwritten by checkout:', '\tapp.js', 'Please commit your changes or stash them before you switch branches.', 'Aborting'].join('\n'),
    )
    expect(r.result.exitCode).toBe(1)
    expect(r.state.head).toEqual(state.head)
    expect(r.state.working).toEqual(state.working)
    expect(r.state.reflog).toEqual(state.reflog)
  })

  it(`отказ: неотслеживаемый README.md мешает файлу цели (${where('П8.28', 'git checkout master')})`, () => {
    const s = runAll(fresh(), ['git checkout feature'])
    const state = { ...s, working: { ...s.working, 'README.md': 'мой\n' } }
    const r = run(state, 'git checkout master')
    expect(r.result.output).toBe(
      ['error: The following untracked working tree files would be overwritten by checkout:', '\tREADME.md', 'Please move or remove them before you switch branches.', 'Aborting'].join('\n'),
    )
    expect(r.result.exitCode).toBe(1)
    expect(r.state.working['README.md']).toBe('мой\n')
  })

  it(`обе причины сразу: сначала правки, потом неотслеживаемые, один Aborting (${where('П8.32', 'git checkout feature')})`, () => {
    const s = fresh()
    const state = { ...s, working: { ...s.working, 'app.js': 'правка\n', 'about.html': 'мой\n' } }
    const r = run(state, 'git checkout feature').result
    expect(r.output).toBe(protocolEntry('П8.32', 'git checkout feature').output)
    expect(r.exitCode).toBe(1)
  })

  it('переход из отсоединённого HEAD на ветку: Previous HEAD position was … и Switched (П8.15, П8.19)', () => {
    const s = fresh()
    const base = idOf(s, seed.baseMessage)
    const r = run(detachedAt({ ...s, index: commitOf(s, base).tree, working: commitOf(s, base).tree }, base), 'git checkout master')
    expect(r.result.output).toBe(`Previous HEAD position was ${base.slice(0, 7)} ${seed.baseMessage}\nSwitched to branch 'master'`)
    expect(r.state.head).toEqual({ kind: 'branch', name: 'master' })
    expect(r.state.reflog[0].message).toBe(`checkout: moving from ${base} to master`)
  })

  it(`тег, id, HEAD~1 отсоединяют HEAD с блоком Note, ветки на месте; HEAD с ветки ничего не меняет (${where('П8.19', 'git checkout master', 0)}, ${where('П8.57', 'git checkout HEAD')})`, () => {
    const s = runAll(fresh(), ['git tag v1.0.0 HEAD~1'])
    const base = idOf(s, seed.baseMessage)
    for (const target of ['v1.0.0', base.slice(0, 7), 'HEAD~1']) {
      const r = run(s, `git checkout ${target}`)
      expect(r.result.exitCode, target).toBe(0)
      expect(r.result.output, target).toContain(`Note: switching to '${target}'.`)
      expect(r.state.head, target).toEqual({ kind: 'detached', id: base })
      expect(r.state.branches, target).toEqual(s.branches)
    }
    const stay = run(s, 'git checkout HEAD')
    expect(stay.result).toMatchObject({ ok: true, output: '', exitCode: 0 })
    expect(stay.state.head).toEqual(s.head)
    expect(stay.state.reflog).toEqual(s.reflog)
  })

  it('ключи, без аргументов, два слова, выражение вне грамматики — отказ области', () => {
    for (const form of ['git checkout HEAD@{1}~1', 'git checkout -f feature', 'git checkout --detach -f', 'git checkout - x', 'git checkout', 'git checkout feature master']) {
      const r = run(fresh(), form).result
      expect(r.exitCode, form).toBeUndefined()
      refusal(r.output)
    }
  })
})

// Восстановление файла командой checkout разобрано в appendixRestore.test.ts; здесь — как
// handleCheckout отличает файл от ветки и ссылки.
describe('git checkout: файл, ветка и ссылка', () => {
  it('имя файла и `--` возвращают файл из индекса; `ссылка -- файл` берёт файл из коммита — отказ области', () => {
    const s = fresh()
    const edited = { ...s, working: { ...s.working, 'app.js': 'правка\n' } }
    for (const form of ['git checkout app.js', 'git checkout -- app.js']) {
      const r = run(edited, form)
      expect(r.result.exitCode, form).toBe(0)
      expect(r.state.working['app.js'], form).toBe(seed.appBase)
    }
    const refused = run(edited, 'git checkout feature -- app.js')
    expect(refused.result.exitCode).toBeUndefined()
    refusal(refused.result.output)
    expect(refused.state.working['app.js']).toBe('правка\n')
  })

  it('имя, которого нет среди веток и коммитов, — путь: ошибка pathspec, если файл не в индексе (П8.28, П8.55)', () => {
    expect(run(fresh(), 'git checkout about.html').result).toMatchObject({ output: "error: pathspec 'about.html' did not match any file(s) known to git", exitCode: 1 })
  })

  it('ветка и ещё слово — отказ области, а не переход', () => {
    const r = run(fresh(), 'git checkout feature app.js')
    refusal(r.result.output)
    expect(r.state.head).toEqual({ kind: 'branch', name: 'master' })
  })
})

describe('git diff', () => {
  const edited = (): AppendixState => {
    const s = fresh()
    return { ...s, working: { ...s.working, 'app.js': 'console.log("v1"); + правка\n' } }
  }

  it(`без ключей: рабочий каталог против индекса (${where('П8.31', 'git diff', 1)})`, () => {
    const r = run(edited(), 'git diff').result
    expect(r.exitCode).toBe(0)
    expect(r.output.split('\n').filter((l) => !l.startsWith('index '))).toEqual(
      ['diff --git a/app.js b/app.js', '--- a/app.js', '+++ b/app.js', '@@ -1 +1 @@', '-console.log("v1");', '+console.log("v1"); + правка'],
    )
  })

  it('чисто или всё подготовлено — пустой вывод, код 0 (П8.31)', () => {
    expect(run(fresh(), 'git diff').result).toMatchObject({ output: '', exitCode: 0 })
    const staged = run(edited(), 'git add app.js').state
    expect(run(staged, 'git diff').result.output).toBe('')
  })

  it(`--staged и --cached: индекс против HEAD (${where('П8.31', 'git diff --staged')}, ${where('П8.31', 'git diff --cached')})`, () => {
    const staged = run(edited(), 'git add app.js').state
    const a = run(staged, 'git diff --staged').result.output
    expect(a).toContain('+console.log("v1"); + правка')
    expect(run(staged, 'git diff --cached').result.output).toBe(a)
    expect(run(edited(), 'git diff --staged').result.output).toBe('')
  })

  it(`удалённый файл показан как deleted file mode, новый неотслеживаемый — нет (${where('П8.31', 'git diff', 3)})`, () => {
    const s = fresh()
    const state = { ...s, working: { 'app.js': s.working['app.js'], 'new.txt': 'x\n' } }
    const out = run(state, 'git diff').result.output
    expect(out).toContain('deleted file mode 100644')
    expect(out).toContain('--- a/README.md')
    expect(out).not.toContain('new.txt')
  })

  it('удалённый и добавленный файлы в --staged — отказ области про переименование', () => {
    const s = fresh()
    const state = { ...s, index: { 'app.js': s.index['app.js'], 'y.txt': 'новый файл\n' } }
    const r = run(state, 'git diff --staged').result
    refusal(r.output)
    expect(r.exitCode).toBeUndefined()
  })

  it('пути, ревизии и другие ключи — отказ области', () => {
    for (const form of ['git diff app.js', 'git diff HEAD', 'git diff feature', 'git diff --stat', 'git diff -- app.js']) {
      const r = run(edited(), form).result
      expect(r.exitCode, form).toBeUndefined()
      refusal(r.output)
    }
  })
})
