// Тайники раздела 8 (target.md, часть X, места 7–12). Вывод git сверен с протоколами:
// section8-git-runs.txt (П8.3, П8.14, П8.19) и appendix-g18e2-git-runs.txt (П8.41–П8.52). Блоки
// П8.41–П8.52 целиком проигрываются в appendixProtocol.test.ts; здесь — дословные строки по
// номерам в протоколе, правила модели, состояние и отказы области.
import { describe, expect, it } from 'vitest'
import { compareOutputs, fresh, normalizeGitOutput, protocolBlock, protocolEntry, run, runAll, where, type IdMap } from './appendixProtocolKit'
import { createAppendixFile, deleteAppendixFile, editAppendixFile, getAppendixMissions, getStashes } from './appendixSection'
import type { AppendixState } from './appendixSection'
import { currentCommitId } from './appendixRepo'
import { ru } from '../locales/ru'

const refusal = (output: string) => expect(output.startsWith('[тренажёр]')).toBe(true)
const edit = (state: AppendixState, file = 'app.js') => editAppendixFile(state, file)
const seed = ru.appendix.seed

/** Выполняет команду и сверяет вывод и код возврата с записью протокола. */
function same(state: AppendixState, block: string, command: string, ids: IdMap, nth = 0, as = command): AppendixState {
  const entry = protocolEntry(block, command, nth)
  const next = run(state, as)
  const where_ = `${entry.file}:${entry.line} ${command}`
  expect(next.result.exitCode, `${where_} код возврата`).toBe(entry.exitCode)
  expect(compareOutputs(normalizeGitOutput(command, entry.output), normalizeGitOutput(command, next.result.output), ids), where_).toBeNull()
  return next.state
}

/** Состояние без истории терминала: для проверки, что команда ничего не изменила. */
const bare = (s: AppendixState) => ({ ...s, history: [] })

describe('П8.3: дословный сценарий тайников', () => {
  it(`прятать нечего, спрятано, список, два тайника, apply, отказ apply, drop, ошибки, pop, clear (${where('П8.3', 'git stash')} и далее)`, () => {
    const ids: IdMap = new Map()
    let s = fresh()
    // Чистое дерево: код 0 и пустой список.
    s = same(s, 'П8.3', 'git stash', ids, 0)
    s = same(s, 'П8.3', 'git stash list', ids, 0)
    expect(s.stashes).toEqual([])
    expect(getAppendixMissions(s).map((m) => m.done)).toEqual([false, false, false, false])
    // Правка, `git stash`, затем вторая правка и `-m`, список из двух.
    s = same(edit(s), 'П8.3', 'git stash', ids, 1)
    expect(s.working).toEqual(s.index)
    s = same(edit(s), 'П8.3', 'edit; git stash -m "вторая правка"', ids, 0, 'git stash -m "вторая правка"')
    s = same(s, 'П8.3', 'git stash list', ids, 1)
    // apply оставляет оба тайника, повторный apply отказывает.
    s = same(s, 'П8.3', 'git stash apply', ids, 0)
    s = same(s, 'П8.3', 'git stash list', ids, 2)
    const refused = same(s, 'П8.3', 'git stash apply', ids, 1)
    expect(bare(refused)).toEqual(bare(s))
    s = run(s, 'git checkout -- app.js').state
    // drop со ссылкой: `Dropped stash@{1} (<id>)`, ошибки ссылок.
    s = same(s, 'П8.3', 'git stash drop stash@{1}', ids)
    s = same(s, 'П8.3', 'git stash list', ids, 4)
    s = same(s, 'П8.3', 'git stash drop stash@{5}', ids)
    s = same(s, 'П8.3', 'git stash pop stash@x', ids)
    // pop 0: статус и `Dropped refs/stash@{0} (<id>)`.
    s = same(s, 'П8.3', 'git stash pop 0', ids)
    s = same(s, 'П8.3', 'git stash list', ids, 5)
    // Пустая стопка: pop, pop, drop, apply.
    for (const [command, nth] of [['git stash pop', 0], ['git stash pop', 1], ['git stash drop', 0], ['git stash apply', 2]] as const) s = same(s, 'П8.3', command, ids, nth)
    // Правка, тайник, clear.
    s = edit(s)
    const saved = run(s, 'git stash')
    s = saved.state
    const combined = protocolEntry('П8.3', 'edit; git stash; git stash list')
    expect(compareOutputs(combined.output, `${saved.result.output}\n${run(s, 'git stash list').result.output}`, ids), `${combined.file}:${combined.line}`).toBeNull()
    s = same(s, 'П8.3', 'git stash clear', ids)
    s = same(s, 'П8.3', 'git stash list', ids, 6)
    expect(s.stashes).toEqual([])
  })

  it(`неотслеживаемый файл git stash не берёт; push -m и save; pop с отказом и строкой про тайник (${where('П8.3', 'echo new > untracked.txt; git stash')})`, () => {
    const ids: IdMap = new Map()
    let s = createAppendixFile(fresh(), 'untracked.txt')
    s = same(s, 'П8.3', 'echo new > untracked.txt; git stash', ids, 0, 'git stash')
    expect(s.working['untracked.txt']).toBe(`${ru.fileOps.newFileContent}\n`)
    expect(s.stashes).toEqual([])
    s = deleteAppendixFile(s, 'untracked.txt')
    s = same(edit(s), 'П8.3', 'rm untracked.txt; edit; git stash push -m msg', ids, 0, 'git stash push -m msg')
    s = same(edit(s), 'П8.3', 'edit; git stash save "старый стиль"', ids, 0, 'git stash save "старый стиль"')
    s = same(s, 'П8.3', 'git stash list', ids, 7)
    s = same(s, 'П8.3', 'git stash pop', ids, 3)
    const refused = same(s, 'П8.3', 'git stash pop', ids, 4)
    expect(refused.stashes).toHaveLength(1)
    expect(bare(refused)).toEqual(bare(s))
  })

  it('отказ pop из-за правки: статус стоит перед строкой про тайник, у apply этой строки нет (место 9)', () => {
    const s = run(edit(fresh()), 'git stash').state
    const dirty = edit(s)
    const pop = run(dirty, 'git stash pop').result
    const lines = pop.output.split('\n')
    expect(lines[0]).toBe('error: Your local changes to the following files would be overwritten by merge:')
    expect(lines.at(-1)).toBe('The stash entry is kept in case you need it again.')
    expect(pop.exitCode).toBe(1)
    const apply = run(dirty, 'git stash apply').result
    expect(apply.output).not.toContain('The stash entry is kept')
    expect(apply.exitCode).toBe(1)
    expect(apply.explanation).toBe(ru.appendix.explain.stashRefusedEdit)
  })
})

