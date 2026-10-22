// git cherry-pick с конфликтом и пустой cherry-pick (target.md, часть XI; часть X, места 13 и 20). Вывод сверен с
// conflicts-git-runs.txt (К5, К7, К8, К10–К13, К16) и section8-git-runs.txt (П8.4): ожидаемые тексты берутся из протокола,
// id в них настоящие, у тренажёра свои, поэтому сверка идёт по скелету и по соответствию id (appendixProtocolKit.ts).
// Обстановка К5.1: на master закоммичен app.js (в тренажёре версию даёт кнопка ✎: суффикс в той же строке), cherry-pick
// фикса из feature.
import { describe, expect, it } from 'vitest'
import { compareOutputs, fresh, normalizeGitOutput, protocolEntry, run, runAll, where, type IdMap } from './appendixProtocolKit'
import { chooseConflictPart, createAppendixFile, deleteAppendixFile, editAppendixFile, getAppendixMissions, getCommits, getConflictFiles, getConflictView, type AppendixState } from './appendixSection'
import { currentCommitId } from './appendixRepo'
import { ru } from '../locales/ru'

const seed = ru.appendix.seed
const rc = ru.conflicts
const edit = (s: AppendixState, file = 'app.js') => editAppendixFile(s, file)
const bare = (s: AppendixState) => ({ ...s, history: [] })
const refusal = (output: string) => expect(output.startsWith('[тренажёр]')).toBe(true)

/** Выполняет `as` (по умолчанию команду протокола) и сверяет вывод и код возврата с записью протокола. */
function same(state: AppendixState, block: string, command: string, ids: IdMap, nth = 0, as = command): AppendixState {
  const entry = protocolEntry(block, command, nth)
  const next = run(state, as)
  const where_ = `${entry.file}:${entry.line} ${command}`
  expect(next.result.exitCode, `${where_} код возврата`).toBe(entry.exitCode)
  expect(compareOutputs(normalizeGitOutput(command, entry.output), normalizeGitOutput(command, next.result.output), ids), where_).toBeNull()
  return next.state
}

/** Обстановка К5.1: на master закоммичен app.js. */
const onMaster = (): AppendixState => runAll(edit(fresh()), ['git commit -am "master: v2"'])
const PICK = 'git cherry-pick feature~1'
/** Конфликт К5.1. */
const picking = (): AppendixState => run(onMaster(), PICK).state
/** Конфликт, разрешённый кнопкой «обе части» и добавленный. */
const resolved = (): AppendixState => run(chooseConflictPart(picking(), 'app.js', 'both'), 'git add app.js').state

describe('конфликт cherry-pick (К5.1)', () => {
  it(`вывод: Auto-merging, CONFLICT, error: could not apply, семь строк hint, код 1 (${where('К5.1', 'git cherry-pick ae28885')})`, () => {
    const s = onMaster()
    const r = run(s, PICK)
    expect(r.result.exitCode).toBe(1)
    expect(r.result.ok).toBe(false)
    const entry = protocolEntry('К5.1', 'git cherry-pick ae28885')
    expect(compareOutputs(entry.output, r.result.output, new Map())).toBeNull()
    expect(r.result.output.split('\n')).toHaveLength(entry.output.split('\n').length)
    expect(r.result.output).toContain(`error: could not apply ${(r.state.operation as { commit: string }).commit.slice(0, 7)}... ${seed.fixMessage}`)
  })

  it('состояние: операция, неслитый путь, метки, ветка и HEAD на месте, записи журнала нет, миссия не засчитана', () => {
    const s = onMaster()
    const r = run(s, PICK)
    const picked = s.commits[s.branches.feature].parents[0]
    expect(r.state.operation).toEqual({ kind: 'cherry-pick', commit: picked })
    expect(r.state.unmerged).toEqual({
      'app.js': { kind: 'both-modified', base: seed.appBase, ours: `console.log("v1"); + правка\n`, theirs: seed.appFixed },
    })
    expect(r.state.working['app.js']).toBe(`<<<<<<< HEAD\nconsole.log("v1"); + правка\n=======\n${seed.appFixed}>>>>>>> ${picked.slice(0, 7)} (${seed.fixMessage})\n`)
    expect('app.js' in r.state.index).toBe(false)
    expect(r.state.branches).toEqual(s.branches)
    expect(r.state.head).toEqual(s.head)
    expect(r.state.reflog).toEqual(s.reflog)
    expect(r.state.commits).toEqual(s.commits)
    expect(r.state.missionsDone.cherryPick).toBe(false)
    expect(r.result.explanation).toBe(rc.cherryPickConflict(['app.js']))
  })

  it(`git status и git status --short (${where('К5.1', 'git status')}, ${where('К5.1', 'git status --short')})`, () => {
    const ids: IdMap = new Map()
    let s = same(onMaster(), 'К5.1', 'git cherry-pick ae28885', ids, 0, PICK)
    s = same(s, 'К5.1', 'git status', ids)
    same(s, 'К5.1', 'git status --short', ids)
  })

  it('метки: подписи HEAD и `<id7> (<тема>)`, id7 и при ссылке feature~1 (К15.2); кнопки видят блок', () => {
    const s = picking()
    const picked = s.commits[s.branches.feature].parents[0]
    expect(getConflictFiles(s)).toEqual([{ path: 'app.js', kind: 'both-modified', topLabel: 'HEAD', bottomLabel: `${picked.slice(0, 7)} (${seed.fixMessage})` }])
    expect(protocolEntry('К15.2', 'cat app.js').output).toContain('>>>>>>> 3f2849b (fix: опечатка в логе)')
  })
})

