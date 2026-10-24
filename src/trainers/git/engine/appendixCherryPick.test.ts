// git cherry-pick (target.md, часть X, место 13, «Автор и дата в разделе 8», «Что НЕ входит», «Миссии»; часть XII, «Команды в
// отсоединённом HEAD»). Блоки протокола проигрываются на движке: вывод и код возврата каждой команды сверяются с настоящим
// git 2.53.0 (appendixProtocolKit.ts). Новые прогоны лежат в appendix-g18g2-git-runs.txt (П8.75–П8.78, П8.80); отказ при правке,
// usage и bad revision — ещё в section8-git-runs.txt (П8.4, П8.10), отсоединённый HEAD — в detached-head-git-runs.txt (О18).
import { describe, expect, it } from 'vitest'
import { compareOutputs, fresh, protocolEntry, replayBlock, run, runAll, where, type IdMap, type ReplayOptions } from './appendixProtocolKit'
import { createAppendixFile, deleteAppendixFile, editAppendixFile, getAppendixMissions, getCommits, type AppendixState } from './appendixSection'
import { ru } from '../locales/ru'

const ax = ru.appendix.explain
const ae = ru.appendix.errors
const seed = ru.appendix.seed
const short = (id: string) => id.slice(0, 7)
/** Шаги сценария: `edit`, `mkfile`, `rm` — кнопки, остальное — команды git. */
const play = (state: AppendixState, steps: readonly string[]): AppendixState =>
  steps.reduce((s, step) => {
    const file = /^(edit|mkfile|rm) (\S+)$/.exec(step)
    if (file === null) return run(s, step).state
    return file[1] === 'edit' ? editAppendixFile(s, file[2]) : file[1] === 'mkfile' ? createAppendixFile(s, file[2]) : deleteAppendixFile(s, file[2])
  }, state)
const refusal = (output: string) => expect(output.startsWith('[тренажёр]')).toBe(true)
/** Состояние без истории терминала: то, что команда обязана оставить как было при отказе. */
const core = (s: AppendixState) => ({ head: s.head, branches: s.branches, index: s.index, working: s.working, reflog: s.reflog, commits: s.commits, lastCheckout: s.lastCheckout })

function expectReplay(block: string | readonly string[], options: ReplayOptions = {}): void {
  const replay = replayBlock(block, options)
  const problems = replay.steps.filter((s) => s.mismatch !== null).map((s) => `${s.entry.file}:${s.entry.line} «${s.entry.command}» — ${s.mismatch}`)
  expect(problems).toEqual([])
  expect(replay.steps.length).toBeGreaterThan(0)
}

describe('блоки протокола П8.75–П8.80 и О18 проигрываются на движке', () => {
  // Пустая копия: П8.75 и П8.78 сняты в порядке терминала, статус первым, подсказка после него; строки сверяются по порядку.
  it('П8.75: ссылки, запись журнала, граф; повтор уже применённого — статус и подсказка, код 1', () => expectReplay('П8.75'))
  it('П8.76: аннотированный тег, id7, полный id, ошибки', () => expectReplay('П8.76'))
  it('П8.77: правка в файле коммита, посторонний файл, подготовленная правка, неотслеживаемый файл', () => expectReplay('П8.77'))
  it('П8.78: пустая копия и конфликт — cherry-pick остановился, --abort возвращает всё как было', () => expectReplay('П8.78'))
  it('П8.80: правки в нескольких местах, файл удалён в каталоге, удаление файла коммитом', () => expectReplay('П8.80'))
  it('О18: cherry-pick в отсоединённом HEAD', () => expectReplay('О18'))
})