describe('создание тайника', () => {
  it('текст WIP: ветка, id7 коммита и заголовок; id тайника — 40 знаков (П8.3)', () => {
    const s = run(edit(fresh()), 'git stash').state
    const [stash] = s.stashes
    expect(stash.id).toMatch(/^[0-9a-f]{40}$/)
    expect(stash.text).toBe(`WIP on master: ${currentCommitId(s).slice(0, 7)} ${seed.readmeMessage}`)
    expect(stash.branch).toBe('master')
    expect(stash.base).toBe(currentCommitId(s))
  })

  it('сохраняются индекс и рабочие версии отслеживаемых файлов; неотслеживаемые остаются (П8.3, П8.47)', () => {
    let s = createAppendixFile(edit(fresh()), 'u.txt')
    s = run(s, 'git stash').state
    const [stash] = s.stashes
    expect(stash.work['app.js']).toBe(`console.log("v1"); + правка\n`)
    expect(stash.index['app.js']).toBe(seed.appBase)
    expect(stash.work).not.toHaveProperty('u.txt')
    expect(s.working['app.js']).toBe(seed.appBase)
    expect(s.working['u.txt']).toBe(`${ru.fileOps.newFileContent}\n`)
    expect(s.index).toEqual({ 'app.js': seed.appBase, 'README.md': seed.readme })
  })

  it('MM: тайник хранит и подготовленную, и рабочую версию; pop возвращает рабочую неподготовленной (П8.47)', () => {
    let s = edit(fresh())
    s = run(s, 'git add app.js').state
    s = edit(s)
    const staged = s.index['app.js']
    s = run(s, 'git stash').state
    expect(s.stashes[0].index['app.js']).toBe(staged)
    expect(s.stashes[0].work['app.js']).toBe(`console.log("v1"); + правка + правка\n`)
    const popped = run(s, 'git stash pop').state
    expect(popped.working['app.js']).toBe(`console.log("v1"); + правка + правка\n`)
    expect(popped.index['app.js']).toBe(seed.appBase)
    expect(run(popped, 'git status --short').result.output).toBe(' M app.js')
  })

  it('подготовленный новый файл возвращается подготовленным (new file), удалённый из каталога — удалённым (П8.47)', () => {
    let s = createAppendixFile(fresh(), 'n.txt')
    s = run(s, 'git add n.txt').state
    s = run(s, 'git stash').state
    expect(s.working).not.toHaveProperty('n.txt')
    expect(s.index).not.toHaveProperty('n.txt')
    s = run(s, 'git stash pop').state
    expect(run(s, 'git status --short').result.output).toBe('A  n.txt')

    let d = deleteAppendixFile(fresh(), 'app.js')
    d = run(d, 'git stash').state
    expect(d.working['app.js']).toBe(seed.appBase)
    d = run(d, 'git stash pop').state
    expect(run(d, 'git status --short').result.output).toBe(' D app.js')
  })

  it('подготовленное удаление: после pop удаление не подготовлено (П8.47)', () => {
    let s = deleteAppendixFile(fresh(), 'README.md')
    s = run(s, 'git add README.md').state
    s = run(s, 'git stash').state
    expect(s.index).toHaveProperty('README.md')
    s = run(s, 'git stash pop').state
    expect(run(s, 'git status --short').result.output).toBe(' D README.md')
  })

  it('файл удалён из индекса и создан заново — отказ области, ничего не меняется (П8.48)', () => {
    let s = deleteAppendixFile(fresh(), 'README.md')
    s = run(s, 'git add README.md').state
    s = createAppendixFile(s, 'README.md')
    const r = run(s, 'git stash')
    refusal(r.result.output)
    expect(r.result.exitCode).toBeUndefined()
    expect(bare(r.state)).toEqual(bare(s))
    // Настоящий git на этом сочетании сохранил тайник и затёр новый файл версией из HEAD (П8.48).
    expect(protocolBlock('П8.48').at(-2)?.command).toBe('git stash')
  })

  it('id тайников разные даже при одинаковых правках; логические часы растут (место 7)', () => {
    let s = run(edit(fresh()), 'git stash').state
    const clock = s.clock
    s = run(edit(s), 'git stash').state
    expect(s.clock).toBe(clock + 1)
    expect(s.stashes[0].id).not.toBe(s.stashes[1].id)
    expect(getStashes(s).map((t) => t.ref)).toEqual(['stash@{0}', 'stash@{1}'])
    expect(getStashes(s)[0]).toMatchObject({ id: s.stashes[0].id, shortId: s.stashes[0].id.slice(0, 7), text: s.stashes[0].text, branch: 'master' })
  })

  it('отсоединённый HEAD: WIP on (no branch): <id7> <заголовок>, в журнал HEAD ничего (П8.19)', () => {
    const base = Object.values(fresh().commits).find((c) => c.message === seed.baseMessage)!
    let s: AppendixState = { ...fresh(), head: { kind: 'detached', id: base.id }, lastCheckout: { spec: base.id.slice(0, 7), id: base.id }, index: base.tree, working: base.tree }
    s = edit(s)
    const reflog = s.reflog
    const r = run(s, 'git stash')
    expect(r.result.output).toBe(`Saved working directory and index state WIP on (no branch): ${base.id.slice(0, 7)} ${seed.baseMessage}`)
    expect(r.state.stashes[0].text).toBe(`WIP on (no branch): ${base.id.slice(0, 7)} ${seed.baseMessage}`)
    expect(r.state.reflog).toBe(reflog)
    const entry = protocolEntry('П8.19', 'git stash list')
    expect(entry.output.startsWith('stash@{0}: WIP on (no branch): ')).toBe(true)
  })
})

