// git rebase (target.md, часть X, места 16–19, «Миссии»; часть XII, «reflog: записи»). Блоки протокола проигрываются на движке (вывод и
// код возврата сверяются с настоящим git 2.53.0, appendixProtocolKit.ts); строки хода `Rebasing (k/n)<CR>` в протоколе есть, тренажёр их не
// печатает, и сверка их срезает. Новые прогоны лежат в appendix-g18g3-git-runs.txt (П8.82–П8.88); перенос, перемотка, «up to date»,
// пропуск, отказы по правкам и reflog — ещё в section8-git-runs.txt (П8.6–П8.12, П8.16–П8.18).
import { describe, expect, it } from 'vitest'
import { fresh, protocolBlock, protocolEntry, replayBlock, run, where, type ReplayOptions } from './appendixProtocolKit'
import { createAppendixFile, deleteAppendixFile, editAppendixFile, getAppendixMissions, getBranches, getCommits, type AppendixState } from './appendixSection'
import { ru } from '../locales/ru'

const ae = ru.appendix.errors
const short = (id: string) => id.slice(0, 7)
const play = (state: AppendixState, steps: readonly string[]): AppendixState =>
  steps.reduce((s, step) => {
    const file = /^(edit|mkfile|rm) (\S+)$/.exec(step)
    if (file === null) return run(s, step).state
    return file[1] === 'edit' ? editAppendixFile(s, file[2]) : file[1] === 'mkfile' ? createAppendixFile(s, file[2]) : deleteAppendixFile(s, file[2])
  }, state)
const core = (s: AppendixState) => ({ head: s.head, branches: s.branches, index: s.index, working: s.working, reflog: s.reflog, commits: s.commits, lastCheckout: s.lastCheckout, missionsDone: s.missionsDone })
const refusal = (output: string) => expect(output.startsWith('[тренажёр]')).toBe(true)

/** Граф `--graph` и `ls` раздел 8 не выполняет (отказ области): такие шаги протокола не проигрываются. */
const notGraph = (e: { command: string }) => e.command.endsWith('--graph') || e.command === 'ls'

function expectReplay(block: string | readonly string[], options: ReplayOptions = {}): void {
  const replay = replayBlock(block, options)
  const problems = replay.steps.filter((s) => s.mismatch !== null).map((s) => `${s.entry.file}:${s.entry.line} «${s.entry.command}» — ${s.mismatch}`)
  expect(problems).toEqual([])
  expect(replay.steps.length).toBeGreaterThan(0)
}

describe('блоки протокола rebase проигрываются на движке', () => {
  it('П8.82: правки, порядок проверок, удалённый и неотслеживаемый файл', () => expectReplay('П8.82'))
  it('П8.83: запись rebase (start) для тегов и id7', () => expectReplay('П8.83'))
  it('П8.84: master на feature, база как введена', () => expectReplay('П8.84'))
  it('П8.85: пропуск применённых коммитов', () => expectReplay('П8.85'))
  it('П8.86: все свои коммиты применены — отказ области вместо вывода git', () =>
    expectReplay('П8.86', { refused: (e) => e.command === 'git rebase master', until: 5 }))
  it('П8.87: после reset --hard на брошенный коммит ветка «up to date»', () => expectReplay('П8.87'))
  it('П8.6: перенос двух коммитов, повтор — up to date, rebase на саму ветку', () =>
    expectReplay('П8.6', { skip: notGraph, until: protocolBlock('П8.6').findIndex((e) => e.command.startsWith('git checkout master &&')) }))
  it('П8.7: master на feature (исходная история) — перенос README-коммита', () => expectReplay('П8.7', { skip: notGraph }))
  it('П8.9: пропуск применённого cherry-pick коммита и запись журнала', () => expectReplay('П8.9', { skip: notGraph }))
  it('П8.88: rebase без аргументов не зависит от правок', () => expectReplay('П8.88'))
  it('в протоколе есть блоки П8.82–П8.88', () => {
    for (let n = 82; n <= 88; n++) expect(protocolBlock(`П8.${n}`).length, `П8.${n}`).toBeGreaterThan(0)
  })
})

const SUCCESS = (branch: string) => `Successfully rebased and updated refs/heads/${branch}.`