describe('что запрещено посреди cherry-pick (К5.2)', () => {
  it('commit -m, cherry-pick --continue, новый cherry-pick: блок A, `U\\tapp.js`, код 128', () => {
    const ids: IdMap = new Map()
    let s = picking()
    s = same(s, 'К5.2', 'git cherry-pick --continue', ids)
    s = same(s, 'К5.2', 'git commit -m x', ids)
    s = same(s, 'К5.2', 'git cherry-pick f12dd83', ids, 0, 'git cherry-pick feature')
    expect(bare(s)).toEqual(bare(picking()))
  })

  it('git commit без -m: тоже блок A, редактор не нужен', () => {
    const r = run(picking(), 'git commit')
    expect(r.result.exitCode).toBe(128)
    expect(r.result.output).toBe(protocolEntry('К5.2', 'git commit -m x').output)
  })

  it('checkout <ветка> и stash: `you need to resolve your current index first`, `could not write index`, код 1', () => {
    const ids: IdMap = new Map()
    let s = picking()
    s = same(s, 'К5.2', 'git checkout feature', ids)
    s = same(s, 'К5.2', 'git stash', ids)
    expect(bare(s)).toEqual(bare(picking()))
  })

  it('git merge, git revert, git merge --abort, git switch — не команды раздела или правило области, состояние не меняется', () => {
    const s = picking()
    for (const line of ['git merge feature', 'git revert HEAD', 'git merge --abort', 'git switch feature', 'git switch -c other', 'git diff', 'git diff --staged']) {
      const r = run(s, line)
      refusal(r.result.output)
      expect(r.result.exitCode, line).toBeUndefined()
      expect(bare(r.state), line).toEqual(bare(s))
    }
  })

  it('stash pop и apply, rebase: отказы git (К16.c, К4.2)', () => {
    const withStash = runAll(edit(fresh(), 'README.md'), ['git stash -m "для pop"'])
    const picking_ = run(runAll(edit(withStash), ['git commit -am "master: v2"']), PICK).state
    expect(picking_.operation).not.toBeNull()
    const pop = run(picking_, 'git stash pop')
    expect(pop.result.output).toBe(protocolEntry('К16.c', 'git stash pop').output)
    expect(pop.result.exitCode).toBe(1)
    const apply = run(picking_, 'git stash apply')
    expect(apply.result.output).toBe(protocolEntry('К16.c', 'git stash apply').output)
    const rebase = run(picking_, 'git rebase master')
    expect(rebase.result.output).toBe(protocolEntry('К4.2', 'git rebase master').output)
    expect(rebase.result.exitCode).toBe(1)
    expect(picking_.stashes).toHaveLength(1)
    expect(pop.state.stashes).toHaveLength(1)
  })

  it('git checkout -- app.js: `path is unmerged`; другой файл возвращается как обычно (К4.2)', () => {
    const s = picking()
    const r = run(s, 'git checkout -- app.js')
    expect(r.result.output).toBe(protocolEntry('К4.2', 'git checkout -- app.js').output)
    expect(r.result.exitCode).toBe(1)
    const other = run(edit(s, 'README.md'), 'git checkout -- README.md')
    expect(other.result.exitCode).toBe(0)
    refusal(run(s, 'git checkout -- app.js README.md').result.output)
  })

  it('прочие формы checkout посреди конфликта — отказ области: тег, id, --detach, HEAD, -', () => {
    const s = picking()
    for (const line of ['git checkout --detach', 'git checkout HEAD', 'git checkout -', 'git checkout app.js', `git checkout ${currentCommitId(s).slice(0, 7)}`]) {
      const r = run(s, line)
      refusal(r.result.output)
      expect(bare(r.state), line).toEqual(bare(s))
    }
  })

  it('reset --soft: `Cannot do a soft reset in the middle of a merge.`, код 128 (К5.9)', () => {
    const r = run(picking(), 'git reset --soft HEAD')
    expect(r.result.output).toBe(protocolEntry('К5.9', 'git reset --soft HEAD').output)
    expect(r.result.exitCode).toBe(128)
    expect(bare(r.state)).toEqual(bare(picking()))
  })

  it('`cherry-pick --quit` и `commit --allow-empty` — отказ области', () => {
    const s = picking()
    for (const line of ['git cherry-pick --quit', 'git commit --allow-empty -m x', 'git cherry-pick --continue now']) {
      const r = run(s, line)
      refusal(r.result.output)
      expect(bare(r.state), line).toEqual(bare(s))
    }
  })
})

