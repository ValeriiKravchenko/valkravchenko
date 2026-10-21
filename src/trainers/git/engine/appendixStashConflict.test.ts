// git stash pop и git stash apply с конфликтом (target.md, часть XI; часть X, место 12). Вывод сверен с conflicts-git-runs.txt
// (К4, К7.9, К7.10, К10.s, К11.s, К13.s, К16.2, К16.3, К16.c, К17.3): ожидаемые тексты берутся из протокола. Обстановка К4.1: правка
// app.js спрятана на master, pop на feature. Правку даёт кнопка ✎ (суффикс в той же строке): с версией feature она конфликтует.
import { describe, expect, it } from 'vitest'
import { compareOutputs, fresh, normalizeGitOutput, protocolBlock, protocolEntry, run, runAll, where, type IdMap } from './appendixProtocolKit'
import { chooseConflictPart, createAppendixFile, editAppendixFile, getAppendixMissions, getConflictFiles, getConflictView, getStashes, type AppendixState } from './appendixSection'
import { currentCommitId } from './appendixRepo'
import { ru } from '../locales/ru'

const seed = ru.appendix.seed
const rc = ru.conflicts
const edit = (s: AppendixState, file = 'app.js') => editAppendixFile(s, file)
const bare = (s: AppendixState) => ({ ...s, history: [] })
const refusal = (output: string) => expect(output.startsWith('[тренажёр]')).toBe(true)

function same(state: AppendixState, block: string, command: string, ids: IdMap, nth = 0, as = command): AppendixState {
  const entry = protocolEntry(block, command, nth)
  const next = run(state, as)
  const where_ = `${entry.file}:${entry.line} ${command}`
  expect(next.result.exitCode, `${where_} код возврата`).toBe(entry.exitCode)
  expect(compareOutputs(normalizeGitOutput(command, entry.output), normalizeGitOutput(command, next.result.output), ids), where_).toBeNull()
  return next.state
}

/** Правка app.js спрятана на master, HEAD на feature. */
const stashedOnFeature = (): AppendixState => runAll(edit(fresh()), ['git stash', 'git checkout feature'])
const popped = (): AppendixState => run(stashedOnFeature(), 'git stash pop').state
const applied = (): AppendixState => run(stashedOnFeature(), 'git stash apply').state
const STASH_TEXT = 'console.log("v1"); + правка\n'

