// git rebase с конфликтом, `--continue`, `--skip`, `--abort` (target.md, часть XI, «Раздел 8 (часть X): шаг C»; часть X, места 16–19).
// Вывод сверен с conflicts-git-runs.txt (К6, К7.5–К7.8, К10.b, К11.b, К13.b, К14, К16.b, К16.bh), section8-git-runs.txt (П8.11) и
// detached-head-git-runs.txt (О10): ожидаемые тексты берутся из протокола, id в нём настоящие, у тренажёра свои, поэтому сверка идёт по
// скелету и по соответствию id (appendixProtocolKit.ts). Строки хода `Rebasing (k/n)<CR>` тренажёр не печатает, сверка их срезает.
// Обстановка К6.1: на master закоммичен app.js (в тренажёре версию даёт кнопка ✎: суффикс в той же строке), затем checkout feature и
// rebase master. Обстановка К14.3: master сам создал about.html.
import { describe, expect, it } from 'vitest'
import { compareOutputs, fresh, normalizeGitOutput, protocolEntry, run, runAll, where, type IdMap } from './appendixProtocolKit'
import {
  chooseConflictPart,
  createAppendixFile,
  deleteAppendixFile,
  editAppendixFile,
  getAppendixMissions,
  getBranches,
  getCommits,
  getConflictFiles,
  getConflictView,
  type AppendixState,
} from './appendixSection'
import { currentCommitId } from './appendixRepo'
import { ru } from '../locales/ru'

const seed = ru.appendix.seed
const rc = ru.conflicts
const edit = (s: AppendixState, file = 'app.js') => editAppendixFile(s, file)
const bare = (s: AppendixState) => ({ ...s, history: [] })
const refusal = (output: string) => expect(output.startsWith('[тренажёр]')).toBe(true)
const subjectsOf = (s: AppendixState) => s.reflog.map((e) => e.message)
const short = (id: string) => id.slice(0, 7)
/** app.js в коммите master (в тренажёре — версия после ✎). */
const masterApp = (s: AppendixState) => s.commits[s.branches.master].tree['app.js']

/** Вывод git приведён к тому, что печатает тренажёр: после строки `[detached HEAD …]` у `rebase --continue` git печатает сводку изменений, тренажёр — нет. */
function normalize(command: string, output: string): string {
  const lines = normalizeGitOutput(command, output).split('\n')
  const stat = (line: string) => command === 'git rebase --continue' && /^ \d+ files? changed/.test(line)
  return lines.filter((line) => !stat(line)).join('\n')
}

/** Выполняет `as` (по умолчанию команду протокола) и сверяет вывод и код возврата с записью протокола. */
function same(state: AppendixState, block: string, command: string, ids: IdMap, nth = 0, as = command): AppendixState {
  const entry = protocolEntry(block, command, nth)
  const next = run(state, as)
  const place = `${entry.file}:${entry.line} ${command}`
  expect(next.result.exitCode, `${place} код возврата`).toBe(entry.exitCode)
  expect(compareOutputs(normalize(command, entry.output), normalize(command, next.result.output), ids), place).toBeNull()
  return next.state
}

/** Обстановка К6.1: на master закоммичен app.js, HEAD на feature. */
const onFeature = (): AppendixState => runAll(edit(fresh()), ['git commit -am "master: v2"', 'git checkout feature'])
/** Остановка К6.1: конфликт на первом из двух коммитов. */
const stopped = (): AppendixState => run(onFeature(), 'git rebase master').state
/** Обстановка К14.3: master сам создал about.html. */
const onFeatureWithAbout = (): AppendixState =>
  runAll(createAppendixFile(fresh(), 'about.html'), ['git add about.html', 'git commit -m "master: about"', 'git checkout feature'])
/** Остановка К14.3: первый коммит перенесён, конфликт add/add на втором. */
const stoppedLast = (): AppendixState => run(onFeatureWithAbout(), 'git rebase master').state
/** Конфликт разрешён кнопкой «обе части» и добавлен (К6.3). */
const resolved = (s = stopped()): AppendixState => run(chooseConflictPart(s, 'app.js', 'both'), 'git add app.js').state
/** Конфликт разрешён верхней частью (файл совпал с новой базой, К6.5) и добавлен. */
const resolvedAsBase = (s = stopped()): AppendixState => run(chooseConflictPart(s, 'app.js', 'top'), 'git add app.js').state