describe('--abort (К5.3, К7.4)', () => {
  it('пусто, код 0; файл, статус и журнал; повторные --abort и --continue: no cherry-pick or revert in progress, код 128', () => {
    const ids: IdMap = new Map()
    const before = onMaster()
    let s = same(picking(), 'К5.3', 'git cherry-pick --abort', ids)
    s = same(s, 'К5.3', 'git status', ids)
    expect(s.working).toEqual(before.working)
    expect(s.index).toEqual(before.index)
    expect(s.operation).toBeNull()
    expect(s.unmerged).toEqual({})
    s = same(s, 'К5.3', 'git cherry-pick --abort', ids, 1)
    s = same(s, 'К5.3', 'git cherry-pick --continue', ids)
    expect(s.branches).toEqual(before.branches)
  })

  it(`запись журнала: reset: moving to <полный id> (${where('К7.4', 'git cherry-pick --abort')})`, () => {
    const before = onMaster()
    const r = run(picking(), 'git cherry-pick --abort')
    const id = currentCommitId(before)
    expect(r.state.reflog[0]).toEqual({ id, message: `reset: moving to ${id}` })
    expect(r.state.reflog.slice(1)).toEqual(before.reflog)
    expect(protocolEntry('К7.4', 'git reflog').output).toMatch(/HEAD@\{0\}: reset: moving to [0-9a-f]{40}/)
    expect(r.state.missionsDone.cherryPick).toBe(false)
  })

  it('правки других файлов остаются, подготовленная правка постороннего файла возвращается к HEAD (К19.1, К19.2 по механизму)', () => {
    let s = picking()
    s = createAppendixFile(s, 'new.txt')
    s = edit(s, 'README.md')
    const r = run(s, 'git cherry-pick --abort')
    expect('new.txt' in r.state.working).toBe(true)
    expect(r.state.working['README.md']).toBe(`${seed.readme.slice(0, -1)} + правка\n`)
    expect(r.result.explanation).toContain('«app.js»')
    const staged = run(run(s, 'git add README.md').state, 'git cherry-pick --abort')
    expect(staged.state.working['README.md']).toBe(seed.readme)
  })
})

describe('--skip (К5.7, К7.3)', () => {
  it('пусто, код 0, статус чист, коммитов нет; запись журнала reset: moving to <полный id>', () => {
    const ids: IdMap = new Map()
    const before = onMaster()
    let s = same(picking(), 'К5.7', 'git cherry-pick --skip', ids)
    s = same(s, 'К5.7', 'git status', ids)
    expect(s.commits).toEqual(before.commits)
    const id = currentCommitId(before)
    expect(s.reflog[0]).toEqual({ id, message: `reset: moving to ${id}` })
    expect(s.missionsDone.cherryPick).toBe(false)
    expect(protocolEntry('К7.3', 'git reflog').output).toMatch(/HEAD@\{0\}: reset: moving to [0-9a-f]{40}/)
  })

  it('без идущей операции: отказ области (как git отвечает, не сверено)', () => {
    const r = run(onMaster(), 'git cherry-pick --skip')
    refusal(r.result.output)
    expect(r.result.output).toBe(ru.appendix.errors.cherryPickSkipIdle)
  })
})