describe('перенос (П8.6, П8.7)', () => {
  it(`feature на master: итоговая строка без строк хода, новые id, ветка на последнем перенесённом, файлы из обоих (${where('П8.6', 'git rebase master')})`, () => {
    const before = play(fresh(), ['git checkout feature'])
    const r = run(before, 'git rebase master')
    expect(r.result).toMatchObject({ ok: true, exitCode: 0, output: SUCCESS('feature') })
    expect(r.result.output).not.toContain('Rebasing')
    const tip = r.state.commits[r.state.branches.feature]
    const fix = r.state.commits[tip.parents[0]]
    expect(tip.id).not.toBe(before.branches.feature)
    expect(fix.id).not.toBe(before.commits[before.branches.feature].parents[0])
    expect([tip.message, fix.message]).toEqual([ru.appendix.seed.aboutMessage, ru.appendix.seed.fixMessage])
    expect(fix.parents).toEqual([before.branches.master])
    expect(r.state.branches.master).toBe(before.branches.master)
    expect(r.state.head).toEqual({ kind: 'branch', name: 'feature' })
    expect(Object.keys(r.state.working).sort()).toEqual(['README.md', 'about.html', 'app.js'])
    expect(r.state.index).toEqual(r.state.working)
    expect(r.state.lastCheckout).toEqual(before.lastCheckout)
    expect(r.result.explanation).toContain('перенёс 2 коммита')
  })

  it('старые коммиты ветки остаются в состоянии и бледнеют на графе (target.md, часть X, «Движок»)', () => {
    const before = play(fresh(), ['git checkout feature'])
    const after = run(before, 'git rebase master').state
    for (const id of [before.branches.feature, before.commits[before.branches.feature].parents[0]]) {
      expect(after.commits[id]).toBeDefined()
      expect(getCommits(after).find((c) => c.id === id)?.faded).toBe(true)
    }
    expect(getCommits(after).filter((c) => c.faded)).toHaveLength(2)
    expect(getBranches(after).map((b) => b.name)).toEqual(['feature', 'master'])
    expect(run(before, 'git rebase master').result.explanation).toContain('бледные')
  })

  it(`master на feature из исходной истории: переносится один README-коммит (${where('П8.7', 'git rebase feature')})`, () => {
    const r = run(fresh(), 'git rebase feature')
    expect(r.result.output).toBe(SUCCESS('master'))
    expect(r.state.commits[r.state.branches.master].parents).toEqual([fresh().branches.feature])
    expect(r.state.reflog.slice(0, 3).map((e) => e.message)).toEqual(['rebase (finish): returning to refs/heads/master', `rebase (pick): ${ru.appendix.seed.readmeMessage}`, 'rebase (start): checkout feature'])
    expect(r.state.reflog[2].id).toBe(fresh().branches.feature)
  })

  it('журнал HEAD: start, pick на каждый коммит, finish; ссылка записана как введена (П8.6, П8.83, П8.84)', () => {
    const r = run(play(fresh(), ['git checkout feature']), 'git rebase master')
    expect(r.state.reflog.slice(0, 4).map((e) => e.message)).toEqual([
      'rebase (finish): returning to refs/heads/feature',
      `rebase (pick): ${ru.appendix.seed.aboutMessage}`,
      `rebase (pick): ${ru.appendix.seed.fixMessage}`,
      'rebase (start): checkout master',
    ])
    expect(r.state.reflog[0].id).toBe(r.state.branches.feature)
    expect(r.state.reflog[3].id).toBe(fresh().branches.master)
    for (const base of ['master~0', 'refs/heads/master', short(fresh().branches.master)]) {
      const s = run(play(fresh(), ['git checkout feature']), `git rebase ${base}`).state
      expect(s.reflog[3].message, base).toBe(`rebase (start): checkout ${base}`)
    }
  })

  it('миссия 7 засчитывается переносом (S8-79)', () => {
    const before = play(fresh(), ['git checkout feature'])
    expect(before.missionsDone.rebase).toBe(false)
    const after = run(before, 'git rebase master').state
    expect(after.missionsDone.rebase).toBe(true)
    expect(getAppendixMissions(after).map((m) => m.done)).toEqual([false, false, false, false, false, false, true])
    expect(getAppendixMissions(after)).toHaveLength(7)
  })
})