describe('журнал HEAD (П8.14)', () => {
  it('git stash и git stash -m на ветке пишут reset: moving to HEAD; pop, apply, drop, clear — ничего', () => {
    const s0 = fresh()
    let s = run(edit(s0), 'git stash').state
    expect(s.reflog[0]).toEqual({ id: currentCommitId(s0), message: 'reset: moving to HEAD' })
    expect(s.reflog.slice(1)).toEqual(s0.reflog)
    s = run(edit(s), 'git stash -m "с сообщением"').state
    expect(s.reflog.slice(0, 2).map((e) => e.message)).toEqual(['reset: moving to HEAD', 'reset: moving to HEAD'])
    const length = s.reflog.length
    for (const command of ['git stash apply', 'git stash list', 'git stash drop', 'git stash pop', 'git stash clear']) {
      s = run(s, command).state
      if (command === 'git stash apply') s = run(s, 'git checkout -- app.js').state
      expect(s.reflog, command).toHaveLength(length)
    }
    const lines = protocolEntry('П8.14', 'git reflog -2', 1).output.split('\n')
    expect(lines.map((l) => l.slice(l.indexOf('}: ') + 3))).toEqual(['reset: moving to HEAD', 'commit: Добавить README'])
  })

  it('«прятать нечего» журнал не трогает', () => {
    const s = fresh()
    expect(run(s, 'git stash').state.reflog).toBe(s.reflog)
  })
})