describe('--continue и git commit после git add (К5.4, К5.5, К7.1, К7.2, К7.11, К8.2)', () => {
  it(`git add: статус «all conflicts fixed», подготовленный app.js без подсказки restore --staged (${where('К5.4', 'git status')})`, () => {
    const ids: IdMap = new Map()
    let s = chooseConflictPart(same(onMaster(), 'К5.1', 'git cherry-pick ae28885', ids, 0, PICK), 'app.js', 'both')
    s = same(s, 'К5.4', 'git add app.js', ids)
    expect(s.unmerged).toEqual({})
    expect(s.operation).not.toBeNull()
    s = same(s, 'К5.4', 'git status', ids)
    expect(run(s, 'git status --short').result.output).toBe('M  app.js')
  })

  it(`--continue: [master <id7>] <тема>, код 0; копия с сообщением оригинала, один родитель, журнал commit (cherry-pick), миссия 5 (${where('К5.4', 'git cherry-pick --continue')})`, () => {
    const ids: IdMap = new Map()
    const before = resolved()
    const s = same(before, 'К5.4', 'git cherry-pick --continue', ids)
    const copy = s.commits[s.branches.master]
    expect(copy.message).toBe(seed.fixMessage)
    expect(copy.parents).toEqual([before.branches.master])
    expect(copy.tree['app.js']).toBe(before.index['app.js'])
    expect(s.operation).toBeNull()
    expect(s.unmerged).toEqual({})
    expect(s.reflog[0]).toEqual({ id: copy.id, message: `commit (cherry-pick): ${seed.fixMessage}` })
    expect(protocolEntry('К7.1', 'git reflog', 1).output).toContain('commit (cherry-pick): fix: опечатка в логе')
    expect(s.missionsDone.cherryPick).toBe(true)
    expect(getAppendixMissions(s)[4].done).toBe(true)
    expect(run(s, 'git status').result.output).toBe(protocolEntry('К5.3', 'git status').output)
    expect(getCommits(s)[0].subject).toBe(seed.fixMessage)
  })

  it(`git commit без -m завершает cherry-pick с сообщением оригинала; речь называет редактор (${where('К5.5', 'git commit')}, ${where('К7.2', 'git reflog')})`, () => {
    const ids: IdMap = new Map()
    const r = run(resolved(), 'git commit')
    expect(r.result.exitCode).toBe(0)
    expect(compareOutputs(normalizeGitOutput('git commit', protocolEntry('К5.5', 'git commit').output), normalizeGitOutput('git commit', r.result.output), ids)).toBeNull()
    expect(r.result.explanation).toContain(rc.editorWouldOpen)
    expect(r.state.commits[r.state.branches.master].message).toBe(seed.fixMessage)
    expect(r.state.reflog[0].message).toBe(`commit (cherry-pick): ${seed.fixMessage}`)
    expect(r.state.operation).toBeNull()
    expect(r.state.missionsDone.cherryPick).toBe(true)
  })

  it(`git commit -m: свой текст вместо темы оригинала, запись журнала с этим текстом; после него --continue отвечает no cherry-pick or revert in progress (${where('К8.2', 'git commit -m \'Фикс опечатки\'')}, ${where('К7.11', 'git reflog -2')})`, () => {
    const ids: IdMap = new Map()
    let s = same(resolved(), 'К8.2', "git commit -m 'Фикс опечатки'", ids, 0, 'git commit -m "Фикс опечатки"')
    expect(s.commits[s.branches.master].message).toBe('Фикс опечатки')
    expect(s.reflog[0].message).toBe('commit (cherry-pick): Фикс опечатки')
    expect(protocolEntry('К7.11', 'git reflog -2').output).toContain('HEAD@{0}: commit (cherry-pick): Фикс опечатки')
    expect(s.missionsDone.cherryPick).toBe(true)
    s = same(s, 'К8.2', 'git status', ids)
    s = same(s, 'К8.2', 'git cherry-pick --continue', ids)
  })

  it('git add . разрешает все неслитые пути; метки не проверяются, речь предупреждает (К1.7, опасное место 1)', () => {
    const r = run(picking(), 'git add .')
    expect(r.state.unmerged).toEqual({})
    expect(r.state.index['app.js']).toContain('<<<<<<< HEAD')
    expect(r.result.explanation).toContain('«app.js»')
    expect(r.result.explanation).toContain('метки попадут в историю')
    expect(r.result.explanation).toContain(rc.allAddedCherryPick)
    const done = run(r.state, 'git cherry-pick --continue')
    expect(done.state.commits[done.state.branches.master].tree['app.js']).toContain('>>>>>>>')
  })

  it('git add -A и git add app.js ведут себя так же; без меток речь не предупреждает', () => {
    const s = chooseConflictPart(picking(), 'app.js', 'both')
    for (const line of ['git add -A', 'git add app.js', 'git add .']) {
      const r = run(s, line)
      expect(r.state.unmerged, line).toEqual({})
      expect(r.result.explanation, line).toBe(rc.allAddedCherryPick)
    }
    expect(run(picking(), 'git add README.md').result.exitCode).toBe(0)
  })

  it('git commit -a посреди конфликта: коммит с метками, обычное сообщение игрока, операция завершена (К11.c)', () => {
    const ids: IdMap = new Map()
    const s = picking()
    const r = run(s, 'git commit -am "всё сразу"')
    expect(r.result.exitCode).toBe(0)
    expect(compareOutputs(normalizeGitOutput('git commit', protocolEntry('К11.c', "git commit -am 'всё сразу'").output), normalizeGitOutput('git commit', r.result.output), ids)).toBeNull()
    expect(r.state.operation).toBeNull()
    expect(r.state.unmerged).toEqual({})
    expect(r.state.commits[r.state.branches.master].tree['app.js']).toContain('<<<<<<< HEAD')
    expect(r.state.commits[r.state.branches.master].message).toBe('всё сразу')
    expect(run(r.state, 'git status').result.output).toBe(protocolEntry('К11.c', 'git status').output)
    expect(r.state.missionsDone.cherryPick).toBe(true)
  })

  it('--continue при неслитых путях — блок A и миссия не засчитана (К5.2); --skip и --abort миссию не дают', () => {
    expect(run(picking(), 'git cherry-pick --continue').state.missionsDone.cherryPick).toBe(false)
    expect(run(picking(), 'git cherry-pick --skip').state.missionsDone.cherryPick).toBe(false)
    expect(run(picking(), 'git cherry-pick --abort').state.missionsDone.cherryPick).toBe(false)
  })

  it('миссия 5 остаётся засчитанной после следующих конфликтов и отмены (часть I, п. 2)', () => {
    const done = run(resolved(), 'git cherry-pick --continue').state
    const later = run(runAll(done, ['git reset --hard HEAD~1']), PICK)
    expect(later.state.operation).not.toBeNull()
    expect(run(later.state, 'git cherry-pick --abort').state.missionsDone.cherryPick).toBe(true)
  })
})