describe('остановка на конфликте (К6.1, П8.11)', () => {
  it(`вывод: Auto-merging, CONFLICT, error: could not apply, пять строк hint, Could not apply; код 1, без строки хода (${where('К6.1', 'git rebase master')})`, () => {
    const r = run(onFeature(), 'git rebase master')
    expect(r.result.exitCode).toBe(1)
    expect(r.result.ok).toBe(false)
    const entry = protocolEntry('К6.1', 'git rebase master')
    expect(compareOutputs(normalizeGitOutput('git rebase master', entry.output), r.result.output, new Map())).toBeNull()
    expect(r.result.output.split('\n')).toHaveLength(9)
    expect(entry.output.startsWith('Rebasing (1/2)<CR>')).toBe(true)
    expect(r.result.output).not.toContain('Rebasing')
    // П8.11: тот же вывод в другом прогоне.
    expect(compareOutputs(normalizeGitOutput('git rebase master', protocolEntry('П8.11', 'git rebase master').output), r.result.output, new Map())).toBeNull()
    // id в строках error и Could not apply — исходный коммит ветки, а не копия.
    const fix = onFeature().commits[onFeature().branches.feature].parents[0]
    expect(r.result.output).toContain(`error: could not apply ${short(fix)}... ${seed.fixMessage}`)
    expect(r.result.output.split('\n').at(-1)).toBe(`Could not apply ${short(fix)}... # ${seed.fixMessage}`)
    expect(r.result.explanation).toBe(rc.rebaseConflict(['app.js'], 'feature', true))
  })

  it('состояние: HEAD отсоединён на новой базе, ветка на старом месте, метки в файле, неслитый путь, операция rebase, запись rebase (start) (К6.1, К7.5, место 11)', () => {
    const before = onFeature()
    const s = run(before, 'git rebase master').state
    const fix = before.commits[before.branches.feature].parents[0]
    const about = before.branches.feature
    expect(s.head).toEqual({ kind: 'detached', id: before.branches.master })
    expect(s.branches).toEqual(before.branches)
    expect(s.commits).toEqual(before.commits)
    expect(s.operation).toEqual({
      kind: 'rebase',
      branch: 'feature',
      origHead: about,
      onto: before.branches.master,
      done: [{ id: fix, subject: seed.fixMessage }],
      todo: [{ id: about, subject: seed.aboutMessage }],
      mergeMsg: true,
      committed: false,
    })
    expect(s.unmerged).toEqual({ 'app.js': { kind: 'both-modified', base: seed.appBase, ours: masterApp(before), theirs: seed.appFixed } })
    expect(s.working['app.js']).toBe(`<<<<<<< HEAD\n${masterApp(before)}=======\n${seed.appFixed}>>>>>>> ${short(fix)} (${seed.fixMessage})\n`)
    expect('app.js' in s.index).toBe(false)
    expect(s.index['README.md']).toBe(seed.readme)
    expect(subjectsOf(s).slice(0, 2)).toEqual(['rebase (start): checkout master', before.reflog[0].message])
    expect(s.reflog).toHaveLength(before.reflog.length + 1)
    expect(s.lastCheckout).toEqual(before.lastCheckout)
    expect(s.clock).toBe(before.clock)
    expect(s.missionsDone.rebase).toBe(false)
  })

  it(`метки: вверху HEAD (новая база), внизу свой коммит с подписью \`<id7> (<тема>)\` (опасное место 3; ${where('К6.1', 'cat app.js')})`, () => {
    const s = stopped()
    const fix = s.operation && s.operation.kind === 'rebase' ? s.operation.done[0].id : ''
    const expected = protocolEntry('К6.1', 'cat app.js').output.split('\n')
    const actual = s.working['app.js'].split('\n')
    expect(actual[0]).toBe(expected[0])
    expect(actual[2]).toBe(expected[2])
    expect(actual[4]).toBe(expected[4].replace('871ab0c', short(fix)))
    expect(actual[1]).toBe(masterApp(s).trimEnd())
    expect(actual[3]).toBe('console.log("v1"); // исправлена опечатка в логе')
    expect(getConflictFiles(s)).toEqual([{ path: 'app.js', kind: 'both-modified', topLabel: 'HEAD', bottomLabel: `${short(fix)} (${seed.fixMessage})` }])
  })

  it(`git status по прогону П8.11 (${where('П8.11', 'git status')}) и git log --oneline --all`, () => {
    const ids: IdMap = new Map()
    let s = same(onFeature(), 'П8.11', 'git rebase master', ids)
    s = same(s, 'П8.11', 'git status', ids)
    const all = run(s, 'git log --oneline --all').result.output
    const expected = protocolEntry('П8.11', 'git log --oneline --all --graph').output.split('\n').map((l) => l.replace(/^[*| /\\]+ ?/, '')).filter((l) => l !== '')
    expect(compareOutputs(expected.join('\n'), all, ids)).toBeNull()
  })

  it(`status --short, branch, log --oneline по прогону К6.1 (${where('К6.1', 'git status --short')}, ${where('К6.1', 'git branch')}, ${where('К6.1', 'git log --oneline')})`, () => {
    const ids: IdMap = new Map()
    let s = same(onFeature(), 'К6.1', 'git rebase master', ids)
    s = same(s, 'К6.1', 'git status --short', ids)
    s = same(s, 'К6.1', 'git branch', ids)
    s = same(s, 'К6.1', 'git log --oneline', ids)
    expect(s.operation).not.toBeNull()
  })

  it(`те же команды по прогону О10: status, branch, log --all, reflog (${where('О10', 'git status')})`, () => {
    const ids: IdMap = new Map()
    let s = runAll(fresh(), ['git branch conf master~1', 'git checkout conf'])
    s = runAll(edit(s), ['git commit -am "conf: другая строка"', 'git checkout feature'])
    s = same(s, 'О10', 'git rebase conf', ids)
    s = same(s, 'О10', 'git status', ids)
    s = same(s, 'О10', 'git branch', ids)
    s = same(s, 'О10', 'git log --oneline --all -4', ids)
    s = same(s, 'О10', 'git reflog -2', ids)
    s = same(s, 'О10', 'git checkout master', ids)
    s = same(s, 'О10', 'git switch master', ids)
    s = same(s, 'О10', 'git rebase --abort', ids)
    s = same(s, 'О10', 'git reflog -1', ids)
    s = same(s, 'О10', 'git status', ids, 1)
    expect(s.operation).toBeNull()
  })

  it('граф посреди rebase: HEAD отсоединён и стоит на master, feature на старом месте, ни одного бледного коммита; ветка feature не текущая', () => {
    const s = stopped()
    const commits = getCommits(s)
    expect(commits.find((c) => c.id === s.branches.master)?.decorations).toEqual(['HEAD', 'master'])
    expect(commits.find((c) => c.id === s.branches.feature)?.decorations).toEqual(['feature'])
    expect(commits.some((c) => c.faded)).toBe(false)
    expect(getBranches(s).some((b) => b.current)).toBe(false)
  })

  it('getConflictView: операция rebase, неслитый путь, ключи слов, HEAD здесь — новая база; после git add — все пути добавлены', () => {
    const view = getConflictView(stopped())
    expect(view).toEqual({
      operation: 'rebase',
      headIsNewBase: true,
      unmerged: [{ path: 'app.js', kind: 'both-modified', code: 'UU', kindKey: 'kindBothModified' }],
      allAdded: false,
      finishKey: 'rebaseFinish',
      abortKey: 'rebaseAbort',
    })
    expect(rc[view?.finishKey as 'rebaseFinish']).toContain('git rebase --continue')
    expect(rc.rebaseAbort).toContain('git rebase --abort')
    expect(rc.rebaseAbort).toContain('git rebase --skip')
    expect(getConflictView(resolved())).toMatchObject({ operation: 'rebase', allAdded: true, unmerged: [], finishKey: 'rebaseFinishAdded' })
    expect(getConflictView(fresh())).toBeNull()
  })

  it('кнопка редактора: заметка называет git rebase --continue; метки уходят, index и unmerged не меняются (К1.4)', () => {
    const s = stopped()
    const next = chooseConflictPart(s, 'app.js', 'bottom')
    expect(next.working['app.js']).toBe(seed.appFixed)
    expect(next.unmerged).toEqual(s.unmerged)
    expect(next.index).toEqual(s.index)
    const note = next.history[next.history.length - 1]
    expect(note.kind === 'note' ? note.text : '').toContain('git rebase --continue')
    expect(run(next, 'git status --short').result.output).toBe('UU app.js')
  })

  it('речь остановки: вверху база, внизу свой коммит, add и --continue, --skip, --abort, ветка переедет в конце; совета про merge нет (опасное место 3, место 19)', () => {
    const text = rc.rebaseConflict(['app.js'], 'feature', true)
    for (const part of ['вверху (HEAD) — новая база', 'внизу — твой коммит', 'git add', 'git rebase --continue', 'git rebase --skip', 'git rebase --abort', 'переедет только в самом конце']) {
      expect(text, part).toContain(part)
    }
    expect(text).not.toMatch(/merge/)
    expect(text).not.toMatch(/hint:|error:/)
  })

  it('HEAD при остановке: на первом коммите (К6.1) он на новой базе, на втором (К14.3) на копии первого коммита, база ниже', () => {
    const first = stopped()
    expect(first.head).toEqual({ kind: 'detached', id: first.branches.master })
    expect(getConflictView(first)?.headIsNewBase).toBe(true)
    expect(run(onFeature(), 'git rebase master').result.explanation).toBe(rc.rebaseConflict(['app.js'], 'feature', true))
    expect(rc.rebaseConflict(['app.js'], 'feature', true)).toContain('стоит на новой базе')

    const last = stoppedLast()
    expect(last.head.kind).toBe('detached')
    expect(last.head.kind === 'detached' ? last.head.id : '').not.toBe(last.branches.master)
    expect(last.head.kind === 'detached' ? last.commits[last.head.id].parents : []).toEqual([last.branches.master])
    expect(getConflictView(last)?.headIsNewBase).toBe(false)
    const speech = run(onFeatureWithAbout(), 'git rebase master').result.explanation ?? ''
    expect(speech).toBe(rc.rebaseConflict(['about.html'], 'feature', false))
    expect(speech).not.toContain('стоит на новой базе')
    expect(speech).toContain('стоит на копии первого коммита')
    expect(speech).toContain('вверху (HEAD) — новая база')
    expect(speech).toContain('внизу — твой коммит')
  })

  it('--abort называет отброшенные файлы в порядке байтов UTF-8, а не кодовых единиц UTF-16', () => {
    const base = stopped()
    // U+FF21 (байты EF BC A1) идёт раньше U+1F600 (байты F0 9F 98 80), хотя в UTF-16 суррогат D83D меньше FF21.
    const wide = '\uFF21.txt'
    const smile = '\u{1F600}.txt'
    const dirty = { ...base, index: { ...base.index, [smile]: 'x\n', [wide]: 'y\n' }, working: { ...base.working, [smile]: 'x\n', [wide]: 'y\n' } }
    const speech = run(dirty, 'git rebase --abort').result.explanation ?? ''
    expect(speech).toContain(rc.discardedEdit(['app.js', wide, smile]))
    expect(speech).not.toContain(rc.discardedEdit(['app.js', smile, wide]))
  })

  it('на конфликте миссия 7 не засчитывается', () => {
    expect(stopped().missionsDone.rebase).toBe(false)
  })
})