describe('apply и pop', () => {
  it('apply оставляет тайник, pop убирает; тот же статус в обоих (П8.3, место 8)', () => {
    const stashed = run(edit(fresh()), 'git stash').state
    const applied = run(stashed, 'git stash apply')
    expect(applied.state.stashes).toHaveLength(1)
    const popped = run(stashed, 'git stash pop')
    expect(popped.state.stashes).toHaveLength(0)
    const [status, dropped] = [popped.result.output.split('\n').slice(0, -1).join('\n'), popped.result.output.split('\n').at(-1)]
    expect(status).toBe(applied.result.output)
    expect(dropped).toBe(`Dropped refs/stash@{0} (${stashed.stashes[0].id})`)
    expect(applied.state.working).toEqual(popped.state.working)
  })

  it('не вершина стопки: apply stash@{1} применяет второй тайник; pop stash@{1} убирает второй (П8.41)', () => {
    let s = run(edit(fresh(), 'README.md'), 'git stash -m "readme"').state
    s = run(edit(s), 'git stash -m "app"').state
    const readmeId = s.stashes[1].id
    const popped = run(s, 'git stash pop stash@{1}')
    expect(popped.result.output.split('\n').at(-1)).toBe(`Dropped stash@{1} (${readmeId})`)
    expect(popped.state.stashes.map((t) => t.text)).toEqual(['On master: app'])
    expect(popped.state.working['README.md']).toBe(`# Мини-сайт + правка\n`)
    expect(popped.state.working['app.js']).toBe(seed.appBase)
  })

  it('результат, который уже в HEAD: чистое дерево, pop убирает тайник (П8.51)', () => {
    let s = run(edit(fresh()), 'git stash').state
    s = run(edit(s), 'git commit -am "то же"').state
    const applied = run(s, 'git stash apply')
    expect(applied.result.output).toBe('On branch master\nnothing to commit, working tree clean')
    expect(applied.result.exitCode).toBe(0)
    expect(run(s, 'git stash pop').state.stashes).toEqual([])
  })

  it('тот же файл подготовлен с тем же содержимым: apply проходит, индекс остаётся (П8.50)', () => {
    let s = run(edit(fresh()), 'git stash').state
    s = run(edit(s), 'git add app.js').state
    const applied = run(s, 'git stash apply')
    expect(applied.result.exitCode).toBe(0)
    expect(run(applied.state, 'git status --short').result.output).toBe('M  app.js')
  })

  it('правка в другом файле apply не мешает (П8.49), в том же — отказ с кодом 1 и статусом (П8.3)', () => {
    const stashed = run(edit(fresh()), 'git stash').state
    const other = edit(stashed, 'README.md')
    const ok = run(other, 'git stash apply')
    expect(ok.result.exitCode).toBe(0)
    expect(run(ok.state, 'git status --short').result.output).toBe(' M README.md\n M app.js')
    const refused = run(ok.state, 'git stash apply')
    expect(refused.result.exitCode).toBe(1)
    expect(refused.result.output.split('\n').slice(0, 4)).toEqual([
      'error: Your local changes to the following files would be overwritten by merge:',
      '\tapp.js',
      'Please commit your changes or stash them before you merge.',
      'Aborting',
    ])
    expect(bare(refused.state)).toEqual(bare(ok.state))
  })

  it('два файла в отказе перечислены в порядке байтов (П8.52)', () => {
    let s = edit(edit(fresh()), 'README.md')
    s = run(s, 'git stash').state
    s = edit(edit(s), 'README.md')
    const r = run(s, 'git stash pop')
    expect(r.result.output.split('\n').slice(0, 3)).toEqual(['error: Your local changes to the following files would be overwritten by merge:', '\tREADME.md', '\tapp.js'])
  })

  it('неотслеживаемый файл на месте нового файла тайника: отказ с другой формулировкой, код 1 (П8.50)', () => {
    let s = createAppendixFile(fresh(), 'n.txt')
    s = run(s, 'git add n.txt').state
    s = run(s, 'git stash').state
    s = createAppendixFile(s, 'n.txt')
    const r = run(s, 'git stash pop')
    expect(r.result.exitCode).toBe(1)
    expect(r.result.output.split('\n').slice(0, 4)).toEqual(['error: The following untracked working tree files would be overwritten by merge:', '\tn.txt', 'Please move or remove them before you merge.', 'Aborting'])
    expect(r.result.output.split('\n').at(-1)).toBe('The stash entry is kept in case you need it again.')
    expect(r.state.stashes).toHaveLength(1)
    expect(r.result.explanation).toBe(ru.appendix.explain.stashRefusedUntracked)
  })

  it('тайник на другой ветке без конфликта применяется, речь называет обе ветки (П8.52, место 12)', () => {
    let s = run(edit(fresh()), 'git stash').state
    s = run(s, 'git checkout -b b2').state
    s = run(edit(s, 'README.md'), 'git commit -am "правка README"').state
    const r = run(s, 'git stash apply')
    expect(r.result.exitCode).toBe(0)
    expect(r.result.explanation).toContain(ru.appendix.explain.stashOtherBranch('master', 'b2'))
    expect(run(r.state, 'git status --short').result.output).toBe(' M app.js')
  })

  it('тайник на feature конфликтует: отказ области, состояние и тайник на месте, миссия не засчитана (П8.3, место 12)', () => {
    let s = run(edit(fresh()), 'git stash').state
    s = run(s, 'git checkout feature').state
    expect(run(s, 'git stash list').result.output).toMatch(/^stash@\{0\}: WIP on master: /)
    for (const command of ['git stash pop', 'git stash apply']) {
      const r = run(s, command)
      refusal(r.result.output)
      expect(r.result.exitCode).toBeUndefined()
      expect(r.result.output).toContain('app.js')
      expect(bare(r.state)).toEqual(bare(s))
      expect(r.state.missionsDone.stashRestore).toBe(false)
    }
    const log = protocolEntry('П8.3', 'git stash pop', 7)
    expect(log.output).toContain('CONFLICT (content): Merge conflict in app.js')
    expect(run(s, 'git stash pop').result.output).not.toContain('CONFLICT')
  })

  it('pop не возвращает подготовку: речь об этом сказана только для подготовленного (П8.3, место 11)', () => {
    const plain = run(run(edit(fresh()), 'git stash').state, 'git stash pop').result
    expect(plain.explanation).not.toContain(ru.appendix.explain.stashIndexLost)
    let s = run(edit(fresh()), 'git add app.js').state
    s = run(s, 'git stash').state
    const popped = run(s, 'git stash pop')
    expect(popped.result.explanation).toContain(ru.appendix.explain.stashIndexLost)
    expect(run(popped.state, 'git status --short').result.output).toBe(' M app.js')
  })

  it('результат, после которого status не воспроизводится (удалённый и новый файл вместе, П8.24), — отказ области без изменений', () => {
    // Подготовлены удаление и новый файл: git ищет переименование, модель сходство не считает.
    let s = run(edit(fresh()), 'git stash').state
    s = deleteAppendixFile(s, 'README.md')
    s = run(s, 'git add README.md').state
    s = createAppendixFile(s, 'x.txt')
    s = run(s, 'git add x.txt').state
    for (const command of ['git stash apply', 'git stash pop']) {
      const r = run(s, command)
      refusal(r.result.output)
      expect(r.result.output).toContain('переименование')
      expect(bare(r.state)).toEqual(bare(s))
    }
  })
})