describe('перемотка: у ветки нет своих коммитов (П8.8, П8.16)', () => {
  const topic = () => play(fresh(), ['git branch topic master~1', 'git switch topic'])

  it(`та же итоговая строка, ветка встаёт на коммит основы, id прежние (${where('П8.8', 'git rebase master')})`, () => {
    const r = run(topic(), 'git rebase master')
    expect(r.result).toMatchObject({ ok: true, exitCode: 0, output: SUCCESS('topic') })
    expect(r.state.branches.topic).toBe(fresh().branches.master)
    expect(Object.keys(r.state.commits)).toEqual(Object.keys(topic().commits))
    expect(r.state.working).toEqual(fresh().working)
    expect(r.result.explanation).toContain('не было своих коммитов')
  })

  it(`в журнале только start и finish (${where('П8.16', 'git rebase master')})`, () => {
    const r = run(topic(), 'git rebase master').state
    expect(r.reflog.slice(0, 2).map((e) => e.message)).toEqual(['rebase (finish): returning to refs/heads/topic', 'rebase (start): checkout master'])
    expect(r.reflog[0].id).toBe(fresh().branches.master)
    expect(r.reflog[1].id).toBe(fresh().branches.master)
  })

  it('перемотка засчитывает миссию 7 и ничего не бледнит', () => {
    const r = run(topic(), 'git rebase master').state
    expect(r.missionsDone.rebase).toBe(true)
    expect(getCommits(r).filter((c) => c.faded)).toHaveLength(0)
  })
})

describe('переносить нечего: Current branch … is up to date (П8.6, П8.12)', () => {
  it(`основа — предок ветки, сама ветка, HEAD: id прежние, журнал не пишется, миссия не засчитывается (${where('П8.6', 'git rebase feature')})`, () => {
    const s = play(fresh(), ['git checkout feature'])
    for (const base of ['master~1', 'feature', 'HEAD', 'feature~1', 'refs/heads/feature']) {
      const r = run(s, `git rebase ${base}`)
      expect(r.result, base).toMatchObject({ ok: true, exitCode: 0, output: 'Current branch feature is up to date.' })
      expect(core(r.state), base).toEqual(core(s))
    }
    expect(protocolEntry('П8.6', 'git rebase master', 1).output).toBe('Current branch feature is up to date.')
  })

  it('после переноса повтор тоже «up to date» и миссию не отнимает (часть I, п. 2)', () => {
    const done = run(play(fresh(), ['git checkout feature']), 'git rebase master').state
    const again = run(done, 'git rebase master')
    expect(again.result.output).toBe('Current branch feature is up to date.')
    expect(again.state.missionsDone.rebase).toBe(true)
    expect(again.state.reflog).toBe(done.reflog)
  })

  it('«up to date» без переноса не засчитывает миссию', () => {
    const r = run(play(fresh(), ['git checkout feature']), 'git rebase feature')
    expect(r.state.missionsDone.rebase).toBe(false)
  })
})

describe('пропуск применённого коммита (П8.9, П8.10)', () => {
  const picked = () => play(fresh(), ['git cherry-pick feature~1', 'git checkout feature'])

  it(`три строки перед итоговой; id в warning — коммит ветки, а не копия (${where('П8.9', 'git rebase master')})`, () => {
    const s = picked()
    const r = run(s, 'git rebase master')
    const fix = fresh().commits[fresh().branches.feature].parents[0]
    expect(r.result.output).toBe(
      [
        `warning: skipped previously applied commit ${short(fix)}`,
        'hint: use --reapply-cherry-picks to include skipped commits',
        'hint: Disable this message with "git config set advice.skippedCherryPicks false"',
        SUCCESS('feature'),
      ].join('\n'),
    )
    expect(r.state.commits[r.state.branches.feature].parents).toEqual([s.branches.master])
    expect(r.result.explanation).toContain('skipped previously applied commit')
  })

  it('журнал: start, pick только перенесённого, finish (П8.9)', () => {
    const r = run(picked(), 'git rebase master').state
    expect(r.reflog.slice(0, 3).map((e) => e.message)).toEqual(['rebase (finish): returning to refs/heads/feature', `rebase (pick): ${ru.appendix.seed.aboutMessage}`, 'rebase (start): checkout master'])
  })

  it('все свои коммиты уже применены — отказ области, ничего не меняется (П8.86 показывает, что сделал бы git)', () => {
    const s = play(fresh(), ['git cherry-pick feature~1', 'git cherry-pick feature', 'git checkout feature'])
    const r = run(s, 'git rebase master')
    refusal(r.result.output)
    expect(r.result.exitCode).toBeUndefined()
    expect(r.result.output).toBe(ae.rebaseAllApplied)
    expect(core(r.state)).toEqual(core(s))
  })
})