describe('конфликт на последнем коммите (К14.3)', () => {
  it(`add/add: первый коммит перенесён, HEAD на его копии; вывод, status, status --short, log (${where('К14.3', 'git rebase master')})`, () => {
    const ids: IdMap = new Map()
    const before = onFeatureWithAbout()
    let s = same(before, 'К14.3', 'git rebase master', ids)
    expect(s.head.kind).toBe('detached')
    const copy = s.commits[currentCommitId(s)]
    expect(copy.message).toBe(seed.fixMessage)
    expect(copy.parents).toEqual([before.branches.master])
    expect(s.branches).toEqual(before.branches)
    expect(s.operation && s.operation.kind === 'rebase' ? [s.operation.done.length, s.operation.todo.length] : null).toEqual([2, 0])
    s = same(s, 'К14.3', 'git status', ids)
    s = same(s, 'К14.3', 'git status --short', ids)
    s = same(s, 'К14.3', 'git log --oneline', ids)
    expect(subjectsOf(s).slice(0, 3)).toEqual([`rebase (pick): ${seed.fixMessage}`, 'rebase (start): checkout master', 'checkout: moving from master to feature'])
    expect(s.reflog[0].id).toBe(currentCommitId(s))
  })

  it('метки add/add: вверху файл новой базы, внизу файл свой; подписи (К14.3)', () => {
    const s = stoppedLast()
    const top = ru.fileOps.newFileContent
    expect(s.working['about.html']).toBe(`<<<<<<< HEAD\n${top}\n=======\n${seed.aboutHtml}>>>>>>> ${short(Object.values(s.commits).find((c) => c.message === seed.aboutMessage && c.id === s.branches.feature)?.id ?? '')} (${seed.aboutMessage})\n`)
    const expected = protocolEntry('К14.3', 'cat about.html').output.split('\n')
    expect(s.working['about.html'].split('\n')[0]).toBe(expected[0])
    expect(s.unmerged['about.html'].kind).toBe('both-added')
    expect(getConflictView(s)?.unmerged[0]).toMatchObject({ code: 'AA', kindKey: 'kindBothAdded' })
  })

  it(`после git add: status; --continue печатает коммит и сразу итоговую строку, без строки хода (${where('К14.3', 'git rebase --continue')})`, () => {
    const ids: IdMap = new Map()
    let s = same(onFeatureWithAbout(), 'К14.3', 'git rebase master', ids)
    s = run(chooseConflictPart(s, 'about.html', 'bottom'), 'git add about.html').state
    s = same(s, 'К14.3', 'git status', ids, 1)
    s = same(s, 'К14.3', 'git rebase --continue', ids)
    expect(s.head).toEqual({ kind: 'branch', name: 'feature' })
    expect(s.operation).toBeNull()
    expect(s.unmerged).toEqual({})
    expect(s.working['about.html']).toBe(seed.aboutHtml)
    expect(s.missionsDone.rebase).toBe(true)
    const log = run(s, 'git log --oneline').result.output.split('\n')
    expect(log.slice(0, 3).map((l) => l.slice(l.indexOf(' ')))).toEqual([` (HEAD -> feature) ${seed.aboutMessage}`, ` ${seed.fixMessage}`, ' (master) master: about'])
  })
})

describe('шаги rebase не пишут `checkout:` (К7.5, О10)', () => {
  it('lastCheckout и цель `checkout -` не меняются: после rebase `checkout -` возвращает на master', () => {
    const before = onFeature()
    expect(stopped().lastCheckout).toEqual(before.lastCheckout)
    const done = run(resolved(), 'git rebase --continue').state
    expect(done.lastCheckout).toEqual(before.lastCheckout)
    expect(subjectsOf(done).filter((m) => m.startsWith('checkout:'))).toEqual(subjectsOf(before).filter((m) => m.startsWith('checkout:')))
    const back = run(done, 'git checkout -')
    expect(back.result.output).toBe("Switched to branch 'master'")
  })
})