describe('итог совпал с HEAD (К5.6) и пустой cherry-pick с начала (П8.4)', () => {
  const matchesHead = () => run(chooseConflictPart(picking(), 'app.js', 'top'), 'git add app.js').state

  it(`--continue: подсказка про --allow-empty и --skip, затем git status, код 1; операция остаётся (${where('К5.6', 'git cherry-pick --continue')})`, () => {
    const ids: IdMap = new Map()
    const before = matchesHead()
    expect(run(before, 'git status').result.output).toBe(protocolEntry('К5.6', 'git status').output.replace(/ae28885/, (before.operation as { commit: string }).commit.slice(0, 7)))
    const s = same(before, 'К5.6', 'git cherry-pick --continue', ids)
    expect(s.operation).toEqual(before.operation)
    expect(s.commits).toEqual(before.commits)
    expect(run(before, 'git cherry-pick --continue').result.explanation).toBe(rc.cherryPickEmpty)
    expect(before.missionsDone.cherryPick).toBe(false)
  })

  it(`--skip после этого: пусто, статус чист, коммитов нет (${where('К5.6', 'git cherry-pick --skip')})`, () => {
    const ids: IdMap = new Map()
    let s = same(matchesHead(), 'К5.6', 'git cherry-pick --skip', ids)
    expect(s.operation).toBeNull()
    expect(run(s, 'git status').result.output).toBe('On branch master\nnothing to commit, working tree clean')
    expect(protocolEntry('К5.6', 'git status; git log --oneline').output.startsWith('On branch master\nnothing to commit, working tree clean')).toBe(true)
  })

  it('git commit и git commit -m, когда итог совпал с HEAD: отказ области (ответ git не сверен); git commit --allow-empty тоже', () => {
    const s = matchesHead()
    for (const line of ['git commit', 'git commit -m x', 'git commit -am x']) {
      const r = run(s, line)
      refusal(r.result.output)
      expect(bare(r.state), line).toEqual(bare(s))
    }
  })

  it(`пустой cherry-pick с самого начала: подсказка, git status, код 1; выходы --skip и --abort (${where('П8.4', 'git cherry-pick $(git rev-parse --short feature~1)')})`, () => {
    const ids: IdMap = new Map()
    const applied = run(fresh(), PICK).state
    const entry = protocolEntry('П8.4', 'git cherry-pick $(git rev-parse --short feature~1)')
    const r = run(applied, PICK)
    expect(r.result.exitCode).toBe(1)
    expect(compareOutputs(entry.output, r.result.output, ids)).toBeNull()
    expect(r.state.operation).toEqual({ kind: 'cherry-pick', commit: applied.commits[applied.branches.feature].parents[0] })
    expect(r.state.unmerged).toEqual({})
    expect(r.state.reflog).toEqual(applied.reflog)
    expect(r.state.missionsDone.cherryPick).toBe(true)
    const status = same(r.state, 'П8.4', 'git status', ids)
    expect(run(status, 'git cherry-pick --abort').result).toMatchObject({ output: '', exitCode: 0 })
    expect(run(status, 'git cherry-pick --skip').state.operation).toBeNull()
    expect(run(run(status, 'git cherry-pick --abort').state, 'git status').result.output).toBe('On branch master\nnothing to commit, working tree clean')
  })

  it('пустой cherry-pick: остальные команды по таблице «операция идёт, неслитых нет» (К12.c)', () => {
    const empty = run(run(fresh(), PICK).state, PICK).state
    expect(empty.operation).not.toBeNull()
    // Новый cherry-pick, rebase, commit: ответ git при чистом индексе не сверен.
    for (const line of ['git cherry-pick feature', 'git rebase feature', 'git commit -m x', 'git stash', 'git reset --soft HEAD']) {
      const r = run(empty, line)
      refusal(r.result.output)
      expect(bare(r.state), line).toEqual(bare(empty))
    }
    // reset --hard и mixed снимают операцию, как посреди конфликта.
    expect(run(empty, 'git reset --hard').state.operation).toBeNull()
    expect(run(empty, 'git reset').state.operation).toBeNull()
  })

  it('миссия 5 из пустого cherry-pick не засчитывается сама', () => {
    expect(run(fresh(), 'git cherry-pick HEAD').state.missionsDone.cherryPick).toBe(false)
  })
})