describe('drop и clear', () => {
  it('drop без аргумента: Dropped refs/stash@{0} (<id>) (П8.14)', () => {
    const s = run(edit(fresh()), 'git stash -m "с сообщением"').state
    const r = run(s, 'git stash drop')
    expect(r.result.output).toBe(`Dropped refs/stash@{0} (${s.stashes[0].id})`)
    expect(r.result.exitCode).toBe(0)
    expect(r.state.stashes).toEqual([])
    expect(r.state.working).toEqual(s.working)
  })

  it('drop N и drop stash@{N}: подпись как введена (П8.41)', () => {
    let s = run(edit(fresh()), 'git stash').state
    s = run(edit(s), 'git stash').state
    s = run(edit(s), 'git stash').state
    const ids = s.stashes.map((t) => t.id)
    expect(run(s, 'git stash drop 1').result.output).toBe(`Dropped refs/stash@{1} (${ids[1]})`)
    expect(run(s, 'git stash drop stash@{2}').result.output).toBe(`Dropped stash@{2} (${ids[2]})`)
    expect(run(s, 'git stash drop stash@{1}').state.stashes.map((t) => t.id)).toEqual([ids[0], ids[2]])
  })

  it('clear: пустой вывод, код 0, стопка пуста, рабочий каталог не тронут (П8.3)', () => {
    const s = run(edit(fresh()), 'git stash').state
    const r = run(s, 'git stash clear')
    expect(r.result).toMatchObject({ output: '', exitCode: 0 })
    expect(r.state.stashes).toEqual([])
    expect(r.state.working).toEqual(s.working)
    expect(run(fresh(), 'git stash clear').result.exitCode).toBe(0)
  })
})