describe('успех: копия поверх HEAD с новым id, оригинал на месте (П8.4, П8.75)', () => {
  it(`печатает только первую строку [master <id7>] <тема>; Date и диффстат не печатаются (${where('П8.75', 'git cherry-pick feature~1')}, ${where('П8.4', 'git checkout -- app.js; git cherry-pick $(git rev-parse --short feature~1)')})`, () => {
    const s = fresh()
    const r = run(s, 'git cherry-pick feature~1')
    const copy = r.state.branches.master
    expect(r.result).toMatchObject({ ok: true, exitCode: 0, output: `[master ${short(copy)}] ${seed.fixMessage}` })
    expect(r.result.output.split('\n')).toHaveLength(1)
    expect(r.result.explanation).toContain(ax.cherryPickDone)
    expect(compareOutputs(protocolEntry('П8.75', 'git cherry-pick feature~1').output.split('\n')[0], r.result.output, new Map() as IdMap)).toBeNull()
  })

  it('новый коммит: другой id, родитель — прежний HEAD, то же сообщение, дерево HEAD плюс изменение; оригинал и feature не тронуты', () => {
    const s = fresh()
    const r = run(s, 'git cherry-pick feature~1')
    const copy = r.state.commits[r.state.branches.master]
    const original = s.commits[s.branches.feature].parents[0]
    expect(copy.id).not.toBe(original)
    expect(copy.parents).toEqual([s.branches.master])
    expect(copy.message).toBe(seed.fixMessage)
    expect(copy.tree).toEqual({ 'app.js': seed.appFixed, 'README.md': seed.readme })
    expect(r.state.branches.feature).toBe(s.branches.feature)
    expect(r.state.commits[original]).toEqual(s.commits[original])
    expect(r.state.index).toEqual(copy.tree)
    expect(r.state.working).toEqual(copy.tree)
    expect(r.state.clock).toBe(s.clock + 1)
  })

  it(`запись журнала «cherry-pick: <тема>», HEAD@{1} — прежнее место (${where('П8.75', 'git reflog -2')}, ${where('П8.5', 'git reflog')})`, () => {
    const s = fresh()
    const r = run(s, 'git cherry-pick feature~1')
    expect(r.state.reflog[0]).toEqual({ id: r.state.branches.master, message: `cherry-pick: ${seed.fixMessage}` })
    expect(r.state.reflog[1]).toEqual(s.reflog[0])
    expect(r.state.reflog).toHaveLength(s.reflog.length + 1)
    expect(run(r.state, 'git reflog -1').result.output).toMatch(/^[0-9a-f]{7} \(HEAD -> master\) HEAD@\{0\}: cherry-pick: fix: опечатка в логе$/)
  })

  it('принимает ветку, тег (в том числе аннотированный), id7, полный id, HEAD@{n}, ~ и ^ (' + where('П8.76', 'git cherry-pick v1.1.0') + ')', () => {
    const s = play(fresh(), ['git tag -a v1.1.0 -m "Релиз" feature~1', 'git tag light feature'])
    const fix = s.commits[s.branches.feature].parents[0]
    for (const word of ['v1.1.0', short(fix), fix, 'feature~1', 'feature^', 'HEAD@{2}']) {
      const r = run(s, `git cherry-pick ${word}`)
      expect(r.result.exitCode, word).toBe(0)
      expect(r.state.commits[r.state.branches.master].message, word).toBe(word === 'HEAD@{2}' ? seed.aboutMessage : seed.fixMessage)
    }
    expect(run(s, 'git cherry-pick light').state.commits[run(s, 'git cherry-pick light').state.branches.master].tree['about.html']).toBe(seed.aboutHtml)
  })

  it('два cherry-pick подряд: «О проекте» лёг поверх фикса, граф показывает обе копии, брошенных коммитов нет (' + where('П8.75', 'git cherry-pick feature') + ')', () => {
    const s = runAll(fresh(), ['git cherry-pick feature~1', 'git cherry-pick feature'])
    const commits = getCommits(s)
    expect(commits.map((c) => c.subject).slice(0, 3)).toEqual([seed.aboutMessage, seed.fixMessage, seed.readmeMessage])
    expect(commits.every((c) => !c.faded)).toBe(true)
    expect(s.commits[s.branches.master].tree).toEqual({ 'app.js': seed.appFixed, 'about.html': seed.aboutHtml, 'README.md': seed.readme })
    expect(s.reflog.slice(0, 2).map((e) => e.message)).toEqual([`cherry-pick: ${seed.aboutMessage}`, `cherry-pick: ${seed.fixMessage}`])
  })

  it('на feature: README ложится поверх «О проекте», feature двигается, master остаётся', () => {
    const s = runAll(fresh(), ['git checkout feature'])
    const r = run(s, 'git cherry-pick master')
    expect(r.result.output).toMatch(/^\[feature [0-9a-f]{7}\] Добавить README$/)
    expect(r.state.branches.master).toBe(s.branches.master)
    expect(r.state.branches.feature).not.toBe(s.branches.feature)
  })

  it('удаление файла коммитом: файл уходит из рабочего каталога и индекса (' + where('П8.80', 'git cherry-pick del') + ')', () => {
    const s = play(fresh(), ['git checkout -b del', 'rm README.md', 'git commit -am "Удалить README"', 'git checkout master'])
    expect(s.working['README.md']).toBeDefined()
    const r = run(s, 'git cherry-pick del')
    expect(r.result.output).toMatch(/^\[master [0-9a-f]{7}\] Удалить README$/)
    expect(r.state.working['README.md']).toBeUndefined()
    expect(r.state.index['README.md']).toBeUndefined()
    expect(r.state.commits[r.state.branches.master].tree['README.md']).toBeUndefined()
  })
})