describe('reset, checkout -b, checkout HEAD -- посреди cherry-pick (К5.7, К10.c, К13.c, К16.ch)', () => {
  it(`reset --hard: HEAD is now at, операция и неслитые пути сняты, файл чист (${where('К5.7', 'git reset --hard')})`, () => {
    const ids: IdMap = new Map()
    let s = same(picking(), 'К5.7', 'git reset --hard', ids, 0, 'git reset --hard')
    s = same(s, 'К5.7', 'git status', ids, 2)
    expect(s.operation).toBeNull()
    expect(s.unmerged).toEqual({})
    expect(s.working['app.js']).toBe('console.log("v1"); + правка\n')
    expect(s.reflog[0].message).toBe('reset: moving to HEAD')
    const after = run(s, 'git cherry-pick --abort')
    expect(after.result.output).toBe(protocolEntry('К5.7', 'git cherry-pick --abort').output)
    expect(after.result.exitCode).toBe(128)
  })

  it(`reset (mixed): Unstaged changes after reset, метки остаются неподготовленной правкой, операции нет (${where('К10.c', 'git reset')})`, () => {
    const ids: IdMap = new Map()
    let s = same(picking(), 'К10.c', 'git reset', ids)
    s = same(s, 'К10.c', 'git status', ids)
    expect(s.operation).toBeNull()
    expect(s.unmerged).toEqual({})
    expect(s.working['app.js']).toContain('<<<<<<< HEAD')
    expect(run(s, 'git cherry-pick --continue').result.exitCode).toBe(128)
  })

  it(`checkout -b: Switched to a new branch и warning: cancelling a cherry picking in progress; неслитые пути остаются (${where('К13.c', 'git checkout -b other')})`, () => {
    const ids: IdMap = new Map()
    let s = same(picking(), 'К13.c', 'git checkout -b other', ids)
    expect(s.operation).toBeNull()
    expect(Object.keys(s.unmerged)).toEqual(['app.js'])
    expect(s.head).toEqual({ kind: 'branch', name: 'other' })
    s = same(s, 'К13.c', 'git status', ids)
    s = same(s, 'К13.c', 'git branch', ids)
    expect(run(s, 'git cherry-pick --abort').result.exitCode).toBe(128)
  })

  it('checkout -b с занятым именем: обычная ошибка git, операция не бросается', () => {
    const r = run(picking(), 'git checkout -b feature')
    expect(r.result.output).toBe("fatal: a branch named 'feature' already exists")
    expect(r.state.operation).not.toBeNull()
  })

  it(`checkout HEAD -- app.js: молча, путь больше не неслитый, итог совпал с HEAD (${where('К16.ch', 'git checkout HEAD -- app.js')})`, () => {
    const ids: IdMap = new Map()
    let s = same(picking(), 'К16.ch', 'git checkout HEAD -- app.js', ids)
    expect(s.unmerged).toEqual({})
    expect(s.working['app.js']).toBe(s.index['app.js'])
    expect(s.operation).not.toBeNull()
    s = same(s, 'К16.ch', 'git status', ids)
    expect(run(s, 'git cherry-pick --skip').state.operation).toBeNull()
  })

  it('checkout HEAD -- вне конфликта остаётся отказом области; путь не из HEAD — тоже', () => {
    refusal(run(fresh(), 'git checkout HEAD -- app.js').result.output)
    refusal(run(createAppendixFile(picking(), 'new.txt'), 'git checkout HEAD -- new.txt').result.output)
  })
})