describe('ссылки на тайник и ошибки (П8.3, П8.41–П8.44)', () => {
  const two = (): AppendixState => {
    let s = run(edit(fresh()), 'git stash').state
    s = run(edit(s, 'README.md'), 'git stash -m "вторая"').state
    return s
  }

  it('номер вне стопки: log for \'stash\' для stash@{n} и log for \'refs/stash\' для n, код 128', () => {
    for (const sub of ['apply', 'pop', 'drop']) {
      expect(run(two(), `git stash ${sub} stash@{7}`).result).toMatchObject({ output: "fatal: log for 'stash' only has 2 entries", exitCode: 128 })
      expect(run(two(), `git stash ${sub} 7`).result).toMatchObject({ output: "fatal: log for 'refs/stash' only has 2 entries", exitCode: 128 })
    }
    expect(protocolEntry('П8.42', "git stash drop 'stash@{7}'").output).toBe("fatal: log for 'stash' only has 2 entries")
    expect(protocolEntry('П8.42', "git stash drop '7'").output).toBe("fatal: log for 'refs/stash' only has 2 entries")
  })

  it('слово не ссылка: error: <слово> is not a valid reference, код 1', () => {
    for (const token of ['stash@x', 'foo', 'stash@{x}', 'stash@{', 'stash@{-1}', 'stash@{1}x', 'app.js']) {
      for (const sub of ['apply', 'pop', 'drop']) {
        expect(run(two(), `git stash ${sub} '${token}'`).result, `${sub} ${token}`).toMatchObject({ output: `error: ${token} is not a valid reference`, exitCode: 1 })
      }
    }
  })

  it('слово называет коммит: fatal: \'<слово>\' is not a stash-like commit, код 128 (П8.44)', () => {
    const s = run(two(), 'git tag v1').state
    for (const token of ['master', 'HEAD', 'v1', 'HEAD~1', 'feature']) {
      for (const sub of ['apply', 'pop', 'drop']) {
        expect(run(s, `git stash ${sub} ${token}`).result, `${sub} ${token}`).toMatchObject({ output: `fatal: '${token}' is not a stash-like commit`, exitCode: 128 })
      }
    }
    expect(s.stashes).toHaveLength(2)
  })

  it('пустая стопка: без аргумента No stash entries found. (код 1), со ссылкой — not a valid reference (П8.43)', () => {
    for (const sub of ['apply', 'pop', 'drop']) {
      expect(run(fresh(), `git stash ${sub}`).result).toMatchObject({ output: 'No stash entries found.', exitCode: 1 })
    }
    expect(run(fresh(), 'git stash apply stash@{0}').result.output).toBe('error: stash@{0} is not a valid reference')
    expect(run(fresh(), 'git stash pop 0').result.output).toBe('error: refs/stash@{0} is not a valid reference')
    expect(run(fresh(), 'git stash drop stash@{3}').result.output).toBe('error: stash@{3} is not a valid reference')
    expect(run(fresh(), 'git stash drop 1').result.output).toBe('error: refs/stash@{1} is not a valid reference')
  })

  it('ссылки, которые раздел не разбирает, получают отказ области: ключи, пустое слово, ведущий ноль, HEAD@{1}', () => {
    for (const token of ['-1', '--index', "''", '00', 'stash@{01}', 'HEAD@{1}', 'a..b', '99999999']) {
      const r = run(two(), `git stash pop ${token}`)
      refusal(r.result.output)
      expect(r.result.exitCode, token).toBeUndefined()
      expect(bare(r.state), token).toEqual(bare(two()))
    }
  })

  it('две ссылки сразу и лишние слова у list и clear — отказ области', () => {
    for (const line of ['git stash pop 0 1', 'git stash drop stash@{0} stash@{1}', 'git stash list -p', 'git stash clear 0']) {
      const r = run(two(), line)
      refusal(r.result.output)
      expect(r.result.exitCode, line).toBeUndefined()
    }
  })

  it('ссылка на второй тайник ставит миссию 4 только при успехе (П8.41)', () => {
    const s = two()
    expect(run(s, 'git stash pop stash@{1}').state.missionsDone.stashRestore).toBe(true)
    expect(run(s, 'git stash pop stash@{9}').state.missionsDone.stashRestore).toBe(false)
  })
})