describe('отказы git (П8.12, П8.82, П8.88)', () => {
  const onFeature = () => play(fresh(), ['git checkout feature'])
  const state = (steps: readonly string[]) => play(onFeature(), steps)

  it(`неподготовленная правка: две строки, код 1, ничего не меняется (${where('П8.82', 'git rebase master')})`, () => {
    const s = state(['edit app.js'])
    const r = run(s, 'git rebase master')
    expect(r.result).toMatchObject({ ok: false, exitCode: 1, output: 'error: cannot rebase: You have unstaged changes.\nerror: Please commit or stash them.' })
    expect(core(r.state)).toEqual(core(s))
    expect(r.result.explanation).toContain('несохранённая правка')
  })

  it('подготовленная правка (П8.12)', () => {
    const r = run(state(['edit app.js', 'git add app.js']), 'git rebase master')
    expect(r.result).toMatchObject({ ok: false, exitCode: 1, output: 'error: cannot rebase: Your index contains uncommitted changes.\nerror: Please commit or stash them.' })
    expect(r.result.explanation).toContain('индексе')
  })

  it('и та и другая: три строки (П8.82)', () => {
    const r = run(state(['edit app.js', 'git add app.js', 'edit about.html']), 'git rebase master')
    expect(r.result.exitCode).toBe(1)
    expect(r.result.output).toBe(
      'error: cannot rebase: You have unstaged changes.\nerror: additionally, your index contains uncommitted changes.\nerror: Please commit or stash them.',
    )
  })

  it('удалённый отслеживаемый файл — неподготовленная правка; неотслеживаемый файл не мешает (П8.82)', () => {
    expect(run(state(['rm about.html']), 'git rebase master').result.output).toContain('You have unstaged changes.')
    const ok = run(state(['mkfile notes.txt']), 'git rebase master')
    expect(ok.result.output).toBe(SUCCESS('feature'))
    expect(ok.state.working['notes.txt']).toBeDefined()
  })

  it('правки раньше «up to date» (П8.82), а invalid upstream раньше правок', () => {
    const s = state(['edit app.js'])
    expect(run(s, 'git rebase feature').result.exitCode).toBe(1)
    expect(run(s, 'git rebase nosuch').result).toMatchObject({ ok: false, exitCode: 128, output: "fatal: invalid upstream 'nosuch'" })
  })

  it(`invalid upstream (${where('П8.12', 'git reset -q; git checkout -- app.js; git rebase nosuch')})`, () => {
    const s = onFeature()
    const r = run(s, 'git rebase nosuch')
    expect(r.result.output).toBe(protocolEntry('П8.12', 'git reset -q; git checkout -- app.js; git rebase nosuch').output)
    expect(r.result.exitCode).toBe(128)
    expect(core(r.state)).toEqual(core(s))
    expect(run(s, 'git rebase feature~9').result.exitCode).toBe(128)
  })

  it(`без аргументов: блок про отслеживание, код 1, с любыми правками (${where('П8.12', 'git rebase')}, ${where('П8.88', 'git rebase')})`, () => {
    for (const s of [onFeature(), state(['edit app.js']), state(['edit app.js', 'git add app.js'])]) {
      const r = run(s, 'git rebase')
      expect(r.result.output).toBe(protocolEntry('П8.12', 'git rebase').output)
      expect(r.result.exitCode).toBe(1)
      expect(core(r.state)).toEqual(core(s))
    }
    expect(run(play(fresh(), []), 'git rebase').result.output).toContain('--set-upstream-to=<remote>/<branch> master')
  })

  it('отказы git не засчитывают миссию', () => {
    for (const line of ['git rebase', 'git rebase nosuch']) expect(run(onFeature(), line).state.missionsDone.rebase, line).toBe(false)
  })
})

