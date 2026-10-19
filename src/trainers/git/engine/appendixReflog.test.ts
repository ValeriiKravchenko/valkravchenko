// git reflog и ссылка HEAD@{n} (target.md, часть X, места 14 и 15; часть XII, «reflog: записи»).
// Вывод сверен с section8-git-runs.txt (П8.1, П8.5, П8.15, П8.19), detached-head-git-runs.txt (О1–О31) и
// appendix-g18g2-git-runs.txt (П8.79: `reflog -<n>` и `log -g --oneline -<n>`).
import { describe, expect, it } from 'vitest'
import { currentCommitId } from './appendixRepo'
import { compareOutputs, fresh, protocolEntry, replayBlock, run, runAll, where, type IdMap } from './appendixProtocolKit'
import { ru } from '../locales/ru'

const ax = ru.appendix.explain

describe('git reflog', () => {
  it(`исходное состояние: шесть записей, подписи на строке своего коммита (${where('П8.1', 'git reflog')})`, () => {
    const r = run(fresh(), 'git reflog')
    expect(r.result).toMatchObject({ ok: true, exitCode: 0, explanation: ax.reflogShown })
    expect(compareOutputs(protocolEntry('П8.1', 'git reflog').output, r.result.output, new Map() as IdMap)).toBeNull()
    expect(r.result.output.split('\n')).toHaveLength(6)
    expect(r.result.output.split('\n')[0]).toMatch(/^[0-9a-f]{7} \(HEAD -> master\) HEAD@\{0\}: commit: Добавить README$/)
  })

  it('команда ничего не меняет: ни ветки, ни журнал', () => {
    const s = fresh()
    const r = run(s, 'git reflog')
    expect(r.state.reflog).toEqual(s.reflog)
    expect(r.state.branches).toEqual(s.branches)
    expect(r.state.head).toEqual(s.head)
  })

  it(`в отсоединённом HEAD подпись начинается с HEAD без стрелки, теги и ветки на этом коммите перечислены (${where('О13', 'git reflog -2')})`, () => {
    const s = runAll(fresh(), ['git tag v2.0 master~1', 'git tag t0 master~1', 'git checkout t0'])
    const first = run(s, 'git reflog').result.output.split('\n')[0]
    expect(first).toBe(`${s.commits[currentCommitId(s)].id.slice(0, 7)} (HEAD, tag: v2.0, tag: t0) HEAD@{0}: checkout: moving from master to t0`)
  })

  it(`номер n — перемещение HEAD, а не коммит назад: после двух checkout запись HEAD@{1} уже другая (${where('П8.5', 'git reflog', 1)})`, () => {
    const s = runAll(fresh(), ['git checkout feature', 'git checkout master'])
    const lines = run(s, 'git reflog').result.output.split('\n')
    expect(lines.slice(0, 2).map((l) => l.replace(/^[0-9a-f]{7}( \([^)]*\))? /, ''))).toEqual(['HEAD@{0}: checkout: moving from feature to master', 'HEAD@{1}: checkout: moving from master to feature'])
    expect(lines).toHaveLength(8)
  })

  it('ключи и формы (show, ссылка, --all, --oneline, длинный log -g) — отказ области, ничего не меняется', () => {
    const s = fresh()
    for (const command of ['git reflog show', 'git reflog show feature', 'git reflog HEAD', 'git reflog --all', 'git reflog --oneline', 'git reflog -3 --oneline', 'git reflog -1 HEAD', 'git reflog -x', 'git reflog -', 'git log -g', 'git log -g -2', 'git log -g --oneline master', 'git log -g --oneline --all', 'git log -g --oneline -x']) {
      const r = run(s, command)
      expect(r.result.output.startsWith('[тренажёр]'), command).toBe(true)
      expect(r.result.exitCode, command).toBeUndefined()
      expect({ head: r.state.head, branches: r.state.branches, reflog: r.state.reflog, index: r.state.index, working: r.state.working }, command).toEqual({ head: s.head, branches: s.branches, reflog: s.reflog, index: s.index, working: s.working })
    }
  })
})