describe('сообщения и формы создания (П8.3, П8.45)', () => {
  const dirty = () => edit(fresh())

  it('-m, push -m, push --message, --message=, -mтекст, save: On master: <сообщение>', () => {
    const forms: [string, string][] = [
      ['git stash -m "вторая правка"', 'вторая правка'],
      ['git stash push -m msg', 'msg'],
      ['git stash --message "через long"', 'через long'],
      ['git stash push --message=eq', 'eq'],
      ['git stash push -mслитно', 'слитно'],
      ['git stash save "старый стиль"', 'старый стиль'],
      ['git stash save a b', 'a b'],
      ['git stash push -m "a" -m "b"', 'b'],
    ]
    for (const [line, message] of forms) {
      const r = run(dirty(), line)
      expect(r.result, line).toMatchObject({ output: `Saved working directory and index state On master: ${message}`, exitCode: 0 })
      expect(r.state.stashes[0].text).toBe(`On master: ${message}`)
    }
    expect(protocolEntry('П8.45', 'git stash push -m "a" -m "b"').output).toBe('Saved working directory and index state On master: b')
  })

  it('save без слов, push без ключей и -m "" дают WIP (П8.45)', () => {
    for (const line of ['git stash save', 'git stash push', 'git stash -m ""', 'git stash push -m ""']) {
      const r = run(dirty(), line)
      expect(r.result.output, line).toMatch(/^Saved working directory and index state WIP on master: [0-9a-f]{7} Добавить README$/)
    }
  })

  it('-m без значения: error: switch `m\' requires a value, код 129; --message без значения — option `message\' (П8.45)', () => {
    expect(run(dirty(), 'git stash -m').result).toMatchObject({ output: "error: switch `m' requires a value", exitCode: 129 })
    expect(run(dirty(), 'git stash push -m').result).toMatchObject({ output: "error: switch `m' requires a value", exitCode: 129 })
    expect(run(dirty(), 'git stash push --message').result).toMatchObject({ output: "error: option `message' requires a value", exitCode: 129 })
    expect(run(dirty(), 'git stash -m').state.stashes).toEqual([])
  })

  it('слово без подкоманды: fatal: subcommand wasn\'t specified, код 128, правка на месте (П8.45)', () => {
    const forms: [string, string][] = [
      ['git stash -m a b', 'b'],
      ['git stash foo', 'foo'],
    ]
    for (const [line, token] of forms) {
      const r = run(dirty(), line)
      expect(r.result).toMatchObject({ output: `fatal: subcommand wasn't specified; 'push' can't be assumed due to unexpected token '${token}'`, exitCode: 128 })
      expect(r.state.stashes).toEqual([])
      expect(r.state.working['app.js']).toBe(dirty().working['app.js'])
    }
  })

  it('прятать нечего при любом ключе -m: код 0, тайник не создан, миссия 3 не засчитана (П8.3, П8.45)', () => {
    for (const line of ['git stash', 'git stash -m "x"', 'git stash save "x"', 'git stash push']) {
      const r = run(fresh(), line)
      expect(r.result, line).toMatchObject({ output: 'No local changes to save', exitCode: 0, ok: true })
      expect(r.state.stashes).toEqual([])
      expect(r.state.missionsDone.stashSave).toBe(false)
    }
  })

  it('сообщение, которое git в списке показал бы иначе, — отказ области (П8.45: «a  b» и «  пробелы  »)', () => {
    for (const line of ['git stash push -m "  пробелы  "', 'git stash save "a  b"', 'git stash -m "a\tb"']) {
      const r = run(dirty(), line)
      refusal(r.result.output)
      expect(r.result.exitCode, line).toBeUndefined()
      expect(r.state.stashes).toEqual([])
    }
    // git сохраняет сообщение как есть, а список показывает его со сжатыми пробелами.
    expect(protocolEntry('П8.45', 'git stash push -m "  пробелы  "').output).toBe('Saved working directory and index state On master:   пробелы  ')
    expect(protocolEntry('П8.45', 'git stash list', 1).output.split('\n')[0]).toBe('stash@{0}: On master: пробелы')
  })

  it('ключи и подкоманды вне области — отказ области: -u, -k, -q, пути, show, branch, --index, save с ключом (П8.46)', () => {
    const lines = ['git stash -u', 'git stash -k', 'git stash -q', 'git stash --include-untracked', 'git stash push app.js', 'git stash push -- app.js', 'git stash show', 'git stash show -p', 'git stash branch x', 'git stash create', 'git stash store', 'git stash export', 'git stash import', 'git stash save -m x', 'git stash pop --index']
    for (const line of lines) {
      const r = run(dirty(), line)
      refusal(r.result.output)
      expect(r.result.exitCode, line).toBeUndefined()
      expect(bare(r.state), line).toEqual(bare(dirty()))
    }
    const git = protocolBlock('П8.46').map((e) => e.command)
    for (const line of ['git stash push app.js', 'git stash -k', 'git stash -u', 'git stash -q', 'git stash show', 'git stash branch']) expect(git, line).toContain(line)
  })

  it('отказ области не печатает вывод git и не имеет кода', () => {
    const r = run(dirty(), 'git stash -u')
    expect(r.result.output).toBe(ru.appendix.errors.form('stash', '-u', ru.appendix.allowed.stash))
    expect(r.result.ok).toBe(false)
  })
})

describe('миссии 3 и 4 (target.md, «Миссии»)', () => {
  it('миссия 3: git stash, -m, push, save после правки засчитывают; миссия 4 ещё нет', () => {
    for (const line of ['git stash', 'git stash -m "x"', 'git stash push', 'git stash push -m x', 'git stash save y']) {
      const s = run(edit(fresh()), line).state
      expect(getAppendixMissions(s).map((m) => m.done), line).toEqual([false, false, true, false])
    }
  })

  it('миссия 3: «прятать нечего», ошибки и отказы области не засчитывают', () => {
    const s = runAll(fresh(), ['git stash', 'git stash -m', 'git stash foo', 'git stash list'])
    expect(s.missionsDone.stashSave).toBe(false)
    const dirty = runAll(edit(fresh()), ['git stash -u', 'git stash -m', 'git stash -m a b'])
    expect(dirty.missionsDone.stashSave).toBe(false)
  })

  it('миссия 4: pop и apply засчитывают; list, drop, clear — нет', () => {
    const stashed = run(edit(fresh()), 'git stash').state
    expect(run(stashed, 'git stash pop').state.missionsDone.stashRestore).toBe(true)
    expect(run(stashed, 'git stash apply').state.missionsDone.stashRestore).toBe(true)
    for (const line of ['git stash list', 'git stash drop', 'git stash clear']) expect(run(stashed, line).state.missionsDone.stashRestore, line).toBe(false)
  })

  it('миссия 4: отказ из-за правки, пустая стопка, конфликт не засчитывают', () => {
    const stashed = run(edit(fresh()), 'git stash').state
    const dirty = edit(stashed)
    expect(run(dirty, 'git stash pop').state.missionsDone.stashRestore).toBe(false)
    expect(run(dirty, 'git stash apply').state.missionsDone.stashRestore).toBe(false)
    expect(run(fresh(), 'git stash pop').state.missionsDone.stashRestore).toBe(false)
    const conflict = run(stashed, 'git checkout feature').state
    expect(run(conflict, 'git stash pop').state.missionsDone.stashRestore).toBe(false)
  })

  it('засчитанная миссия остаётся после drop, clear и новых тайников (часть I, п. 2)', () => {
    let s = run(run(edit(fresh()), 'git stash').state, 'git stash pop').state
    s = run(s, 'git stash clear').state
    s = run(edit(s, 'README.md'), 'git stash').state
    s = run(s, 'git stash drop').state
    expect(getAppendixMissions(s).map((m) => m.done)).toEqual([false, false, true, true])
  })

  it('путь целиком: правка, git stash, git stash pop — миссии 3 и 4 (S8-76 в части шага A)', () => {
    const s = runAll(edit(fresh()), ['git stash', 'git stash pop'])
    expect(getAppendixMissions(s).map((m) => m.done)).toEqual([false, false, true, true])
    expect(getAppendixMissions(s)[2].text).toBe(ru.appendix.missions.stashSave.text)
  })
})