describe('cherry-pick в отсоединённом HEAD: двигается только HEAD (О18)', () => {
  it(`[detached HEAD <id7>], ветки на месте, запись «cherry-pick: <тема>», речь о брошенном коммите (${where('О18', 'git cherry-pick feature')})`, () => {
    const s = runAll(fresh(), ['git checkout --detach master'])
    const r = run(s, 'git cherry-pick feature')
    const copy = (r.state.head as { kind: 'detached'; id: string }).id
    expect(r.result.output).toBe(`[detached HEAD ${short(copy)}] ${seed.aboutMessage}`)
    expect(r.state.branches).toEqual(s.branches)
    expect(r.state.head.kind).toBe('detached')
    expect(r.state.reflog[0]).toEqual({ id: copy, message: `cherry-pick: ${seed.aboutMessage}` })
    expect(r.state.lastCheckout).toEqual(s.lastCheckout)
    expect(r.result.explanation).toContain(ax.cherryPickDetached)
    expect(run(r.state, 'git status').result.output).toBe('HEAD detached from refs/heads/master\nnothing to commit, working tree clean')
  })

  it('миссия 5 в отсоединённом HEAD засчитывается: формулировка «успешный cherry-pick, создавший коммит» (target.md, часть XII, «Миссии»)', () => {
    const s = runAll(fresh(), ['git checkout --detach master'])
    expect(run(s, 'git cherry-pick feature').state.missionsDone.cherryPick).toBe(true)
  })

  it('уход на ветку оставляет копию без ветки: предупреждение и бледный коммит', () => {
    const s = runAll(fresh(), ['git checkout --detach master', 'git cherry-pick feature'])
    const left = run(s, 'git checkout master')
    expect(left.result.output).toContain('Warning: you are leaving 1 commit behind')
    expect(getCommits(left.state).filter((c) => c.faded)).toHaveLength(1)
  })
})