describe('git reflog -<n> и git log -g --oneline -<n> (target.md, часть X, место 14)', () => {
  const lines = (command: string) => run(fresh(), command).result.output.split('\n')

  it(`-<n> печатает n верхних записей, номера остаются прежними (${where('П8.79', 'git reflog -3')}, ${where('П8.5', 'git reflog -3')})`, () => {
    const r = run(fresh(), 'git reflog -3')
    expect(r.result).toMatchObject({ ok: true, exitCode: 0 })
    expect(compareOutputs(protocolEntry('П8.79', 'git reflog -3').output, r.result.output, new Map() as IdMap)).toBeNull()
    expect(lines('git reflog -3').map((l) => /HEAD@\{(\d+)\}/.exec(l)?.[1])).toEqual(['0', '1', '2'])
  })

  it(`-0 — пустой вывод и код 0; число больше длины журнала — весь журнал; ведущий нуль не мешает (${where('П8.79', 'git reflog -0')}, ${where('П8.79', 'git reflog -99')}, ${where('П8.79', 'git reflog -01')})`, () => {
    expect(run(fresh(), 'git reflog -0').result).toMatchObject({ ok: true, output: '', exitCode: 0 })
    expect(protocolEntry('П8.79', 'git reflog -0')).toMatchObject({ output: '', exitCode: 0 })
    expect(lines('git reflog -99')).toHaveLength(6)
    expect(lines('git reflog -7')).toHaveLength(6)
    expect(lines('git reflog -6')).toHaveLength(6)
    expect(lines('git reflog -01')).toHaveLength(1)
  })

  it(`при нескольких ключах действует последний (${where('П8.79', 'git reflog -1 -2')}, ${where('П8.79', 'git reflog -2 -1')})`, () => {
    expect(lines('git reflog -1 -2')).toHaveLength(2)
    expect(lines('git reflog -2 -1')).toHaveLength(1)
  })

  it(`git log -g --oneline печатает те же строки, что git reflog, ключи в любом порядке (${where('П8.79', 'git log -g --oneline -3')}, ${where('П8.5', 'git log -g --oneline -3')})`, () => {
    const s = fresh()
    const reflog = run(s, 'git reflog').result.output
    expect(run(s, 'git log -g --oneline').result.output).toBe(reflog)
    for (const command of ['git log -g --oneline -3', 'git log --oneline -g -3', 'git log -g -3 --oneline', 'git log -3 --oneline -g']) {
      const r = run(s, command)
      expect(r.result, command).toMatchObject({ ok: true, exitCode: 0 })
      expect(r.result.output, command).toBe(run(s, 'git reflog -3').result.output)
    }
    expect(compareOutputs(protocolEntry('П8.79', 'git log -g --oneline -3').output, run(s, 'git log -g --oneline -3').result.output, new Map() as IdMap)).toBeNull()
    expect(run(s, 'git log -g --oneline -0').result).toMatchObject({ ok: true, output: '', exitCode: 0 })
    expect(run(s, 'git log -g --oneline -99').result.output).toBe(reflog)
    expect(run(s, 'git log -g --oneline -01').result.output.split('\n')).toHaveLength(1)
  })

  it('в отсоединённом HEAD подписи начинаются с HEAD без стрелки, журнал растёт с каждым перемещением', () => {
    const s = runAll(fresh(), ['git checkout --detach master~1', 'git reset --hard feature'])
    const top = run(s, 'git reflog -2').result.output.split('\n')
    expect(top[0]).toMatch(/^[0-9a-f]{7} \(HEAD, feature\) HEAD@\{0\}: reset: moving to feature$/)
    expect(top[1]).toMatch(/^[0-9a-f]{7} HEAD@\{1\}: checkout: moving from master to master~1$/)
  })

  it('блок П8.79 проигрывается целиком; git log -0 вне журнала раздел по-прежнему не разбирает (отказ области)', () => {
    const replay = replayBlock('П8.79', { refused: (e) => e.command === 'git log --oneline -0' })
    const problems = replay.steps.filter((step) => step.mismatch !== null).map((step) => `${step.entry.file}:${step.entry.line} «${step.entry.command}» — ${step.mismatch}`)
    expect(problems).toEqual([])
    expect(replay.steps.length).toBeGreaterThan(15)
  })
})