describe('что запрещено посреди rebase (К6.2)', () => {
  it('--continue, новый rebase, cherry-pick, checkout, stash, cherry-pick --abort: ответы git с кодами из протокола', () => {
    const ids: IdMap = new Map()
    let s = same(onFeature(), 'К6.1', 'git rebase master', ids)
    s = same(s, 'К6.2', 'git rebase --continue', ids)
    s = same(s, 'К6.2', 'git rebase master', ids)
    s = same(s, 'К6.2', 'git cherry-pick master', ids)
    s = same(s, 'К6.2', 'git checkout master', ids)
    s = same(s, 'К6.2', 'git stash', ids)
    s = same(s, 'К6.2', 'git cherry-pick --abort', ids)
    expect(bare(s)).toEqual(bare(stopped()))
  })

  it('merge и merge --abort — вне области (в отсоединённом HEAD отказ области); состояние не меняется', () => {
    const s = stopped()
    for (const line of ['git merge master', 'git merge --abort', 'git pull']) {
      const r = run(s, line)
      refusal(r.result.output)
      expect(r.result.exitCode, line).toBeUndefined()
      expect(bare(r.state), line).toEqual(bare(s))
    }
  })

  it('новый rebase с несуществующим словом или ключом посреди rebase — отказ области (порядок проверок git не сверен)', () => {
    const s = stopped()
    for (const line of ['git rebase nosuch', 'git rebase', 'git rebase -i master', 'git rebase --quit', 'git rebase --onto master feature', 'git rebase master feature']) {
      const r = run(s, line)
      refusal(r.result.output)
      expect(r.result.exitCode, line).toBeUndefined()
      expect(bare(r.state), line).toEqual(bare(s))
    }
  })

  it('commit: блок A и `U\\tapp.js` (К6.4); commit -m x тоже', () => {
    const s = stopped()
    for (const line of ['git commit -m x', 'git commit']) {
      const r = run(s, line)
      expect(r.result.output, line).toBe(protocolEntry('К6.4', 'git commit -m x').output)
      expect(r.result.exitCode).toBe(128)
    }
  })

  it('stash pop и apply: `could not write index`, `needs merge`, тайник остаётся в стопке (К16.b)', () => {
    const withStash = runAll(edit(fresh(), 'README.md'), ['git stash -m "для pop"'])
    const s = run(runAll(edit(withStash), ['git commit -am "master: v2"', 'git checkout feature']), 'git rebase master').state
    expect(s.operation).not.toBeNull()
    const pop = run(s, 'git stash pop')
    expect(pop.result.output).toBe(protocolEntry('К16.b', 'git stash pop').output)
    expect(pop.result.exitCode).toBe(1)
    const apply = run(s, 'git stash apply')
    expect(apply.result.output).toBe(protocolEntry('К16.b', 'git stash apply').output)
    expect(pop.state.stashes).toHaveLength(1)
    expect(apply.state.stashes).toHaveLength(1)
  })

  it('reset --soft HEAD: `Cannot do a soft reset in the middle of a merge.`, код 128 (К10.b)', () => {
    const r = run(stopped(), 'git reset --soft HEAD')
    expect(r.result.output).toBe(protocolEntry('К10.b', 'git reset --soft HEAD').output)
    expect(r.result.exitCode).toBe(128)
    expect(bare(r.state)).toEqual(bare(stopped()))
  })

  it('switch <ветка>: `cannot switch branch while rebasing` и строка про --quit, код 128 (О10); другие формы switch — отказ области', () => {
    const s = stopped()
    const r = run(s, 'git switch master')
    expect(r.result.output).toBe(protocolEntry('О10', 'git switch master').output)
    expect(r.result.exitCode).toBe(128)
    expect(r.result.explanation).toBe(rc.switchWhileRebasing)
    expect(bare(r.state)).toEqual(bare(s))
    for (const line of ['git switch -c other', 'git switch --detach', 'git switch nosuch', 'git switch -']) {
      const other = run(s, line)
      refusal(other.result.output)
      expect(bare(other.state), line).toEqual(bare(s))
    }
  })

  it('switch <ветка> посреди rebase отказывает и когда неслитых путей уже нет (после git add)', () => {
    const r = run(resolved(), 'git switch master')
    expect(r.result.output).toBe(protocolEntry('О10', 'git switch master').output)
    expect(r.result.exitCode).toBe(128)
  })

  it('прочие формы checkout и diff при неслитых путях — отказ области; checkout -- app.js: `path is unmerged` (К4.2)', () => {
    const s = stopped()
    for (const line of ['git checkout --detach', 'git checkout HEAD', 'git checkout -', 'git diff']) {
      const r = run(s, line)
      refusal(r.result.output)
      expect(bare(r.state), line).toEqual(bare(s))
    }
    const r = run(s, 'git checkout -- app.js')
    expect(r.result.output).toBe(protocolEntry('К4.2', 'git checkout -- app.js').output)
  })

  it('удалить ветку, с которой начат rebase, нельзя (она нужна --abort): отказ области; другие ветки удаляются как обычно', () => {
    const s = stopped()
    const r = run(s, 'git branch -D feature')
    refusal(r.result.output)
    expect(bare(r.state)).toEqual(bare(s))
    expect(run(s, 'git branch -d master').result.exitCode).not.toBeUndefined()
  })

  it('stash (сохранение), stash pop и cherry-pick посреди rebase без неслитых путей — отказ области: rebase молча бросать нельзя', () => {
    const withStash = runAll(edit(fresh(), 'README.md'), ['git stash -m "для pop"'])
    const s = resolved(run(runAll(edit(withStash), ['git commit -am "master: v2"', 'git checkout feature']), 'git rebase master').state)
    for (const line of ['git stash', 'git cherry-pick master', 'git stash pop', 'git stash apply']) {
      const r = run(edit(s, 'README.md'), line)
      refusal(r.result.output)
      expect(r.state.operation, line).not.toBeNull()
      expect(r.state.stashes, line).toHaveLength(1)
    }
  })
})