describe('git stash list и речь', () => {
  it('список: свежий сверху; пустая стопка — пустой вывод, а не «(тайников нет)» (П8.3, место 7)', () => {
    expect(run(fresh(), 'git stash list').result).toMatchObject({ output: '', exitCode: 0 })
    let s = run(edit(fresh()), 'git stash').state
    s = run(edit(s), 'git stash -m "вторая правка"').state
    const out = run(s, 'git stash list').result.output.split('\n')
    expect(out[0]).toBe('stash@{0}: On master: вторая правка')
    expect(out[1]).toMatch(/^stash@\{1\}: WIP on master: [0-9a-f]{7} Добавить README$/)
  })

  it('тайник помнит ветку: после checkout feature в списке остаётся WIP on master, речь это называет (П8.3, место 12)', () => {
    let s = run(edit(fresh()), 'git stash').state
    s = run(s, 'git checkout feature').state
    const r = run(s, 'git stash list')
    expect(r.result.output).toMatch(/^stash@\{0\}: WIP on master: [0-9a-f]{7} Добавить README$/)
    expect(r.result.explanation).toContain(ru.appendix.explain.stashListOtherBranch)
    expect(run(run(edit(fresh()), 'git stash').state, 'git stash list').result.explanation).toBe(ru.appendix.explain.stashListed)
  })

  it('речь не называет неверного (место 20): «Обычными командами вернуть его уже нельзя» после drop убрано', () => {
    const s = run(edit(fresh()), 'git stash').state
    expect(run(s, 'git stash drop').result.explanation).toBe(ru.appendix.explain.stashDropped)
    expect(JSON.stringify(ru.appendix)).not.toContain('Обычными командами вернуть его уже нельзя')
    expect(JSON.stringify(ru.appendix)).not.toContain('Разреши его кнопками справа')
  })

  it('пояснения: прятать нечего, пустая стопка, сохранение, pop', () => {
    expect(run(fresh(), 'git stash').result.explanation).toBe(ru.appendix.explain.stashNothing)
    expect(run(fresh(), 'git stash pop').result.explanation).toBe(ru.appendix.explain.stashNoEntries)
    expect(run(fresh(), 'git stash list').result.explanation).toBe(ru.appendix.explain.stashListEmpty)
    expect(run(edit(fresh()), 'git stash').result.explanation).toBe(ru.appendix.explain.stashSaved)
    const s = run(edit(fresh()), 'git stash').state
    expect(run(s, 'git stash pop').result.explanation).toBe(ru.appendix.explain.stashPopped)
    expect(run(s, 'git stash apply').result.explanation).toBe(ru.appendix.explain.stashApplied)
  })
})

describe('устойчивость', () => {
  it('странный ввод у git stash превращается в результат', () => {
    for (const line of ['git stash ""', "git stash ''", 'git stash -- ', 'git stash pop ""', 'git stash push -m ""', 'git stash push --message=', 'git stash -m -m', 'git stash apply stash@{99999999999}', 'git stash drop -', 'git stash ' + 'x'.repeat(3000)]) {
      expect(() => run(edit(fresh()), line), line).not.toThrow()
    }
  })

  it('команды тайников не меняют входное состояние (оно заморожено рекурсивно)', () => {
    const deepFreeze = <T>(value: T): T => {
      if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value)
        for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key])
      }
      return value
    }
    let s = deepFreeze(edit(fresh()))
    for (const line of ['git stash', 'git stash list', 'git stash apply', 'git checkout -- app.js', 'git stash apply stash@{0}', 'git stash drop', 'git stash push -m x', 'git stash pop stash@{7}', 'git stash pop', 'git stash clear']) {
      s = deepFreeze(run(s, line).state)
    }
    expect(s.stashes).toEqual([])
  })

  it('сброс раздела: стопка пуста, миссии не засчитаны', () => {
    const s = runAll(edit(fresh()), ['git stash', 'git stash pop'])
    expect(s.missionsDone.stashSave).toBe(true)
    const again = fresh()
    expect(again.stashes).toEqual([])
    expect(again.missionsDone).toEqual({ lightTag: false, annotatedShow: false, stashSave: false, stashRestore: false })
  })
})