describe('операция идёт, неслитых нет (К12.c)', () => {
  it(`git status --short: M  app.js; checkout feature отказывает обычной проверкой правок (${where('К12.c1', 'git checkout feature')})`, () => {
    const ids: IdMap = new Map()
    let s = resolved()
    s = same(s, 'К12.c1', 'git status --short', ids)
    s = same(s, 'К12.c1', 'git checkout feature', ids)
    same(s, 'К12.c1', 'git status', ids)
    expect(s.operation).not.toBeNull()
  })

  it(`cherry-pick <ссылка>: your local changes would be overwritten by cherry-pick (${where('К12.c4', 'git cherry-pick feature')}); rebase: Your index contains uncommitted changes (${where('К12.c5', 'git rebase feature')})`, () => {
    const ids: IdMap = new Map()
    let s = resolved()
    s = same(s, 'К12.c4', 'git cherry-pick feature', ids)
    s = same(s, 'К12.c5', 'git rebase feature', ids)
    expect(s.operation).not.toBeNull()
  })

  it(`stash проходит и молча бросает операцию (${where('К12.c6', 'git stash')}); pop возвращает правку неподготовленной`, () => {
    const ids: IdMap = new Map()
    let s = same(resolved(), 'К12.c6', 'git stash', ids)
    expect(s.operation).toBeNull()
    expect(s.stashes).toHaveLength(1)
    s = same(s, 'К12.c6', 'git status', ids)
    expect(run(resolved(), 'git stash').result.explanation).toContain(rc.operationDroppedByStash)
    expect(s.missionsDone.stashSave).toBe(true)
    const popped = run(s, 'git stash pop')
    expect(popped.result.exitCode).toBe(0)
    expect(run(popped.state, 'git status --short').result.output).toBe(' M app.js')
  })

  it('stash pop и apply с операцией без неслитых путей: ответ git зависит от содержимого тайника и не сверен — отказ области', () => {
    const withStash = runAll(edit(fresh(), 'README.md'), ['git stash -m "для pop"'])
    const picking_ = run(runAll(edit(withStash), ['git commit -am "master: v2"']), PICK).state
    const afterAdd = run(chooseConflictPart(picking_, 'app.js', 'both'), 'git add app.js').state
    for (const line of ['git stash pop', 'git stash apply']) {
      const out = run(afterAdd, line)
      refusal(out.result.output)
      expect(bare(out.state), line).toEqual(bare(afterAdd))
    }
  })

  it('checkout <ветка>, который прошёл бы (индекс совпал с целью), и checkout -b — отказ области: предупреждение при переходе не сверено', () => {
    const toFeature = run(chooseConflictPart(picking(), 'app.js', 'bottom'), 'git add app.js').state
    const r = run(toFeature, 'git checkout feature')
    refusal(r.result.output)
    expect(bare(r.state)).toEqual(bare(toFeature))
    const b = run(resolved(), 'git checkout -b other')
    refusal(b.result.output)
    expect(b.state.operation).not.toBeNull()
  })

  it('stash с «нечего прятать» посреди пустого cherry-pick — отказ области', () => {
    const empty = run(run(fresh(), PICK).state, PICK).state
    refusal(run(empty, 'git stash').result.output)
  })
})