describe('--continue (К6.3, К7.5)', () => {
  it(`add, status, --continue: коммит, итоговая строка, ветка переехала; повторные --continue и --abort: no rebase in progress (${where('К6.3', 'git rebase --continue')})`, () => {
    const ids: IdMap = new Map()
    let s = same(onFeature(), 'К6.1', 'git rebase master', ids)
    s = run(chooseConflictPart(s, 'app.js', 'both'), 'git add app.js').state
    s = same(s, 'К6.3', 'git status', ids)
    s = same(s, 'К6.3', 'git rebase --continue', ids)
    s = same(s, 'К6.3', 'git status', ids, 1)
    s = same(s, 'К6.3', 'git rebase --continue', ids, 1)
    s = same(s, 'К6.3', 'git rebase --abort', ids)
    expect(s.head).toEqual({ kind: 'branch', name: 'feature' })
    expect(s.operation).toBeNull()
    expect(s.unmerged).toEqual({})
  })

  it('результат: две новые копии с сообщениями исходных, ветка на последней, база master на месте, файлы чистые; первая копия содержит разрешённый файл', () => {
    const before = onFeature()
    const s = run(resolved(), 'git rebase --continue').state
    const [last] = [s.commits[s.branches.feature]]
    const first = s.commits[last.parents[0]]
    expect(last.message).toBe(seed.aboutMessage)
    expect(first.message).toBe(seed.fixMessage)
    expect(first.parents).toEqual([before.branches.master])
    expect(first.tree['app.js']).toBe(`${masterApp(before)}${seed.appFixed}`)
    expect(last.tree).toEqual({ ...first.tree, 'about.html': seed.aboutHtml })
    expect(s.branches.master).toBe(before.branches.master)
    expect(s.index).toEqual(last.tree)
    expect(s.working).toEqual(last.tree)
    expect(s.operation).toBeNull()
    expect(s.clock).toBe(before.clock + 2)
    // старые коммиты ветки бледнеют, копии нет
    const faded = getCommits(s).filter((c) => c.faded).map((c) => c.subject)
    expect(faded).toEqual([seed.aboutMessage, seed.fixMessage])
  })

  it(`записи журнала: finish, pick, continue, start (${where('К7.5', 'git reflog', 1)}); миссия 7 засчитана`, () => {
    const s = run(resolved(), 'git rebase --continue').state
    const expected = protocolEntry('К7.5', 'git reflog', 1)
      .output.split('\n')
      .slice(0, 4)
      .map((line) => line.replace(/^\S+ (\([^)]*\) )?HEAD@\{\d+\}: /, ''))
    expect(subjectsOf(s).slice(0, 4)).toEqual(expected)
    expect(subjectsOf(s).slice(0, 4)).toEqual([
      'rebase (finish): returning to refs/heads/feature',
      `rebase (pick): ${seed.aboutMessage}`,
      `rebase (continue): ${seed.fixMessage}`,
      'rebase (start): checkout master',
    ])
    expect(s.reflog[0].id).toBe(s.branches.feature)
    expect(s.reflog[1].id).toBe(s.branches.feature)
    expect(s.missionsDone.rebase).toBe(true)
  })

  it('журнал целиком совпадает с К7.5 по скелету (подписи коммитов, номера HEAD@{n})', () => {
    const ids: IdMap = new Map()
    let s = same(stopped(), 'К7.5', 'git reflog', ids)
    s = run(chooseConflictPart(s, 'app.js', 'both'), 'git add app.js').state
    s = run(s, 'git rebase --continue').state
    const r = run(s, 'git reflog')
    const entry = protocolEntry('К7.5', 'git reflog', 1)
    expect(r.result.output.split('\n')).toHaveLength(entry.output.split('\n').length)
    expect(compareOutputs(entry.output, r.result.output, new Map())).toBeNull()
  })

  it('разрешение без git add: `app.js: needs merge`, код 1, ничего не меняется (К6.2)', () => {
    const s = chooseConflictPart(stopped(), 'app.js', 'both')
    const r = run(s, 'git rebase --continue')
    expect(r.result.output).toBe(protocolEntry('К6.2', 'git rebase --continue').output)
    expect(r.result.exitCode).toBe(1)
    expect(bare(r.state)).toEqual(bare(s))
  })

  it('git add файла с метками принят: коммит с метками, речь предупреждает при add (К1.7)', () => {
    const added = run(stopped(), 'git add app.js')
    expect(added.result.explanation).toContain('остались строки <<<<<<<')
    expect(added.result.explanation).toContain('git rebase --continue')
    const s = run(added.state, 'git rebase --continue').state
    expect(s.commits[s.commits[s.branches.feature].parents[0]].tree['app.js']).toContain('<<<<<<< HEAD')
  })

  it('речь после add всех путей и после --continue: что дальше, выброшенного коммита нет', () => {
    const added = run(chooseConflictPart(stopped(), 'app.js', 'both'), 'git add app.js')
    expect(added.result.explanation).toBe(rc.allAddedRebase)
    const done = run(added.state, 'git rebase --continue')
    expect(done.result.explanation).toContain(rc.rebaseContinued(seed.fixMessage))
    expect(done.result.explanation).toContain('бледные')
  })

  it('неподготовленная правка при --continue — отказ области', () => {
    const s = edit(resolved())
    const r = run(s, 'git rebase --continue')
    refusal(r.result.output)
    expect(bare(r.state)).toEqual(bare(s))
  })

  it('неотслеживаемый файл на пути файла результата — отказ области, ничего не меняется', () => {
    const s = createAppendixFile(resolved(), 'about.html')
    const r = run(s, 'git rebase --continue')
    expect(r.result.output).toBe(ru.appendix.errors.rebaseUntracked('about.html'))
    expect(bare(r.state)).toEqual(bare(s))
  })

  it('неотслеживаемый файл, не мешающий результату, остаётся', () => {
    const s = run(createAppendixFile(resolved(), 'notes.txt'), 'git rebase --continue').state
    expect(s.working['notes.txt']).toBe(`${ru.fileOps.newFileContent}\n`)
    expect(s.index['notes.txt']).toBeUndefined()
  })
})

describe('итог совпал с новой базой (К6.5), --skip (К6.5, К7.6, К14.2)', () => {
  it(`оставлена верхняя часть: status, --continue молча выбрасывает коммит, фикса в истории нет (${where('К6.5', 'git rebase --continue')})`, () => {
    const ids: IdMap = new Map()
    let s = same(onFeature(), 'К6.5', 'git rebase master', ids)
    s = resolvedAsBase(s)
    // status этого состояния в протоколе приклеен к предыдущей команде (К6.5, строки 2570–2581): заголовок как в К6.3, затем чистое дерево
    const header = protocolEntry('К6.3', 'git status').output.split('\n').slice(0, 8).join('\n')
    expect(compareOutputs(`${header}\n\nnothing to commit, working tree clean`, run(s, 'git status').result.output, new Map())).toBeNull()
    s = same(s, 'К6.5', 'git rebase --continue', ids)
    s = same(s, 'К6.5', 'git log --oneline', ids)
    expect(s.operation).toBeNull()
    expect(s.missionsDone.rebase).toBe(true)
    expect(subjectsOf(s)[0]).toBe('rebase (finish): returning to refs/heads/feature')
    expect(subjectsOf(s).some((m) => m.startsWith('rebase (continue)'))).toBe(false)
  })

  it('речь называет выброшенный коммит (опасное место 9); старый коммит бледный', () => {
    const r = run(resolvedAsBase(), 'git rebase --continue')
    expect(r.result.explanation).toContain(`«${seed.fixMessage}»`)
    expect(r.result.explanation).toContain('молча выброшен')
    expect(getCommits(r.state).filter((c) => c.faded).map((c) => c.subject)).toEqual([seed.aboutMessage, seed.fixMessage])
  })

  it(`--skip при неслитых путях: переносит остальное, записей о пропущенном нет (${where('К6.5', 'git rebase --skip')}, ${where('К7.6', 'git reflog')})`, () => {
    const ids: IdMap = new Map()
    let s = same(onFeature(), 'К6.5', 'git rebase master', ids, 1)
    s = same(s, 'К6.5', 'git rebase --skip', ids)
    s = same(s, 'К6.5', 'git log --oneline', ids, 1)
    expect(subjectsOf(s).slice(0, 3)).toEqual(['rebase (finish): returning to refs/heads/feature', `rebase (pick): ${seed.aboutMessage}`, 'rebase (start): checkout master'])
    expect(s.working['app.js']).toBe(masterApp(onFeature()))
    expect(s.unmerged).toEqual({})
    expect(s.missionsDone.rebase).toBe(true)
  })

  it('журнал после --skip совпадает с К7.6 по скелету', () => {
    const s = run(stopped(), 'git rebase --skip').state
    const entry = protocolEntry('К7.6', 'git reflog')
    const r = run(s, 'git reflog')
    expect(r.result.output.split('\n')).toHaveLength(entry.output.split('\n').length)
    expect(compareOutputs(entry.output, r.result.output, new Map())).toBeNull()
  })

  it('--skip: файлы возвращаются к версии HEAD, правка в файле пропадает; неотслеживаемый файл остаётся', () => {
    const s = createAppendixFile(chooseConflictPart(stopped(), 'app.js', 'both'), 'notes.txt')
    const r = run(s, 'git rebase --skip')
    expect(r.result.exitCode).toBe(0)
    expect(r.state.working['notes.txt']).toBeDefined()
    expect(r.state.working['app.js']).toBe(masterApp(onFeature()))
    expect(r.result.explanation).toContain(rc.rebaseSkipped(seed.fixMessage))
  })

  it('--skip на последнем коммите (К14.3): остаётся копия первого коммита, ветка переезжает; итоговая строка та же, что в К6.5', () => {
    const r = run(stoppedLast(), 'git rebase --skip')
    expect(r.result).toMatchObject({ exitCode: 0, output: 'Successfully rebased and updated refs/heads/feature.' })
    expect(r.state.commits[r.state.branches.feature].message).toBe(seed.fixMessage)
    expect(r.state.working['about.html']).toBe(`${ru.fileOps.newFileContent}\n`)
    expect(r.state.missionsDone.rebase).toBe(true)
  })
})

