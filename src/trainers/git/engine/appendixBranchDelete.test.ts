// git branch -d и -D (target.md, часть XII, опасное место 8). Вывод сверен с appendix-g18g-git-runs.txt (П8.62, П8.63)
// и detached-head-git-runs.txt (О6).
import { describe, expect, it } from 'vitest'
import { currentCommitId } from './appendixRepo'
import { fresh, protocolEntry, run, runAll, where } from './appendixProtocolKit'
import { ru } from '../locales/ru'

const ax = ru.appendix.explain
const readme7 = () => currentCommitId(fresh()).slice(0, 7)

describe('git branch -d на ветке', () => {
  it(`неслитая ветка: error: the branch … is not fully merged и два hint, код 1, ветка на месте (${where('П8.62', 'git branch -d feature')})`, () => {
    const r = run(fresh(), 'git branch -d feature')
    expect(r.result.output).toBe(protocolEntry('П8.62', 'git branch -d feature').output)
    expect(r.result).toMatchObject({ ok: false, exitCode: 1, explanation: ax.branchNotMerged(false) })
    expect(r.state.branches).toEqual(fresh().branches)
  })

  it(`слитая ветка удаляется: Deleted branch <имя> (was <id7>)., код 0 (${where('П8.63', 'git branch -d old')})`, () => {
    const s = runAll(fresh(), ['git branch old master~1'])
    const r = run(s, 'git branch -d old')
    expect(r.result.output).toBe(`Deleted branch old (was ${s.branches.old.slice(0, 7)}).`)
    expect(r.result).toMatchObject({ ok: true, exitCode: 0, explanation: ax.branchDeleted })
    expect(r.state.branches).not.toHaveProperty('old')
    expect(protocolEntry('П8.63', 'git branch -d old').output).toMatch(/^Deleted branch old \(was [0-9a-f]{7}\)\.$/)
  })

  it(`текущую ветку удалить нельзя: путь каталога у тренажёра — плейсхолдер /site с пояснением, как в разделе 2 (${where('П8.62', 'git branch -d master')})`, () => {
    const r = run(fresh(), 'git branch -d master')
    expect(r.result.output).toBe("error: cannot delete branch 'master' used by worktree at '/site'")
    expect(r.result.exitCode).toBe(1)
    expect(r.result.explanation).toBe(ru.branching.explain.worktreePathIsPlaceholder)
    expect(protocolEntry('П8.62', 'git branch -d master').output).toBe("error: cannot delete branch 'master' used by worktree at '/work'")
    expect(run(fresh(), 'git branch -D master').result.output).toBe("error: cannot delete branch 'master' used by worktree at '/site'")
  })

  it(`нет такой ветки: error: branch '…' not found, код 1; без имени: fatal: branch name required, код 128 (${where('П8.62', 'git branch -d nosuch')}, ${where('П8.63', 'git branch -d')})`, () => {
    expect(run(fresh(), 'git branch -d nosuch').result).toMatchObject({ output: "error: branch 'nosuch' not found", exitCode: 1 })
    expect(run(fresh(), 'git branch -d').result).toMatchObject({ output: 'fatal: branch name required', exitCode: 128 })
    expect(protocolEntry('П8.63', 'git branch -d').exitCode).toBe(128)
  })

  it(`-D удаляет неслитую ветку (${where('П8.62', 'git branch -D feature')})`, () => {
    const r = run(fresh(), 'git branch -D feature')
    expect(r.result.output).toBe(`Deleted branch feature (was ${fresh().branches.feature.slice(0, 7)}).`)
    expect(r.state.branches).not.toHaveProperty('feature')
  })

  it(`несколько имён: сначала все ошибки по порядку имён, потом Deleted по порядку имён; код 1, если была ошибка (${where('П8.63', 'git branch -d master old3 nosuch feature')})`, () => {
    const s = runAll(fresh(), ['git branch old3 master~1', 'git branch old4 master~1'])
    const r = run(s, 'git branch -d old3 master nosuch feature old4')
    expect(r.result.output.split('\n')).toEqual([
      "error: cannot delete branch 'master' used by worktree at '/site'",
      "error: branch 'nosuch' not found",
      "error: the branch 'feature' is not fully merged",
      "hint: If you are sure you want to delete it, run 'git branch -D feature'",
      'hint: Disable this message with "git config set advice.forceDeleteBranch false"',
      `Deleted branch old3 (was ${s.branches.old3.slice(0, 7)}).`,
      `Deleted branch old4 (was ${s.branches.old4.slice(0, 7)}).`,
    ])
    expect(r.result.exitCode).toBe(1)
    expect(Object.keys(r.state.branches).sort()).toEqual(['feature', 'master'])
  })

  it('повтор имени и другие сочетания ключей — отказ области, ветки на месте', () => {
    for (const command of ['git branch -d feature feature', 'git branch -d -D feature', 'git branch --delete feature', 'git branch -dD feature']) {
      const r = run(fresh(), command)
      expect(r.result.output.startsWith('[тренажёр]'), command).toBe(true)
      expect(r.result.exitCode).toBeUndefined()
      expect(r.state.branches).toEqual(fresh().branches)
    }
  })
})

describe('git branch -d в отсоединённом HEAD', () => {
  it(`ветка на коммите, где стоит HEAD, удаляется (текущей ветки нет): Deleted branch master (was <id7>). (${where('О6', 'git branch -d master')})`, () => {
    const s = runAll(fresh(), ['git checkout --detach master'])
    const r = run(s, 'git branch -d master')
    expect(r.result.output).toBe(`Deleted branch master (was ${readme7()}).`)
    expect(r.result).toMatchObject({ exitCode: 0, explanation: ax.branchDeletedUnderHead })
    expect(r.state.branches).not.toHaveProperty('master')
    expect(r.state.head).toEqual(s.head)
    expect(r.state.reflog).toEqual(s.reflog)
    expect(protocolEntry('О6', 'git branch -d master').output).toMatch(/^Deleted branch master \(was [0-9a-f]{7}\)\.$/)
  })

  it(`слитость считается относительно коммита HEAD: master не слита в master~1, feature слита в себя (${where('П8.62', 'git branch -d master', 1)}, ${where('П8.63', 'git branch -d feature')})`, () => {
    const low = runAll(fresh(), ['git checkout --detach master~1'])
    expect(run(low, 'git branch -d master').result).toMatchObject({ exitCode: 1, explanation: ax.branchNotMerged(true) })
    expect(run(low, 'git branch -D master').result.exitCode).toBe(0)
    const onFeature = runAll(fresh(), ['git checkout --detach feature'])
    expect(run(onFeature, 'git branch -d feature').result.output).toBe(`Deleted branch feature (was ${fresh().branches.feature.slice(0, 7)}).`)
    expect(run(onFeature, 'git branch -d master').result.exitCode).toBe(1)
  })

  it(`после удаления ветки X в статусе становится коротким id (${where('О15', 'git branch -D feature')})`, () => {
    const s = runAll(fresh(), ['git checkout --detach feature'])
    expect(run(s, 'git status').result.output.split('\n')[0]).toBe('HEAD detached at refs/heads/feature')
    const after = runAll(s, ['git branch -d feature'])
    expect(run(after, 'git status').result.output.split('\n')[0]).toBe(`HEAD detached at ${fresh().branches.feature.slice(0, 7)}`)
    expect(run(after, 'git branch').result.output).toBe(`* (HEAD detached at ${fresh().branches.feature.slice(0, 7)})\n  master`)
  })
})