describe('отказы области на формах без протокола', () => {
  it('конфликт в отсоединённом HEAD', () => {
    const s = runAll(onMaster(), ['git checkout --detach'])
    const r = run(s, PICK)
    refusal(r.result.output)
    expect(r.result.output).toBe(ru.appendix.errors.cherryPickDetachedStop)
    expect(bare(r.state)).toEqual(bare(s))
    refusal(run(runAll(fresh(), ['git checkout --detach']), 'git cherry-pick HEAD').result.output)
  })

  it('оба создали файл: add/add — отказ области', () => {
    let s = createAppendixFile(fresh(), 'about.html')
    s = runAll(s, ['git add about.html', 'git commit -m "своя страница"'])
    const r = run(s, 'git cherry-pick feature')
    refusal(r.result.output)
    expect(r.result.output).toBe(ru.appendix.errors.cherryPickConflictKind(['about.html']))
    expect(bare(r.state)).toEqual(bare(s))
  })

  it('конфликт вместе с правкой в тех же файлах — отказ области', () => {
    const s = edit(onMaster())
    const r = run(s, PICK)
    refusal(r.result.output)
    expect(r.result.output).toBe(ru.appendix.errors.cherryPickConflictDirty(['app.js']))
    expect(bare(r.state)).toEqual(bare(s))
  })

  it('удалённый в каталоге файл не мешает конфликту другого файла: отказ только по тем, которых касается копия', () => {
    const s = deleteAppendixFile(onMaster(), 'README.md')
    expect(run(s, PICK).result.exitCode).toBe(1)
  })
})

describe('кнопки редактора и виды для экрана', () => {
  it('getConflictView: операция, неслитый путь с кодом UU, ключи словаря для «чем завершить» и «чем отменить»', () => {
    const view = getConflictView(picking())
    expect(view).toEqual({
      operation: 'cherry-pick',
      headIsNewBase: false,
      unmerged: [{ path: 'app.js', kind: 'both-modified', code: 'UU', kindKey: 'kindBothModified' }],
      allAdded: false,
      finishKey: 'cherryPickFinish',
      abortKey: 'cherryPickAbort',
    })
    expect(typeof rc[view?.finishKey ?? 'cherryPickFinish']).toBe('string')
    expect(typeof rc[view?.abortKey ?? 'cherryPickAbort']).toBe('string')
    expect(typeof rc[view?.unmerged[0].kindKey ?? 'kindBothModified']).toBe('string')
  })

  it('после git add: allAdded, ключ cherryPickFinishAdded; без конфликта — null', () => {
    expect(getConflictView(resolved())).toMatchObject({ operation: 'cherry-pick', unmerged: [], allAdded: true, finishKey: 'cherryPickFinishAdded' })
    expect(getConflictView(fresh())).toBeNull()
    expect(getConflictView(run(resolved(), 'git cherry-pick --continue').state)).toBeNull()
  })

  it('chooseConflictPart: меняет только рабочую версию, index и unmerged остаются, заметка в журнале; git status --short по-прежнему UU (К1.4)', () => {
    const s = picking()
    const picked = s.commits[s.branches.feature].parents[0]
    for (const [part, expected] of [
      ['top', 'console.log("v1"); + правка\n'],
      ['bottom', seed.appFixed],
      ['both', `console.log("v1"); + правка\n${seed.appFixed}`],
    ] as const) {
      const next = chooseConflictPart(s, 'app.js', part)
      expect(next.working['app.js'], part).toBe(expected)
      expect(next.index).toEqual(s.index)
      expect(next.unmerged).toEqual(s.unmerged)
      expect(next.operation).toEqual(s.operation)
      expect(getConflictFiles(next)).toEqual([])
      expect(run(next, 'git status --short').result.output).toBe('UU app.js')
      const note = next.history[next.history.length - 1]
      expect(note).toEqual({ kind: 'note', text: rc.choiceNote(part, 'app.js', 'HEAD', `${picked.slice(0, 7)} (${seed.fixMessage})`, rc.finishCherryPick) })
    }
  })

  it('файл без блоков меток, несуществующий файл — состояние не меняется', () => {
    const s = picking()
    expect(chooseConflictPart(s, 'README.md', 'top')).toBe(s)
    expect(chooseConflictPart(s, 'nosuch.txt', 'both')).toBe(s)
    const done = chooseConflictPart(s, 'app.js', 'top')
    expect(chooseConflictPart(done, 'app.js', 'both')).toBe(done)
  })

  it('✎ дописывает суффикс в закрывающую метку, метки остаются, блок виден кнопкам (решение В3)', () => {
    const s = edit(picking())
    expect(s.working['app.js'].endsWith(' + правка\n')).toBe(true)
    expect(getConflictFiles(s)).toHaveLength(1)
    expect(chooseConflictPart(s, 'app.js', 'top').working['app.js']).toBe('console.log("v1"); + правка\n')
  })

  it('удаление файла посреди конфликта: путь остаётся неслитым, git add фиксирует удаление', () => {
    const s = deleteAppendixFile(picking(), 'app.js')
    expect(Object.keys(s.unmerged)).toEqual(['app.js'])
    const r = run(s, 'git add app.js')
    expect(r.state.unmerged).toEqual({})
    expect('app.js' in r.state.index).toBe(false)
  })
})