describe('отказы области (часть X, «Что НЕ входит»; S8-67, S8-71)', () => {
  const onFeature = () => play(fresh(), ['git checkout feature'])

  it('ключи и лишние слова: отказ формы (rebase -i, --onto, --quit, --reapply-cherry-picks, несколько слов)', () => {
    for (const line of ['git rebase -i master', 'git rebase --onto master feature', 'git rebase --quit', 'git rebase --reapply-cherry-picks master', 'git rebase master feature']) {
      const s = onFeature()
      const r = run(s, line)
      refusal(r.result.output)
      expect(r.result.exitCode, line).toBeUndefined()
      expect(r.result.output).toContain(ru.appendix.allowed.rebase)
      expect(core(r.state)).toEqual(core(s))
    }
  })

  it('rebase в отсоединённом HEAD — отказ области (S8-71, П8.12, П8.18): речь не обещает один исход', () => {
    for (const line of ['git rebase master', 'git rebase', 'git rebase feature~1']) {
      const s = play(fresh(), ['git checkout --detach feature~1'])
      const r = run(s, line)
      expect(r.result.output, line).toBe(ae.rebaseDetached)
      expect(r.result.exitCode).toBeUndefined()
      expect(core(r.state)).toEqual(core(s))
    }
    // Исход зависит от состояния (уже на базе, неверная база, правки, конфликт, перенос), поэтому речь не обещает один из них.
    expect(ae.rebaseDetached.startsWith('[тренажёр]')).toBe(true)
    expect(ae.rebaseDetached).not.toContain('Successfully rebased')
    expect(ae.rebaseDetached).not.toMatch(/перенёс бы|напечатал бы/)
    for (const part of ['зависит от состояния', 'уже стоять на этой базе', 'неверной', 'правки', 'конфликт', 'git switch']) expect(ae.rebaseDetached, part).toContain(part)
    expect(ae.rebaseDetached).not.toMatch(/merge/)
  })

  it('ссылка вне грамматики, HEAD@{n}: отказ области, а не выдуманная ошибка git', () => {
    for (const line of ['git rebase HEAD@{1}', 'git rebase master..feature', 'git rebase :/fix', 'git rebase master^{}']) {
      const r = run(onFeature(), line)
      refusal(r.result.output)
      expect(r.result.exitCode, line).toBeUndefined()
    }
  })

  it('неотслеживаемый файл на пути файла результата — отказ области', () => {
    const s = play(onFeature(), ['mkfile README.md'])
    const r = run(s, 'git rebase master')
    expect(r.result.output).toBe(ae.rebaseUntracked('README.md'))
    expect(core(r.state)).toEqual(core(s))
  })

  it('merge и pull остаются отказом области', () => {
    for (const line of ['git merge master', 'git pull']) {
      const r = run(onFeature(), line)
      refusal(r.result.output)
      expect(r.result.exitCode).toBeUndefined()
    }
  })

  it('отказ области миссию не засчитывает', () => {
    expect(run(onFeature(), 'git rebase -i master').state.missionsDone.rebase).toBe(false)
  })
})

describe('путь миссии 7 (П8.10, S8-79, S8-80)', () => {
  it('cherry-pick фикса, reset, возврат из журнала и rebase: пропуск и перенос засчитывают миссию', () => {
    const s = play(fresh(), ['git cherry-pick feature~1', 'git reset --hard HEAD~1', 'git reset --hard HEAD@{1}', 'git checkout feature'])
    const r = run(s, 'git rebase master')
    expect(r.result.exitCode).toBe(0)
    expect(r.result.output).toContain('warning: skipped previously applied commit')
    expect(r.state.missionsDone).toMatchObject({ cherryPick: true, rescueCommit: true, rebase: true })
  })

  it('словарь: подпись и подсказка миссии 7', () => {
    expect(ru.appendix.missions.rebase.hint).toBe('git checkout feature → git rebase master')
    expect(ru.appendix.missions.rebase.text).toContain('rebase')
  })
})