describe('stash pop с конфликтом (К4.1)', () => {
  it(`вывод: Auto-merging, CONFLICT, git status, строка про тайник, код 1; Dropped нет (${where('К4.1', 'git stash pop')})`, () => {
    const ids: IdMap = new Map()
    const s = same(stashedOnFeature(), 'К4.1', 'git stash pop', ids)
    expect(s.stashes).toHaveLength(1)
    expect(protocolEntry('К4.1', 'git stash pop').output).not.toContain('Dropped')
    expect(run(stashedOnFeature(), 'git stash pop').result.output).not.toContain('Dropped')
  })

  it('состояние: неслитый путь, операции нет, метки Updated upstream и Stashed changes, тайник в стопке, записей журнала нет (К7.9, К7.10)', () => {
    const before = stashedOnFeature()
    const r = run(before, 'git stash pop')
    expect(r.state.operation).toBeNull()
    expect(r.state.unmerged).toEqual({ 'app.js': { kind: 'both-modified', base: seed.appBase, ours: seed.appFixed, theirs: STASH_TEXT } })
    expect(r.state.working['app.js']).toBe(`<<<<<<< Updated upstream\n${seed.appFixed}=======\n${STASH_TEXT}>>>>>>> Stashed changes\n`)
    expect(protocolEntry('К4.1', 'cat app.js').output).toBe(`<<<<<<< Updated upstream\n${seed.appFixed.trimEnd()}\n=======\nconsole.log("v1"); // локальная правка, ещё не готова коммититься\n>>>>>>> Stashed changes`)
    expect('app.js' in r.state.index).toBe(false)
    expect(r.state.stashes).toEqual(before.stashes)
    expect(r.state.reflog).toEqual(before.reflog)
    expect(r.state.commits).toEqual(before.commits)
    expect(r.state.head).toEqual(before.head)
    expect(r.result.explanation).toBe(rc.stashPopConflict(['app.js']))
  })

  it(`git status и git status --short: заголовка операции нет, подсказка restore --staged есть (${where('К4.1', 'git status')})`, () => {
    const ids: IdMap = new Map()
    let s = same(stashedOnFeature(), 'К4.1', 'git stash pop', ids)
    s = same(s, 'К4.1', 'git status', ids)
    same(s, 'К4.1', 'git status --short', ids)
    expect(run(s, 'git stash list').result.output).toBe(`stash@{0}: WIP on master: ${getStashes(s)[0].text.split(': ')[1]}`)
    expect(protocolEntry('К4.1', 'git stash list').output).toMatch(/^stash@\{0\}: WIP on master: [0-9a-f]{7} Добавить README$/)
  })

  it('миссия 4 «Вернуть спрятанное» не засчитывается (pop и apply с конфликтом — код 1)', () => {
    expect(popped().missionsDone.stashRestore).toBe(false)
    expect(applied().missionsDone.stashRestore).toBe(false)
    expect(getAppendixMissions(popped())[3].done).toBe(false)
    expect(popped().missionsDone.stashSave).toBe(true)
  })

  it('кнопки редактора: подписи Updated upstream и Stashed changes; заметка называет git stash drop', () => {
    const s = popped()
    expect(getConflictFiles(s)).toEqual([{ path: 'app.js', kind: 'both-modified', topLabel: 'Updated upstream', bottomLabel: 'Stashed changes' }])
    const next = chooseConflictPart(s, 'app.js', 'bottom')
    expect(next.working['app.js']).toBe(STASH_TEXT)
    expect(next.history[next.history.length - 1]).toEqual({ kind: 'note', text: rc.choiceNote('bottom', 'app.js', 'Updated upstream', 'Stashed changes', rc.finishStash) })
    expect(getConflictView(s)).toEqual({
      operation: null,
      unmerged: [{ path: 'app.js', kind: 'both-modified', code: 'UU', kindKey: 'kindBothModified' }],
      allAdded: false,
      finishKey: 'stashFinish',
      abortKey: 'stashAbort',
    })
  })
})

describe('stash apply с конфликтом (К4.5)', () => {
  it(`то же без последней строки; тайник остаётся (${where('К4.5', 'git stash apply')})`, () => {
    const ids: IdMap = new Map()
    let s = same(stashedOnFeature(), 'К4.5', 'git stash apply', ids)
    s = same(s, 'К4.5', 'git status --short', ids)
    expect(s.stashes).toHaveLength(1)
    expect(s.unmerged).toHaveProperty('app.js')
    expect(run(stashedOnFeature(), 'git stash apply').result.output).not.toContain('kept in case')
    expect(run(stashedOnFeature(), 'git stash apply').result.explanation).toBe(rc.stashApplyConflict(['app.js']))
  })

  it(`отмена: checkout HEAD -- app.js — пусто, путь больше не неслитый, статус чист, тайник на месте (${where('К4.5', 'git checkout HEAD -- app.js')})`, () => {
    const ids: IdMap = new Map()
    let s = same(applied(), 'К4.5', 'git checkout HEAD -- app.js', ids)
    s = same(s, 'К4.5', 'git status', ids)
    expect(s.stashes).toHaveLength(1)
    expect(s.working['app.js']).toBe(seed.appFixed)
  })
})

describe('отказ «своя правка того же файла» (К4.7)', () => {
  it(`проверка идёт до конфликта: would be overwritten by merge, git status, строка про тайник, код 1 (${where('К4.7', 'git stash pop')})`, () => {
    const ids: IdMap = new Map()
    const before = edit(stashedOnFeature())
    const s = same(before, 'К4.7', 'git stash pop', ids)
    expect(bare(s)).toEqual(bare(before))
    expect(s.unmerged).toEqual({})
    expect(run(before, 'git stash apply').result.output).not.toContain('kept in case')
  })
})

