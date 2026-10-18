// git reflog и ссылка HEAD@{n} (target.md, часть X, места 14 и 15; часть XII, «reflog: записи»).
// Вывод сверен с section8-git-runs.txt (П8.1, П8.5, П8.15, П8.19) и detached-head-git-runs.txt (О1–О31).
import { describe, expect, it } from 'vitest'
import { currentCommitId } from './appendixRepo'
import { compareOutputs, fresh, protocolEntry, run, runAll, where, type IdMap } from './appendixProtocolKit'
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

  it('ключи и формы (show, -<n>, HEAD, --all) — отказ области: -<n> числится формой и желательным одновременно, тренажёр её не делает', () => {
    for (const command of ['git reflog -1', 'git reflog -3', 'git reflog show', 'git reflog show feature', 'git reflog HEAD', 'git reflog --all', 'git log -g']) {
      const r = run(fresh(), command)
      expect(r.result.output.startsWith('[тренажёр]'), command).toBe(true)
      expect(r.result.exitCode, command).toBeUndefined()
    }
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

  it('reset с HEAD@{n} в этом потоке остаётся отказом области (команда reset не разбирается)', () => {
    const r = run(s, 'git reset --hard HEAD@{1}')
    expect(r.result.output).toBe(ru.appendix.errors.commandOutOfScope('reset'))
    expect(r.result.exitCode).toBeUndefined()
  })
})