describe('git commit посреди rebase (К6.4, К7.8, К11.b)', () => {
  it(`add, commit без -m: подготовленное сообщение, status «editing a commit», --continue переносит остальное (${where('К6.4', 'git commit')})`, () => {
    const ids: IdMap = new Map()
    let s = same(onFeature(), 'К6.4', 'git rebase master', ids)
    s = same(s, 'К6.4', 'git commit -m x', ids, 0)
    s = run(chooseConflictPart(s, 'app.js', 'both'), 'git add app.js').state
    s = same(s, 'К6.4', 'git commit', ids)
    s = same(s, 'К6.4', 'git status', ids, 0)
    expect(s.operation).toMatchObject({ kind: 'rebase', mergeMsg: false, committed: true })
    s = same(s, 'К6.4', 'git rebase --continue', ids)
    s = same(s, 'К6.4', 'git log --oneline', ids)
    expect(s.operation).toBeNull()
    expect(s.missionsDone.rebase).toBe(true)
    expect(s.missionsDone.cherryPick).toBe(false)
  })

  it(`записи журнала: commit, потом pick и finish, без continue (${where('К7.8', 'git reflog', 1)})`, () => {
    const afterCommit = run(resolved(), 'git commit').state
    expect(subjectsOf(afterCommit)[0]).toBe(`commit: ${seed.fixMessage}`)
    expect(afterCommit.head.kind).toBe('detached')
    expect(afterCommit.branches.feature).toBe(onFeature().branches.feature)
    const s = run(afterCommit, 'git rebase --continue').state
    expect(subjectsOf(s).slice(0, 4)).toEqual(['rebase (finish): returning to refs/heads/feature', `rebase (pick): ${seed.aboutMessage}`, `commit: ${seed.fixMessage}`, 'rebase (start): checkout master'])
    const entry = protocolEntry('К7.8', 'git reflog', 1)
    const r = run(s, 'git reflog')
    expect(r.result.output.split('\n')).toHaveLength(entry.output.split('\n').length)
    expect(compareOutputs(entry.output, r.result.output, new Map())).toBeNull()
  })

  it('commit -m посреди rebase: свое сообщение, коммит в отсоединённом HEAD, rebase продолжается; миссия 5 не засчитывается', () => {
    const r = run(resolved(), 'git commit -m "своё сообщение"')
    expect(r.result.output).toMatch(/^\[detached HEAD [0-9a-f]{7}\] своё сообщение$/)
    expect(r.result.exitCode).toBe(0)
    expect(r.state.operation).toMatchObject({ kind: 'rebase', committed: true })
    expect(r.state.missionsDone.cherryPick).toBe(false)
    expect(r.result.explanation).toContain('editing a commit while rebasing')
    const finished = run(r.state, 'git rebase --continue').state
    expect(finished.commits[finished.commits[finished.branches.feature].parents[0]].message).toBe('своё сообщение')
  })

  it(`commit -a посреди конфликта: берёт неслитый путь с метками, rebase продолжается (${where('К11.b', "git commit -am 'всё сразу'")})`, () => {
    const ids: IdMap = new Map()
    let s = run(onFeature(), 'git rebase master').state
    s = same(s, 'К11.b', "git commit -am 'всё сразу'", ids, 0, 'git commit -am "всё сразу"')
    s = same(s, 'К11.b', 'git status', ids)
    s = same(s, 'К11.b', 'git log --oneline -3', ids)
    expect(s.unmerged).toEqual({})
    expect(s.operation).toMatchObject({ kind: 'rebase', committed: true })
  })

  it('после commit посреди остановки --skip — отказ области (сделанный коммит остался бы)', () => {
    const s = run(resolved(), 'git commit').state
    const r = run(s, 'git rebase --skip')
    refusal(r.result.output)
    expect(bare(r.state)).toEqual(bare(s))
  })

  it('пустой итог (файл совпал с HEAD) и commit без -m в состоянии «editing» — отказ области', () => {
    const empty = run(resolvedAsBase(), 'git commit')
    refusal(empty.result.output)
    const editing = run(resolved(), 'git commit').state
    const again = run(edit(run(editing, 'git add .').state), 'git commit')
    refusal(again.result.output)
  })
})

describe('reset посреди rebase: rebase не снимается (К6.6, К10.b, К14.1, К14.2)', () => {
  it(`reset --hard: HEAD is now at, файлы чистые, status «editing a commit»; --abort возвращает всё (${where('К6.6', 'git reset --hard')})`, () => {
    const ids: IdMap = new Map()
    let s = same(onFeature(), 'К6.6', 'git rebase master', ids)
    s = same(s, 'К6.6', 'git reset --hard', ids)
    s = same(s, 'К6.6', 'git status', ids, 0)
    expect(s.operation).toMatchObject({ kind: 'rebase', mergeMsg: false, committed: false })
    expect(s.unmerged).toEqual({})
    s = same(s, 'К6.6', 'git rebase --abort', ids)
    const both = [run(s, 'git status').result.output, run(s, 'git log --oneline').result.output].join('\n')
    expect(compareOutputs(protocolEntry('К6.6', 'git status; git log --oneline').output, both, ids)).toBeNull()
  })

  it('reset --hard: речь — rebase не снят, называет --continue, --skip, --abort (опасное место 6)', () => {
    const r = run(stopped(), 'git reset --hard')
    expect(r.result.explanation).toContain(rc.resetHardRebase)
    for (const part of ['rebase от этого не отменился', 'git rebase --continue', 'git rebase --skip', 'git rebase --abort']) expect(rc.resetHardRebase, part).toContain(part)
  })

  it(`reset --hard, затем --continue: коммит с конфликтом не попадает в ветку (${where('К14.1', 'git rebase --continue')})`, () => {
    const ids: IdMap = new Map()
    let s = run(onFeature(), 'git rebase master').state
    s = same(s, 'К14.1', 'git reset --hard', ids)
    s = same(s, 'К14.1', 'git rebase --continue', ids)
    s = same(s, 'К14.1', 'git status', ids)
    const log = run(s, 'git log --oneline').result.output.split('\n')
    expect(log.slice(0, 2).map((l) => l.slice(l.indexOf(' ') + 1))).toEqual([`(HEAD -> feature) ${seed.aboutMessage}`, `(master) ${'master: v2'}`])
    expect(s.commits[s.branches.feature].parents).toEqual([s.branches.master])
    expect(subjectsOf(s).slice(0, 3)).toEqual(['rebase (finish): returning to refs/heads/feature', `rebase (pick): ${seed.aboutMessage}`, 'rebase (start): checkout master'])
    expect(s.missionsDone.rebase).toBe(true)
  })

  it(`reset --hard, затем --skip: тот же итог (${where('К14.2', 'git rebase --skip')})`, () => {
    const ids: IdMap = new Map()
    let s = run(onFeature(), 'git rebase master').state
    s = same(s, 'К14.2', 'git reset --hard', ids)
    s = same(s, 'К14.2', 'git rebase --skip', ids)
    expect(s.commits[s.branches.feature].parents).toEqual([s.branches.master])
    expect(s.missionsDone.rebase).toBe(true)
  })

  it(`reset (mixed): метки остаются неподготовленной правкой, rebase продолжается (${where('К10.b', 'git reset')})`, () => {
    const ids: IdMap = new Map()
    let s = run(onFeature(), 'git rebase master').state
    s = same(s, 'К10.b', 'git reset --soft HEAD', ids)
    s = same(s, 'К10.b', 'git reset', ids)
    s = same(s, 'К10.b', 'git status', ids)
    expect(s.working['app.js']).toContain('<<<<<<< HEAD')
    expect(s.unmerged).toEqual({})
    expect(run(s, 'git reset').result.explanation).toContain(rc.resetMixedRebase)
  })

  it('reset --hard явным HEAD то же; reset на другую ссылку и reset --soft без неслитых путей — отказ области', () => {
    expect(run(stopped(), 'git reset --hard HEAD').result.output).toMatch(/^HEAD is now at /)
    const afterReset = run(stopped(), 'git reset --hard').state
    for (const line of ['git reset --hard feature', 'git reset HEAD~1', 'git reset --soft HEAD']) {
      const r = run(afterReset, line)
      refusal(r.result.output)
      expect(bare(r.state), line).toEqual(bare(afterReset))
    }
  })

  it('--continue после reset (mixed) с метками в каталоге — отказ области (неподготовленная правка)', () => {
    const s = run(stopped(), 'git reset').state
    const r = run(s, 'git rebase --continue')
    refusal(r.result.output)
    expect(bare(r.state)).toEqual(bare(s))
  })
})