describe('что запрещено посреди конфликта тайника (К4.2)', () => {
  it('commit -m, merge --abort, stash, checkout, cherry-pick, rebase', () => {
    const ids: IdMap = new Map()
    let s = popped()
    s = same(s, 'К4.2', 'git commit -m x', ids)
    s = same(s, 'К4.2', 'git stash', ids)
    s = same(s, 'К4.2', 'git checkout master', ids)
    s = same(s, 'К4.2', 'git checkout -- app.js', ids)
    s = same(s, 'К4.2', 'git cherry-pick master', ids)
    s = same(s, 'К4.2', 'git rebase master', ids)
    s = same(s, 'К4.2', 'git stash pop', ids)
    expect(bare(s)).toEqual(bare(popped()))
    for (const line of ['git merge --abort', 'git merge master', 'git restore app.js', 'git diff', 'git switch master']) {
      const r = run(s, line)
      refusal(r.result.output)
      expect(bare(r.state), line).toEqual(bare(s))
    }
  })

  it('--abort у тайника нет: error: unknown option `abort\' и usage, код 129 — pop и без подкоманды (К4.2)', () => {
    for (const [line, command] of [
      ['git stash pop --abort', 'git stash pop --abort'],
      ['git stash --abort', 'git stash --abort'],
    ] as const) {
      const entry = protocolEntry('К4.2', command)
      for (const s of [popped(), fresh()]) {
        const r = run(s, line)
        expect(r.result.exitCode).toBe(129)
        expect(r.result.output).toBe(entry.output)
        expect(bare(r.state)).toEqual(bare(s))
      }
    }
    refusal(run(popped(), 'git stash apply --abort').result.output)
  })

  it('stash apply при неслитых путях: те же две строки, что у pop, без строки про тайник (К4.2)', () => {
    const apply = run(popped(), 'git stash apply')
    expect(apply.result.output).toBe('error: could not write index\napp.js: needs merge')
    expect(apply.result.exitCode).toBe(1)
    expect(protocolEntry('К4.2', 'git stash pop').output.startsWith(apply.result.output)).toBe(true)
  })
})