describe('ошибки git: usage, bad revision, HEAD@{n} за концом журнала', () => {
  it(`без аргументов — usage дословно, код 129, ничего не меняется (${where('П8.4', 'git cherry-pick')}, ${where('П8.76', 'git cherry-pick')})`, () => {
    const s = fresh()
    const r = run(s, 'git cherry-pick')
    expect(r.result).toMatchObject({ ok: false, exitCode: 129 })
    expect(r.result.output).toBe(protocolEntry('П8.4', 'git cherry-pick').output)
    expect(r.result.output).toBe(protocolEntry('П8.76', 'git cherry-pick').output)
    expect(r.result.explanation).toBe(ax.cherryPickUsage)
    expect(core(r.state)).toEqual(core(s))
  })

  it(`cherry-pick nosuch → fatal: bad revision 'nosuch', код 128; то же у HEAD~9 (${where('П8.4', 'git cherry-pick nosuch')}, ${where('П8.76', 'git cherry-pick HEAD~9')})`, () => {
    const s = fresh()
    for (const word of ['nosuch', 'HEAD~9']) {
      const r = run(s, `git cherry-pick ${word}`)
      expect(r.result).toMatchObject({ ok: false, exitCode: 128, output: `fatal: bad revision '${word}'` })
      expect(core(r.state)).toEqual(core(s))
    }
    expect(protocolEntry('П8.4', 'git cherry-pick nosuch').output).toBe("fatal: bad revision 'nosuch'")
    expect(protocolEntry('П8.76', 'git cherry-pick HEAD~9').output).toBe("fatal: bad revision 'HEAD~9'")
  })

  it(`HEAD@{99}: fatal: log for 'HEAD' only has N entries, код 128 (${where('П8.76', 'git cherry-pick HEAD@{99}')})`, () => {
    const s = fresh()
    const r = run(s, 'git cherry-pick HEAD@{99}')
    expect(r.result).toMatchObject({ ok: false, exitCode: 128, output: "fatal: log for 'HEAD' only has 6 entries" })
    expect(core(r.state)).toEqual(core(s))
  })

  it('отказ git не засчитывает миссию 5', () => {
    for (const line of ['git cherry-pick', 'git cherry-pick nosuch', 'git cherry-pick HEAD@{99}']) expect(run(fresh(), line).state.missionsDone.cherryPick, line).toBe(false)
  })
})