describe('HEAD@{n} как ссылка', () => {
  const s = fresh()
  const base = Object.values(s.commits).find((c) => c.clock === 0)!.id

  it(`show, log, tag, branch и checkout принимают HEAD@{n}; n считает записи журнала (${where('О3', 'git branch rescue HEAD@{1}')}, ${where('П8.5', 'git reset --hard HEAD@{1}')})`, () => {
    // Журнал: {0} коммит README, {1} переход feature→master (базовый), {2} коммит «О проекте».
    expect(run(s, 'git show HEAD@{1}').result.output.split('\n')[0]).toBe(`commit ${base}`)
    expect(run(s, 'git log --oneline HEAD@{2}').result.output.split('\n')).toHaveLength(3)
    expect(run(s, 'git tag t1 HEAD@{1}').state.tags.t1).toEqual({ kind: 'light', commit: base })
    expect(run(s, 'git branch b1 HEAD@{1}').state.branches.b1).toBe(base)
    expect(run(s, 'git checkout HEAD@{1}').state.head).toEqual({ kind: 'detached', id: base })
    expect(run(s, 'git checkout HEAD@{0}').state.head).toEqual({ kind: 'detached', id: currentCommitId(s) })
  })

  it(`за концом журнала: fatal: log for 'HEAD' only has N entries, код 128, у всех команд одинаково (${where('П8.61', 'git show HEAD@{99}')})`, () => {
    for (const command of ['git show HEAD@{99}', 'git show HEAD@{6}', 'git log HEAD@{6}', 'git tag t1 HEAD@{99}', 'git branch b1 HEAD@{99}', 'git checkout HEAD@{99}', 'git checkout --detach HEAD@{99}', 'git switch --detach HEAD@{99}', 'git switch HEAD@{99}']) {
      const r = run(s, command)
      expect(r.result, command).toMatchObject({ ok: false, output: "fatal: log for 'HEAD' only has 6 entries", exitCode: 128 })
      expect(r.state.head, command).toEqual(s.head)
    }
    expect(protocolEntry('П8.61', 'git show HEAD@{99}').output).toBe("fatal: log for 'HEAD' only has 6 entries")
    expect(run(s, 'git show HEAD@{5}').result.exitCode).toBe(0)
  })

  it('N в сообщении — число записей журнала сейчас (после перехода их семь)', () => {
    const moved = runAll(s, ['git checkout feature'])
    expect(run(moved, 'git show HEAD@{99}').result.output).toBe("fatal: log for 'HEAD' only has 7 entries")
  })

  it('номера сдвигаются с каждым перемещением HEAD: HEAD@{1} после checkout указывает на коммит, где HEAD стоял до него (место 15)', () => {
    const moved = runAll(s, ['git checkout feature'])
    expect(run(moved, 'git tag t1 HEAD@{1}').state.tags.t1).toEqual({ kind: 'light', commit: currentCommitId(s) })
    expect(run(s, 'git tag t1 HEAD@{1}').state.tags.t1).toEqual({ kind: 'light', commit: base })
  })

  it('формы вне грамматики: HEAD@{1}~1, HEAD@{01}, HEAD@{-1}, master@{1} — отказ области', () => {
    for (const ref of ['HEAD@{1}~1', 'HEAD@{01}', 'HEAD@{-1}', 'master@{1}', '@{1}', 'HEAD@{x}']) {
      const r = run(s, `git checkout ${ref}`)
      expect(r.result.output.startsWith('[тренажёр]'), ref).toBe(true)
    }
  })

  it(`reset принимает HEAD@{n}: ветка встаёт на коммит записи, запись журнала называет ссылку как введена; за концом журнала — только N entries (${where('П8.5', 'git reset --hard HEAD@{1}')}, ${where('П8.69', 'git reset --hard HEAD@{99}')})`, () => {
    const moved = run(s, 'git reset --hard HEAD@{1}')
    expect(moved.result).toMatchObject({ ok: true, exitCode: 0 })
    expect(moved.state.branches.master).toBe(base)
    expect(moved.state.reflog[0]).toEqual({ id: base, message: 'reset: moving to HEAD@{1}' })
    const far = run(s, 'git reset --hard HEAD@{99}')
    expect(far.result).toMatchObject({ ok: false, output: "fatal: log for 'HEAD' only has 6 entries", exitCode: 128 })
    expect(far.state.branches).toEqual(s.branches)
    expect(far.state.reflog).toEqual(s.reflog)
  })
})