describe('отмена и разрешение (К4.3, К4.4, К10.s, К11.s, К13.s)', () => {
  it(`reset --hard: HEAD is now at, статус чист, тайник на месте; запись reset: moving to HEAD (${where('К4.3', 'git reset --hard')}, ${where('К7.10', 'git reset --hard')})`, () => {
    const ids: IdMap = new Map()
    const before = popped()
    let s = same(before, 'К4.3', 'git reset --hard', ids)
    s = same(s, 'К4.3', 'git status', ids)
    s = same(s, 'К4.3', 'git stash list', ids)
    expect(s.unmerged).toEqual({})
    expect(s.reflog[0]).toEqual({ id: currentCommitId(before), message: 'reset: moving to HEAD' })
    expect(protocolEntry('К7.10', 'git reflog', 1).output).toContain('HEAD@{0}: reset: moving to HEAD')
  })

  it(`разрешение: кнопка, git add (подготовленная правка), git stash drop; записей журнала нет (${where('К4.4', 'git add app.js')}, ${where('К4.4', 'git stash drop')})`, () => {
    const ids: IdMap = new Map()
    const before = popped()
    let s = chooseConflictPart(before, 'app.js', 'both')
    const added = run(s, 'git add app.js')
    expect(added.result.explanation).toBe(rc.allAddedStash)
    s = same(s, 'К4.4', 'git add app.js', ids)
    s = same(s, 'К4.4', 'git status', ids, 0)
    expect(s.unmerged).toEqual({})
    expect(getConflictView(s)).toBeNull()
    s = same(s, 'К4.4', 'git stash drop', ids)
    s = same(s, 'К4.4', 'git stash list', ids, 1)
    expect(s.reflog).toEqual(before.reflog)
    expect(s.stashes).toEqual([])
    // К7.9: журнал HEAD до pop-конфликта и после drop одинаков.
    const [first, second] = protocolBlock('К7.9').filter((e) => e.command === 'git reflog')
    expect(second.output).toBe(first.output)
  })

  it(`git stash drop при неслитом пути проходит: тайник удалён, путь остался (${where('К16.2', 'git stash drop')})`, () => {
    const ids: IdMap = new Map()
    let s = same(popped(), 'К16.2', 'git stash drop', ids)
    s = same(s, 'К16.2', 'git status --short', ids)
    expect(s.stashes).toEqual([])
    expect(run(popped(), 'git stash drop').result.explanation).toContain(rc.stashDropKeepsUnmerged)
  })

  it(`повторный git stash pop после git add даёт новый конфликт с разрешённым текстом вверху (${where('К16.3', 'git stash pop')}); commit отказывает`, () => {
    const ids: IdMap = new Map()
    let s = run(chooseConflictPart(popped(), 'app.js', 'top'), 'git add app.js').state
    const resolvedText = s.index['app.js']
    s = same(s, 'К16.3', 'git stash pop', ids)
    expect(s.working['app.js']).toBe(`<<<<<<< Updated upstream\n${resolvedText}=======\n${STASH_TEXT}>>>>>>> Stashed changes\n`)
    expect(Object.keys(s.unmerged)).toEqual(['app.js'])
    expect(s.stashes).toHaveLength(1)
    s = same(s, 'К16.3', 'git status --short', ids)
    const refused = run(s, 'git commit -m "разрешил"')
    expect(refused.result.exitCode).toBe(128)
    expect(refused.result.output).toBe(protocolEntry('К16.3', "git commit -qm 'разрешил'; git stash pop").output.split('\n').slice(0, 5).join('\n'))
    const again = run(refused.state, 'git stash pop')
    expect(again.result.output).toBe(protocolEntry('К16.3', "git commit -qm 'разрешил'; git stash pop").output.split('\n').slice(5).join('\n'))
  })

  it(`reset --soft: ошибка, reset: Unstaged changes after reset, метки остаются правкой, операции нет, тайник на месте (${where('К10.s', 'git reset')})`, () => {
    const ids: IdMap = new Map()
    let s = same(popped(), 'К10.s', 'git reset --soft HEAD', ids)
    s = same(s, 'К10.s', 'git reset', ids)
    s = same(s, 'К10.s', 'git status', ids)
    s = same(s, 'К10.s', 'git stash list', ids)
    expect(s.unmerged).toEqual({})
    expect(s.working['app.js']).toContain('<<<<<<< Updated upstream')
  })

  it(`commit -a посреди конфликта: обычный коммит на ветке с метками, тайник в стопке (${where('К11.s', "git commit -am 'всё сразу'")})`, () => {
    const ids: IdMap = new Map()
    let s = same(popped(), 'К11.s', "git commit -am 'всё сразу'", ids, 0, 'git commit -am "всё сразу"')
    s = same(s, 'К11.s', 'git status', ids)
    expect(s.commits[s.branches.feature].tree['app.js']).toContain('<<<<<<< Updated upstream')
    expect(s.stashes).toHaveLength(1)
    expect(s.unmerged).toEqual({})
    expect(s.reflog[0].message).toBe('commit: всё сразу')
    expect(s.missionsDone.cherryPick).toBe(false)
  })

  it('commit -a без -m посреди конфликта тайника: редактор git открыл бы, тренажёр сообщения не знает — отказ области', () => {
    refusal(run(popped(), 'git commit -a').result.output)
  })

  it(`checkout -b: просто переход, без предупреждения (${where('К13.s', 'git checkout -b other')})`, () => {
    const ids: IdMap = new Map()
    let s = same(popped(), 'К13.s', 'git checkout -b other', ids)
    s = same(s, 'К13.s', 'git status', ids)
    expect(Object.keys(s.unmerged)).toEqual(['app.js'])
    expect(s.head).toEqual({ kind: 'branch', name: 'other' })
  })
})