describe('правки в рабочем каталоге и в индексе (П8.4, П8.10, П8.77, П8.80)', () => {
  const PICK = 'git cherry-pick feature~1'

  it(`правка в файле, который меняет коммит: error … would be overwritten by merge, Aborting, fatal: cherry-pick failed, код 128, правка на месте (${where('П8.4', 'edit; git cherry-pick $(git rev-parse feature~1)')}, ${where('П8.77', 'git cherry-pick feature~1')})`, () => {
    const s = play(fresh(), ['edit app.js'])
    const r = run(s, PICK)
    expect(r.result).toMatchObject({ ok: false, exitCode: 128 })
    expect(r.result.output).toBe(protocolEntry('П8.77', PICK).output)
    expect(r.result.output).toBe(protocolEntry('П8.10', 'git cherry-pick $(git rev-parse --short feature~1)').output)
    expect(r.result.output).toBe(['error: Your local changes to the following files would be overwritten by merge:', '\tapp.js', 'Please commit your changes or stash them before you merge.', 'Aborting', 'fatal: cherry-pick failed'].join('\n'))
    expect(core(r.state)).toEqual(core(s))
    expect(r.result.explanation).toBe(ax.cherryPickRefusedEdit)
    expect(r.state.missionsDone.cherryPick).toBe(false)
  })

  it('после git checkout -- app.js копия получается (путь миссии 5, П8.10)', () => {
    const s = play(fresh(), ['edit app.js', PICK, 'git checkout -- app.js'])
    const r = run(s, PICK)
    expect(r.result.exitCode).toBe(0)
    expect(r.state.missionsDone.cherryPick).toBe(true)
  })

  it(`подготовленная правка в любом файле: error: your local changes would be overwritten by cherry-pick., код 128, даже когда копия пуста (${where('П8.77', 'git cherry-pick feature~1', 1)}, ${where('П8.80', 'git cherry-pick HEAD')})`, () => {
    const out = ['error: your local changes would be overwritten by cherry-pick.', 'hint: commit your changes or stash them to proceed.', 'fatal: cherry-pick failed'].join('\n')
    for (const [steps, line] of [
      [['edit app.js', 'git add app.js'], PICK],
      [['edit README.md', 'git add README.md'], PICK],
      [['edit app.js', 'git add app.js', 'edit app.js'], PICK],
      [['edit README.md', 'git add README.md', 'edit app.js'], PICK],
      [['edit README.md', 'git add README.md'], 'git cherry-pick HEAD'],
    ] as const) {
      const s = play(fresh(), steps)
      const r = run(s, line)
      expect(r.result, steps.join('; ')).toMatchObject({ ok: false, exitCode: 128, output: out })
      expect(core(r.state), steps.join('; ')).toEqual(core(s))
      expect(r.result.explanation).toBe(ax.cherryPickRefusedStaged)
    }
    expect(protocolEntry('П8.77', PICK, 1).output).toBe(out)
    expect(protocolEntry('П8.80', 'git cherry-pick HEAD').output).toBe(out)
  })

  it(`правка в файле, которого коммит не касается, не мешает и остаётся неподготовленной (${where('П8.77', 'git status --short', 2)})`, () => {
    const s = play(fresh(), ['edit README.md'])
    const r = run(s, PICK)
    expect(r.result.exitCode).toBe(0)
    expect(r.state.working['README.md']).toBe('# Мини-сайт + правка\n')
    expect(r.state.index['README.md']).toBe(seed.readme)
    expect(r.state.working['app.js']).toBe(seed.appFixed)
    expect(r.state.commits[r.state.branches.master].tree['README.md']).toBe(seed.readme)
    expect(run(r.state, 'git status --short').result.output).toBe(protocolEntry('П8.77', 'git status --short', 2).output)
  })

  it(`неотслеживаемый файл на месте добавляемого: error: The following untracked working tree files would be overwritten by merge:, код 128 (${where('П8.77', 'git cherry-pick feature')})`, () => {
    const s = play(fresh(), ['mkfile about.html'])
    const r = run(s, 'git cherry-pick feature')
    expect(r.result).toMatchObject({ ok: false, exitCode: 128 })
    expect(r.result.output).toBe(protocolEntry('П8.77', 'git cherry-pick feature').output)
    expect(r.result.output).toBe(['error: The following untracked working tree files would be overwritten by merge:', '\tabout.html', 'Please move or remove them before you merge.', 'Aborting', 'fatal: cherry-pick failed'].join('\n'))
    expect(core(r.state)).toEqual(core(s))
    expect(r.result.explanation).toBe(ax.cherryPickRefusedUntracked)
    // после удаления файла копия получается (П8.77)
    expect(run(play(s, ['rm about.html']), 'git cherry-pick feature').result.exitCode).toBe(0)
  })

  it(`изменённый и неотслеживаемый файлы вместе: два блока в порядке git, один Aborting (${where('П8.80', 'git cherry-pick both')})`, () => {
    const both = play(fresh(), ['git checkout -b both', 'edit app.js', 'mkfile extra.txt', 'git add extra.txt app.js', 'git commit -m "Двойной"', 'git checkout master', 'edit app.js', 'mkfile extra.txt'])
    const r = run(both, 'git cherry-pick both')
    expect(r.result.exitCode).toBe(128)
    expect(r.result.output).toBe(protocolEntry('П8.80', 'git cherry-pick both').output)
    expect(r.result.output.split('\n').filter((l) => l === 'Aborting')).toHaveLength(1)
    expect(core(r.state)).toEqual(core(both))
    expect(r.result.explanation).toBe(ax.cherryPickRefusedEdit)
    const onlyEdit = run(play(both, ['rm extra.txt']), 'git cherry-pick both')
    expect(onlyEdit.result.output).toBe(protocolEntry('П8.80', 'git cherry-pick both', 1).output)
  })

  it(`файл, удалённый в рабочем каталоге без git rm, который копия меняет, git создаёт заново; ошибки нет (${where('П8.80', 'git cherry-pick feature~1', 2)})`, () => {
    const s = play(fresh(), ['rm app.js'])
    const r = run(s, PICK)
    expect(r.result.exitCode).toBe(0)
    expect(r.state.working['app.js']).toBe(seed.appFixed)
    expect(run(r.state, 'git status --short').result.output).toBe('')
  })

  it('удаление файла коммитом при изменённом или удалённом в каталоге файле — отказ области: как git ответит, не сверено', () => {
    const del = play(fresh(), ['git checkout -b del', 'rm README.md', 'git commit -am "Удалить README"', 'git checkout master'])
    for (const steps of [['edit README.md'], ['rm README.md']] as const) {
      const s = play(del, steps)
      const r = run(s, 'git cherry-pick del')
      refusal(r.result.output)
      expect(r.result.output).toBe(ae.cherryPickUnverified('README.md'))
      expect(r.result.exitCode).toBeUndefined()
      expect(core(r.state)).toEqual(core(s))
    }
  })
})