describe('--abort (К6.6, К7.7, П8.11, О10)', () => {
  it('пусто, код 0; HEAD на ветке, ветка, коммиты и файлы как до rebase; брошенные копии бледнеют; запись rebase (abort)', () => {
    const before = onFeature()
    const r = run(stopped(), 'git rebase --abort')
    expect(r.result).toMatchObject({ ok: true, output: '', exitCode: 0 })
    const s = r.state
    expect(s.head).toEqual({ kind: 'branch', name: 'feature' })
    expect(s.branches).toEqual(before.branches)
    expect(s.index).toEqual(before.index)
    expect(s.working).toEqual(before.working)
    expect(s.operation).toBeNull()
    expect(s.unmerged).toEqual({})
    expect(subjectsOf(s)[0]).toBe('rebase (abort): returning to refs/heads/feature')
    expect(s.reflog[0].id).toBe(before.branches.feature)
    expect(r.result.explanation).toContain(rc.rebaseAborted('feature'))
  })

  it(`журнал совпадает с К7.7 по скелету (${where('К7.7', 'git reflog')}); журнал ветки (reflog show) — отказ области`, () => {
    const s = run(stopped(), 'git rebase --abort').state
    const entry = protocolEntry('К7.7', 'git reflog')
    const r = run(s, 'git reflog')
    expect(r.result.output.split('\n')).toHaveLength(entry.output.split('\n').length)
    expect(compareOutputs(entry.output, r.result.output, new Map())).toBeNull()
    refusal(run(s, 'git reflog show feature').result.output)
  })

  it('abort на последнем коммите (К14.3): созданная копия первого коммита бледная, add/add файл вернулся к версии ветки', () => {
    const before = onFeatureWithAbout()
    const s = run(stoppedLast(), 'git rebase --abort').state
    expect(s.working).toEqual(before.working)
    expect(s.index).toEqual(before.index)
    expect(getCommits(s).filter((c) => c.faded)).toHaveLength(1)
  })

  it('abort после commit посреди остановки и после reset --hard: ветка и файлы как до rebase (К6.6)', () => {
    const before = onFeature()
    for (const s of [run(resolved(), 'git commit').state, run(stopped(), 'git reset --hard').state]) {
      const out = run(s, 'git rebase --abort').state
      expect(out.branches).toEqual(before.branches)
      expect(out.working).toEqual(before.working)
      expect(out.head).toEqual({ kind: 'branch', name: 'feature' })
    }
  })

  it('abort теряет несохранённые правки: речь называет файлы; неотслеживаемый файл остаётся', () => {
    const s = createAppendixFile(chooseConflictPart(stopped(), 'app.js', 'both'), 'notes.txt')
    const r = run(s, 'git rebase --abort')
    expect(r.state.working['notes.txt']).toBeDefined()
    expect(r.result.explanation).toContain('«app.js»')
  })

  it('миссию 7 не засчитывает', () => {
    expect(run(stopped(), 'git rebase --abort').state.missionsDone.rebase).toBe(false)
  })
})

describe('checkout -b и checkout HEAD -- посреди rebase (К13.b, К16.bh)', () => {
  it(`checkout -b: ветка создана без предупреждения, операция продолжается; status начинается с «On branch» (${where('К13.b', 'git checkout -b other')})`, () => {
    const ids: IdMap = new Map()
    let s = run(onFeature(), 'git rebase master').state
    s = same(s, 'К13.b', 'git checkout -b other', ids)
    s = same(s, 'К13.b', 'git status', ids)
    s = same(s, 'К13.b', 'git branch', ids)
    expect(s.head).toEqual({ kind: 'branch', name: 'other' })
    expect(s.operation).toMatchObject({ kind: 'rebase', branch: 'feature' })
    expect(Object.keys(s.unmerged)).toEqual(['app.js'])
    expect(run(stopped(), 'git checkout -b other').result.explanation).toBe(rc.rebaseCheckoutBranch('feature'))
    expect(run(stopped(), 'git checkout -b other').result.output).not.toContain('warning')
  })

  it('после checkout -b выходы из rebase и коммит — отказ области; новый rebase — блок о rebase-merge', () => {
    const s = run(stopped(), 'git checkout -b other').state
    for (const line of ['git rebase --continue', 'git rebase --skip', 'git rebase --abort', 'git commit -am x']) {
      const r = run(s, line)
      refusal(r.result.output)
      expect(bare(r.state), line).toEqual(bare(s))
    }
    expect(run(s, 'git rebase master').result.exitCode).toBe(128)
  })

  it(`checkout HEAD -- app.js: молча, файл версии HEAD, путь больше не неслитый, status «all conflicts fixed» (${where('К16.bh', 'git checkout HEAD -- app.js')})`, () => {
    const ids: IdMap = new Map()
    let s = run(onFeature(), 'git rebase master').state
    s = same(s, 'К16.bh', 'git checkout HEAD -- app.js', ids)
    s = same(s, 'К16.bh', 'git status', ids)
    expect(s.working['app.js']).toBe(masterApp(onFeature()))
    expect(run(stopped(), 'git checkout HEAD -- app.js').result.explanation).toContain('git rebase --continue')
    // итог совпал с HEAD: --continue молча выбрасывает коммит
    const done = run(s, 'git rebase --continue')
    expect(done.result.output).toBe('Successfully rebased and updated refs/heads/feature.')
    expect(done.result.explanation).toContain('молча выброшен')
  })
})