describe('конфликт при двух файлах и в других состояниях', () => {
  /** К4.6: в тайнике app.js и README.md, на master app.js уже изменён по-другому. */
  const twoFiles = (): AppendixState => {
    const s = runAll(edit(edit(fresh()), 'README.md'), ['git stash'])
    return runAll(edit(edit(s)), ['git commit -am "master: v2"'])
  }

  it(`слитый без конфликта файл подготовлен (M  README.md), конфликтный — UU; итог без строки «no changes added» (${where('К4.6', 'git status')})`, () => {
    const ids: IdMap = new Map()
    let s = same(twoFiles(), 'К4.6', 'git stash pop', ids)
    s = same(s, 'К4.6', 'git status', ids)
    s = same(s, 'К4.6', 'git status --short', ids)
    expect(s.index['README.md']).toBe(`${seed.readme.slice(0, -1)} + правка\n`)
    expect(Object.keys(s.unmerged)).toEqual(['app.js'])
    expect(s.stashes).toHaveLength(1)
  })

  it('конфликт в отсоединённом HEAD: статус с первой строкой HEAD detached, записей журнала нет', () => {
    const s = runAll(edit(fresh()), ['git stash', 'git checkout feature', 'git checkout --detach'])
    const r = run(s, 'git stash pop')
    expect(r.result.exitCode).toBe(1)
    expect(r.result.output).toContain('HEAD detached at')
    expect(r.state.reflog).toEqual(s.reflog)
  })

  it('конфликт другого вида (файл удалён у одной стороны) — отказ области, состояние на месте', () => {
    const s = runAll(edit(fresh(), 'README.md'), ['git stash', 'git checkout feature'])
    for (const line of ['git stash pop', 'git stash apply']) {
      const r = run(s, line)
      refusal(r.result.output)
      expect(r.result.output).toBe(ru.appendix.errors.stashConflictKind(line.endsWith('pop') ? 'pop' : 'apply', ['README.md']))
      expect(bare(r.state), line).toEqual(bare(s))
    }
  })

  it('конфликт вместе с неотслеживаемым файлом на пути нового файла из тайника — отказ области: порядок отказов git не сверен', () => {
    let s = createAppendixFile(edit(fresh()), 'junk.txt')
    s = runAll(s, ['git add junk.txt', 'git stash', 'git checkout feature'])
    s = createAppendixFile(s, 'junk.txt')
    for (const line of ['git stash pop', 'git stash apply']) {
      const r = run(s, line)
      refusal(r.result.output)
      expect(r.result.output, line).toBe(ru.appendix.errors.stashUnverified(line.endsWith('pop') ? 'pop' : 'apply'))
      expect(bare(r.state), line).toEqual(bare(s))
    }
  })

  it('слияние строк одного файла без конфликта (правки в разных строках) прогонами тайника не сверено — отказ области', () => {
    const s = stashedOnFeature()
    const stash = s.stashes[0]
    const base = { ...s.commits[stash.base], tree: { ...s.commits[stash.base].tree, 'app.js': 'a\nb\nc\n' } }
    const multi: AppendixState = {
      ...s,
      commits: { ...s.commits, [stash.base]: base },
      stashes: [{ ...stash, work: { ...stash.work, 'app.js': 'A\nb\nc\n' } }],
      index: { ...s.index, 'app.js': 'a\nb\nC\n' },
      working: { ...s.working, 'app.js': 'a\nb\nC\n' },
    }
    const r = run(multi, 'git stash pop')
    refusal(r.result.output)
    expect(r.result.output).toBe(ru.appendix.errors.stashUnverified('pop'))
    expect(bare(r.state)).toEqual(bare(multi))
  })

  it('статус с неслитым путём и неотслеживаемым файлом без подготовленного не сверен — отказ области, конфликт не начинается', () => {
    const base = stashedOnFeature()
    const s = { ...base, working: { ...base.working, 'notes.txt': 'заметки\n' } }
    const r = run(s, 'git stash pop')
    refusal(r.result.output)
    expect(r.result.output).toBe(ru.appendix.errors.conflictUntrackedStatus('stash'))
    expect(bare(r.state)).toEqual(bare(s))
    const manual = run({ ...popped(), working: { ...popped().working, 'notes.txt': 'заметки\n' } }, 'git status')
    refusal(manual.result.output)
  })

  it('без конфликта pop работает как раньше и засчитывает миссию 4', () => {
    const plain = runAll(edit(fresh()), ['git stash'])
    const r = run(plain, 'git stash pop')
    expect(r.result.exitCode).toBe(0)
    expect(r.state.missionsDone.stashRestore).toBe(true)
  })
})