describe('cherry-pick останавливается: конфликт и пустая копия; отказ области: ключи, несколько ссылок (target.md, часть XI и часть X, «Что НЕ входит»)', () => {
  const conflict = () => play(fresh(), ['edit app.js', 'git commit -am "Правка"'])

  it(`конфликт: код 1, операция и неслитый путь, ветка и коммиты на месте, миссия не засчитана (${where('П8.78', 'git cherry-pick feature~1')})`, () => {
    const s = conflict()
    const r = run(s, 'git cherry-pick feature~1')
    expect(r.result.exitCode).toBe(1)
    expect(r.result.output.startsWith('Auto-merging app.js\nCONFLICT (content): Merge conflict in app.js\nerror: could not apply ')).toBe(true)
    expect(r.state.operation).not.toBeNull()
    expect(Object.keys(r.state.unmerged)).toEqual(['app.js'])
    expect(r.state.branches).toEqual(s.branches)
    expect(r.state.commits).toEqual(s.commits)
    expect(r.state.reflog).toEqual(s.reflog)
    expect(r.state.missionsDone.cherryPick).toBe(false)
    expect(protocolEntry('П8.78', 'git cherry-pick feature~1').output).toContain('CONFLICT (content): Merge conflict in app.js')
    expect(protocolEntry('П8.78', 'git cherry-pick feature~1').exitCode).toBe(1)
  })

  it(`пустая копия — изменение уже есть в HEAD: HEAD, master, уже применённый коммит, корневой коммит — код 1, операция идёт без неслитых путей (${where('П8.78', 'git cherry-pick HEAD')}, ${where('П8.75', 'git cherry-pick HEAD@{1}')})`, () => {
    const applied = runAll(fresh(), ['git cherry-pick feature~1'])
    for (const [s, line] of [
      [fresh(), 'git cherry-pick HEAD'],
      [fresh(), 'git cherry-pick master'],
      [fresh(), 'git cherry-pick HEAD~1'],
      [applied, 'git cherry-pick HEAD@{1}'],
      [applied, 'git cherry-pick feature~1'],
    ] as const) {
      const r = run(s, line)
      expect(r.result.exitCode, line).toBe(1)
      expect(r.result.output, line).toContain('The previous cherry-pick is now empty, possibly due to conflict resolution.')
      expect(r.result.output, line).toContain("Otherwise, please use 'git cherry-pick --skip'")
      expect(r.state.operation, line).not.toBeNull()
      expect(r.state.unmerged, line).toEqual({})
      expect(core(r.state), line).toEqual(core(s))
    }
    expect(protocolEntry('П8.78', 'git cherry-pick HEAD').exitCode).toBe(1)
  })

  it(`пустая копия: сначала статус, потом подсказка, как на терминале (${where('П8.78', 'git cherry-pick HEAD')}, ${where('П8.75', 'git cherry-pick HEAD@{1}')})`, () => {
    const hint = 'The previous cherry-pick is now empty, possibly due to conflict resolution.'
    for (const line of ['git cherry-pick HEAD', 'git cherry-pick HEAD~1', 'git cherry-pick master']) {
      const lines = run(fresh(), line).result.output.split('\n')
      expect(lines[0], line).toMatch(/^On branch master|^HEAD detached/)
      expect(lines.indexOf(hint), line).toBeGreaterThan(lines.findIndex((l) => l.startsWith('nothing to commit') || l.startsWith('You are currently')))
      expect(lines[lines.length - 1], line).toBe("Otherwise, please use 'git cherry-pick --skip'")
    }
  })

  it('ключи, несколько коммитов, `--quit` и формы с лишними словами — отказ области: ключи из usage не unknown switch', () => {
    const s = fresh()
    for (const line of ['git cherry-pick -x feature', 'git cherry-pick -n feature', 'git cherry-pick -e feature', 'git cherry-pick -m 1 feature', 'git cherry-pick --quit', 'git cherry-pick --continue now', 'git cherry-pick --abort feature', 'git cherry-pick feature~1 feature', 'git cherry-pick -- feature', 'git cherry-pick feature..master']) {
      const r = run(s, line)
      refusal(r.result.output)
      expect(r.result.exitCode, line).toBeUndefined()
      expect(core(r.state), line).toEqual(core(s))
      expect(r.state.missionsDone.cherryPick, line).toBe(false)
    }
  })

  it('--continue, --skip и --abort без идущего cherry-pick: ответ git (код 128) или, для --skip, отказ области (К5.3)', () => {
    const s = fresh()
    for (const flag of ['--continue', '--abort']) {
      const r = run(s, `git cherry-pick ${flag}`)
      expect(r.result.output).toBe('error: no cherry-pick or revert in progress\nfatal: cherry-pick failed')
      expect(r.result.exitCode).toBe(128)
      expect(core(r.state)).toEqual(core(s))
    }
    refusal(run(s, 'git cherry-pick --skip').result.output)
  })

  it('отказ области не печатает вывода git и не выглядит как ошибка git', () => {
    for (const out of [ae.cherryPickConflictKind(['a']), ae.cherryPickConflictKind(['a', 'b']), ae.cherryPickConflictDirty(['app.js']), ae.cherryPickDetachedStop, ae.cherryPickSkipIdle, ae.cherryPickUnverified('x'), ae.form('cherry-pick', '-x', ru.appendix.allowed.cherryPick)]) {
      refusal(out)
      expect(out).not.toMatch(/^(fatal|error|usage|hint):/)
    }
  })
})

describe('миссия 5: успешный cherry-pick, создавший коммит (target.md, часть X, «Миссии»)', () => {
  it('засчитывается на ветке и остаётся засчитанной', () => {
    const s = fresh()
    expect(getAppendixMissions(s)[4]).toMatchObject({ id: 'cherryPick', done: false })
    const done = run(s, 'git cherry-pick feature~1').state
    expect(getAppendixMissions(done)[4].done).toBe(true)
    const later = runAll(done, ['git reset --hard HEAD~2', 'git checkout feature', 'git cherry-pick nosuch'])
    expect(later.missionsDone.cherryPick).toBe(true)
  })

  it('не засчитывается отказом области, пустой копией, отказом из-за правки; сброс раздела снимает', () => {
    expect(run(fresh(), 'git cherry-pick HEAD').state.missionsDone.cherryPick).toBe(false)
    expect(run(play(fresh(), ['edit app.js']), 'git cherry-pick feature~1').state.missionsDone.cherryPick).toBe(false)
    expect(fresh().missionsDone.cherryPick).toBe(false)
  })
})