describe('rebase: прежнее поведение и границы области', () => {
  it('rebase без конфликта из прошлых шагов не изменился: перенос, up to date', () => {
    const s = runAll(fresh(), ['git checkout feature'])
    const r = run(s, 'git rebase master')
    expect(r.result).toMatchObject({ exitCode: 0, output: 'Successfully rebased and updated refs/heads/feature.' })
    expect(run(r.state, 'git rebase master').result.output).toBe('Current branch feature is up to date.')
  })

  it('--continue и --abort без rebase: `fatal: no rebase in progress`, код 128, и на ветке, и в отсоединённом HEAD (К6.3, К6.7)', () => {
    for (const s of [fresh(), runAll(fresh(), ['git checkout --detach HEAD~1'])]) {
      for (const line of ['git rebase --continue', 'git rebase --abort']) {
        const r = run(s, line)
        expect(r.result).toMatchObject({ ok: false, exitCode: 128, output: protocolEntry('К6.7', 'git rebase --continue').output })
        expect(bare(r.state)).toEqual(bare(s))
      }
    }
  })

  it('--skip без rebase и --quit — отказ области', () => {
    for (const line of ['git rebase --skip', 'git rebase --quit']) {
      const r = run(fresh(), line)
      refusal(r.result.output)
      expect(r.result.exitCode).toBeUndefined()
    }
  })

  it('rebase с конфликтом, начатый с отсоединённого HEAD, — отказ области, как rebase в отсоединённом HEAD (решение владельца)', () => {
    const s = runAll(onFeature(), ['git checkout --detach feature'])
    const r = run(s, 'git rebase master')
    expect(r.result.output).toBe(ru.appendix.errors.rebaseDetached)
    expect(r.result.exitCode).toBeUndefined()
    expect(bare(r.state)).toEqual(bare(s))
  })

  it('чужая операция: --continue и --abort rebase при идущем cherry-pick — no rebase in progress; cherry-pick --continue/--abort посреди rebase — no cherry-pick or revert in progress (К6.2, К6.7)', () => {
    const picking = run(runAll(edit(fresh()), ['git commit -am "master: v2"']), 'git cherry-pick feature~1').state
    expect(picking.operation?.kind).toBe('cherry-pick')
    for (const line of ['git rebase --continue', 'git rebase --abort']) expect(run(picking, line).result).toMatchObject({ exitCode: 128, output: 'fatal: no rebase in progress' })
    const rebasing = stopped()
    for (const line of ['git cherry-pick --continue', 'git cherry-pick --abort']) {
      expect(run(rebasing, line).result).toMatchObject({ exitCode: 128, output: protocolEntry('К6.2', 'git cherry-pick --abort').output })
    }
    refusal(run(rebasing, 'git cherry-pick --skip').result.output)
  })

  it('конфликт вида «изменение и удаление»: отказ области, ничего не меняется', () => {
    // topic удаляет app.js, а master его изменил: перенос коммита с удалением даёт конфликт «изменение и удаление»
    const topic = runAll(deleteAppendixFile(runAll(fresh(), ['git checkout -b topic']), 'app.js'), ['git add app.js', 'git commit -m "удалить app.js"'])
    const s = runAll(edit(runAll(topic, ['git checkout master'])), ['git commit -am "master: v2"', 'git checkout topic'])
    const r = run(s, 'git rebase master')
    refusal(r.result.output)
    expect(r.result.exitCode).toBeUndefined()
    expect(r.result.output).toContain('«app.js»')
    expect(bare(r.state)).toEqual(bare(s))
  })

  it('остановка не по сверенным шагам (три своих коммита) — отказ области до изменений', () => {
    // конфликт на первом из трёх коммитов: сделан один, осталось два
    const base = runAll(edit(fresh()), ['git commit -am "master: v2"', 'git checkout feature'])
    const s = runAll(createAppendixFile(base, 'extra.txt'), ['git add extra.txt', 'git commit -m "третий"'])
    const r = run(s, 'git rebase master')
    expect(r.result.output).toBe(ru.appendix.errors.rebaseStopUnverified)
    expect(r.result.exitCode).toBeUndefined()
    expect(bare(r.state)).toEqual(bare(s))
  })

  it('остановка вместе с пропущенным применённым коммитом — отказ области до изменений', () => {
    // master применил fix через cherry-pick и сам создал about.html: fix пропускается, на about.html конфликт add/add
    const onMaster = runAll(createAppendixFile(fresh(), 'about.html'), ['git cherry-pick feature~1', 'git add about.html', 'git commit -m "master: about"', 'git checkout feature'])
    const r = run(onMaster, 'git rebase master')
    expect(r.result.output).toBe(ru.appendix.errors.rebaseStopUnverified)
    expect(bare(r.state)).toEqual(bare(onMaster))
  })

  it('второй конфликт при переносе после --continue — отказ области, rebase остаётся на прежней остановке', () => {
    // конфликт на fix, а после него about.html снова конфликтует (master создал его сам)
    const onMaster = runAll(createAppendixFile(edit(fresh()), 'about.html'), ['git add about.html', 'git commit -am "master: v2 и about"', 'git checkout feature'])
    const added = resolved(run(onMaster, 'git rebase master').state)
    const r = run(added, 'git rebase --continue')
    expect(r.result.output).toBe(ru.appendix.errors.rebaseNextConflict(seed.aboutMessage))
    expect(r.result.exitCode).toBeUndefined()
    expect(bare(r.state)).toEqual(bare(added))
  })
})

describe('миссия 7 (часть X, «Миссии»; часть XI, «Миссии»)', () => {
  const done = (s: AppendixState) => getAppendixMissions(s).find((m) => m.id === 'rebase')?.done

  it('засчитывается по --continue и по --skip, закончившимся итоговой строкой, в том числе после остановки на конфликте', () => {
    expect(done(stopped())).toBe(false)
    expect(done(run(resolved(), 'git rebase --continue').state)).toBe(true)
    expect(done(run(stopped(), 'git rebase --skip').state)).toBe(true)
    expect(done(run(run(stopped(), 'git reset --hard').state, 'git rebase --continue').state)).toBe(true)
    expect(done(run(stoppedLast(), 'git rebase --skip').state)).toBe(true)
  })

  it('не засчитывается: остановка, --abort, отказы, неподходящий --continue', () => {
    expect(done(run(stopped(), 'git rebase --abort').state)).toBe(false)
    expect(done(run(stopped(), 'git rebase --continue').state)).toBe(false)
    expect(done(run(stopped(), 'git rebase master').state)).toBe(false)
    expect(done(run(edit(resolved()), 'git rebase --continue').state)).toBe(false)
    expect(done(run(fresh(), 'git rebase --continue').state)).toBe(false)
  })

  it('прежние условия не ослаблены: перенос и перемотка засчитываются, `up to date` нет; засчитанная остаётся после --abort', () => {
    const moved = run(runAll(fresh(), ['git checkout feature']), 'git rebase master').state
    expect(done(moved)).toBe(true)
    expect(done(run(moved, 'git rebase master').state)).toBe(true)
    expect(done(run(runAll(fresh(), ['git checkout feature']), 'git rebase feature').state)).toBe(false)
    const after = run(run(runAll(edit(moved, 'README.md'), ['git commit -am x']), 'git checkout feature').state, 'git rebase --abort').state
    expect(done(after)).toBe(true)
  })
})
