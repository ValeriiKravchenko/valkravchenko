// Отсоединённый HEAD: общий модуль разделов 6 и 8 (target.md, часть XII). Тесты сверяют вывод
// побайтно с протоколами git 2.53.0: detached-head-git-runs.txt (блоки О1–О31) и
// section8-git-runs.txt (П8.12, П8.15, П8.18, П8.19). Имя теста называет блок. Id коммитов
// взяты из протокола; где протокол показывает только 7 знаков, хвост добирает fullId().
import { describe, expect, it } from 'vitest'
import {
  advanceHead,
  branchListFirstLine,
  checkoutReflogEntry,
  commitLabel,
  decorationHead,
  detachedLabel,
  detachedSource,
  headCommit,
  orphans,
  overwriteRefusalOutput,
  previousPosition,
  statusFirstLine,
  stashLabel,
  switchOutput,
  type BisectInput,
  type CommitGraph,
  type Head,
  type LastCheckout,
  type OperationInput,
  type Refs,
  type SwitchMode,
  type SwitchTarget,
} from './detachedHead'
import { entry, fullId as f, reflogMessage } from './detachedHeadProtocolKit'

// ---------- построение входов ----------

type Row = [id7: string, message: string, parent7: string | null, parent7b?: string]

function graph(...rows: Row[]): CommitGraph {
  const out: Record<string, { parents: string[]; message: string }> = {}
  for (const [id7, message, parent, parentB] of rows) {
    out[f(id7)] = { parents: [parent, parentB].filter((p): p is string => p != null).map(f), message }
  }
  return out
}

const br = (name: string): Head => ({ kind: 'branch', name })
const det = (id7: string): Head => ({ kind: 'detached', id: f(id7) })
const lc = (spec: string, id7: string): LastCheckout => ({ spec, id: f(id7) })
const toCommit = (id7: string, spec: string, objectKind: 'commit' | 'tag' = 'commit'): SwitchTarget => ({ kind: 'commit', id: f(id7), spec, objectKind })
const toBranch = (name: string, id7: string, created = false): SwitchTarget => ({ kind: 'branch', name, id: f(id7), created })
const refs = (branches: Record<string, string>, tags: Record<string, string> = {}, remotes?: Record<string, string>): Refs => ({
  branches: Object.fromEntries(Object.entries(branches).map(([k, v]) => [k, f(v)])),
  tags: Object.fromEntries(Object.entries(tags).map(([k, v]) => [k, f(v)])),
  ...(remotes ? { remotes: Object.fromEntries(Object.entries(remotes).map(([k, v]) => [k, f(v)])) } : {}),
})

function out(from: Head, to: SwitchTarget, how: SwitchMode, r: Refs, g: CommitGraph, carried: string[] = []): string {
  const res = switchOutput(from, to, how, r, g, carried)
  if (!res.ok) throw new Error(`отказ: ${JSON.stringify(res)}`)
  return res.output
}

const firstLine = (text: string): string => text.split('\n')[0]
const msgOf = (block: string, command: string, nth = 0): string => reflogMessage(firstLine(entry(block, command, nth).output))

/** Граф seed раздела 8: base ← fix ← about (feature), base ← README (master). Хэши из О1. */
const SEED = graph(
  ['8d359c1', 'Базовая версия приложения', null],
  ['59802bc', 'fix: опечатка в логе', '8d359c1'],
  ['890beb2', 'Добавить страницу «О проекте»', '59802bc'],
  ['b9731f9', 'Добавить README', '8d359c1'],
)
const SEED_REFS = refs({ master: 'b9731f9', feature: '890beb2' })

// ---------- простые функции контракта ----------

describe('headCommit, advanceHead (таблица «Контракт», часть XII)', () => {
  const branches = { master: f('b9731f9'), feature: f('890beb2') }

  it('на ветке коммит HEAD это кончик ветки; у ветки без коммитов null', () => {
    expect(headCommit(br('master'), branches)).toBe(f('b9731f9'))
    expect(headCommit(br('empty'), branches)).toBeNull()
  })

  it('в отсоединённом HEAD коммит HEAD это head.id', () => {
    expect(headCommit(det('8d359c1'), branches)).toBe(f('8d359c1'))
  })

  it('на ветке advanceHead двигает ветку, остальные ветки и head не меняются', () => {
    const r = advanceHead(br('master'), branches, f('5a1675c'))
    expect(r.head).toEqual(br('master'))
    expect(r.branches).toEqual({ master: f('5a1675c'), feature: f('890beb2') })
  })

  it('О3: в отсоединённом HEAD advanceHead двигает только head.id, ветки на месте', () => {
    const first = advanceHead(det('8d359c1'), branches, f('5a1675c'))
    const second = advanceHead(first.head, first.branches, f('5327720'))
    expect(second.head).toEqual({ kind: 'detached', id: f('5327720') })
    expect(second.branches).toEqual(branches)
  })

  it('advanceHead не меняет входы', () => {
    const before = { ...branches }
    const head = br('master')
    advanceHead(head, branches, f('5a1675c'))
    expect(branches).toEqual(before)
    expect(head).toEqual(br('master'))
  })
})

describe('commitLabel, stashLabel, decorationHead', () => {
  it('О3 (строка 160): коммит в отсоединённом HEAD печатает [detached HEAD <id7>] <тема>', () => {
    const line = firstLine(entry('О3', 'echo b >> app.js; git commit -am "Эксперимент 2"').output)
    expect(line).toBe(`[${commitLabel(det('5a1675c'))} 5327720] Эксперимент 2`)
  })

  it('П8.19: коммит на теге — [detached HEAD 1c2545c]', () => {
    const line = firstLine(entry('П8.19', 'git add app.js; git commit -m "Правка в отсоединённом HEAD"').output)
    expect(line).toBe(`[${commitLabel(det('e3ea6e8'))} 1c2545c] Правка в отсоединённом HEAD`)
  })

  it('О29: коммит посреди rebase из отсоединённого HEAD — тот же [detached HEAD 474ce06]', () => {
    const out29 = entry('О29', `echo 'console.log("both")' > app.js; git add app.js; GIT_EDITOR=true git rebase --continue`).output
    expect(firstLine(out29)).toBe(`[${commitLabel(det('35e30b4'))} 474ce06] fix: опечатка в логе`)
  })

  it('на ветке метка коммита это имя ветки', () => {
    expect(commitLabel(br('master'))).toBe('master')
  })

  it('П8.19: тайник в отсоединённом HEAD — WIP on (no branch): <id7> <тема>', () => {
    expect(entry('П8.19', 'edit; git stash').output).toBe(`Saved working directory and index state WIP on ${stashLabel(det('e3ea6e8'))}: e3ea6e8 Базовая версия приложения`)
    expect(entry('П8.19', 'git stash list').output).toBe(`stash@{0}: WIP on ${stashLabel(det('e3ea6e8'))}: e3ea6e8 Базовая версия приложения`)
  })

  it('О19: тайник с сообщением — On (no branch): <сообщение>', () => {
    expect(entry('О19', 'echo x >> app.js; git stash -m "с сообщением"').output).toBe(`Saved working directory and index state On ${stashLabel(det('b9731f9'))}: с сообщением`)
    expect(entry('О19', 'git stash list').output).toBe(`stash@{0}: On ${stashLabel(det('b9731f9'))}: с сообщением`)
  })

  it('О25: stash -m и stash pop в отсоединённом HEAD ничего не пишут в журнал, статус pop — HEAD detached at …', () => {
    expect(entry('О25', 'echo x >> app.js; git stash -m x').output).toBe(`Saved working directory and index state On ${stashLabel(det('9efda64'))}: x`)
    expect(firstLine(entry('О25', 'git stash pop').output)).toBe(statusFirstLine(det('9efda64'), lc('master', '9efda64'), refs({ master: '9efda64' }), null))
  })

  it('на ветке тайник называет ветку', () => {
    expect(stashLabel(br('master'))).toBe('master')
  })

  it('О2, О3 (строки 141, 212): подпись HEAD в отсоединённом состоянии без стрелки, на ветке со стрелкой', () => {
    expect(entry('О2', 'git log --oneline -1').output).toContain(`(${decorationHead(det('b9731f9'))}, master)`)
    expect(entry('О3', 'git reflog -1').output).toContain(`(${decorationHead(br('master'))})`)
    expect(entry('О3', 'git log --oneline --all').output).toContain(`5327720 (${decorationHead(det('5327720'))}) Эксперимент 2`)
  })

  it('О3 (строка 186): подпись (HEAD) без ветки', () => {
    expect(entry('О3', 'git reflog -4').output).toContain(`5327720 (${decorationHead(det('5327720'))}) HEAD@{0}`)
  })
})

// ---------- X, statusFirstLine, branchListFirstLine ----------

describe('X: detachedSource и detachedLabel (таблица «Что такое X»)', () => {
  it('П8.19, О11: тег, лёгкий или аннотированный, называется по имени', () => {
    expect(detachedSource(lc('v1.0.0', 'e3ea6e8'), refs({ master: 'ce1d4dc' }, { 'v1.0.0': 'e3ea6e8' }))).toBe('v1.0.0')
    expect(detachedSource(lc('v2.0', 'bbff213'), refs({}, { 'v2.0': 'bbff213' }))).toBe('v2.0')
  })

  it('О12: tags/<тег> показывается как <тег>', () => {
    expect(detachedSource(lc('tags/v2.0', 'f642668'), refs({}, { 'v2.0': 'f642668' }))).toBe('v2.0')
    expect(firstLine(entry('О12', 'git status').output)).toBe(`HEAD detached ${detachedLabel(det('f642668'), lc('tags/v2.0', 'f642668'), refs({}, { 'v2.0': 'f642668' }))}`)
  })

  it('О11: origin/<ветка> называется по имени', () => {
    const r = refs({ master: 'b0b0b01' }, {}, { 'origin/master': 'bbff213' })
    expect(firstLine(entry('О11', 'git status', 1).output)).toBe(statusFirstLine(det('bbff213'), lc('origin/master', 'bbff213'), r, null))
  })

  it('О2, О11: ветка называется полным именем refs/heads/<ветка>, и для master, и для refs/heads/master', () => {
    const r = refs({ master: 'b9731f9' })
    expect(detachedSource(lc('master', 'b9731f9'), r)).toBe('refs/heads/master')
    expect(detachedSource(lc('refs/heads/master', 'b9731f9'), r)).toBe('refs/heads/master')
    expect(firstLine(entry('О2', 'git status').output)).toBe(`HEAD detached ${detachedLabel(det('b9731f9'), lc('master', 'b9731f9'), r)}`)
    expect(entry('О11', 'git checkout -q refs/heads/master; git status | head -1').output).toBe(`HEAD detached ${detachedLabel(det('b9731f9'), lc('refs/heads/master', 'b9731f9'), r)}`)
  })

  it('О1, О8, О11, О14, О23, П8.12, П8.19: выражение, id (7 и 40 знаков) и HEAD дают id7', () => {
    const r = refs({ master: 'b9731f9', feature: '890beb2' }, { v1: '8d359c1' })
    for (const spec of ['HEAD~1', 'master~1', 'feature~1', 'HEAD@{1}', 'HEAD', '8d359c1', f('8d359c1')]) {
      expect(detachedSource(lc(spec, '8d359c1'), r)).toBe('8d359c1')
    }
    expect(entry('О11', 'git checkout -q $(git rev-parse master~1); git status | head -1').output).toBe('HEAD detached at bbff213')
    expect(firstLine(entry('О23', 'git status', 1).output)).toBe(`HEAD detached ${detachedLabel(det('2a72b28'), lc('HEAD', '2a72b28'), refs({ master: '2a72b28' }))}`)
    expect(firstLine(entry('О23', 'git status', 0).output)).toBe(`HEAD detached ${detachedLabel(det('79386ed'), lc('HEAD@{1}', '79386ed'), refs({ master: '2a72b28' }))}`)
  })

  it('О15: после tag -f ссылка указывает на другой коммит — X это id7', () => {
    const moved = refs({ master: '2a72b28' }, { t1: '2a72b28' })
    const status = entry('О15', 'git status', 0).output
    expect(status).toBe(`HEAD detached ${detachedLabel(det('f642668'), lc('t1', 'f642668'), moved)}\nnothing to commit, working tree clean`)
    expect(detachedSource(lc('t1', 'f642668'), refs({ master: '2a72b28' }, { t1: 'f642668' }))).toBe('t1')
  })

  it('О15: после tag -d тег исчез — X это id7', () => {
    const status = entry('О15', 'git status', 1).output
    expect(status).toBe(`HEAD detached ${detachedLabel(det('f642668'), lc('t1', 'f642668'), refs({ master: '2a72b28' }))}\nnothing to commit, working tree clean`)
  })

  it('О15: после branch -D <ветка> X это id7', () => {
    const status = entry('О15', 'git status', 2).output
    expect(status).toBe(`HEAD detached ${detachedLabel(det('2734c17'), lc('feature', '2734c17'), refs({ master: '2a72b28' }))}\nnothing to commit, working tree clean`)
    expect(detachedSource(lc('feature', '2734c17'), refs({ master: '2a72b28', feature: '2734c17' }))).toBe('refs/heads/feature')
  })

  it('О6: ветку, на которой отсоединились, удалили и поставили обратно на тот же коммит — снова refs/heads/master', () => {
    const r = refs({ master: 'b9731f9', feature: '890beb2' })
    expect(entry('О6', 'git status', 1).output).toBe(`HEAD detached ${detachedLabel(det('b9731f9'), lc('master', 'b9731f9'), r)}\nnothing to commit, working tree clean`)
    expect(detachedSource(lc('master', 'b9731f9'), refs({ feature: '890beb2' }))).toBe('b9731f9')
  })

  it('у тега и ветки с одним именем берётся первая найденная ссылка (тег), если она указывает не туда — id7', () => {
    const r = refs({ same: 'b9731f9' }, { same: '8d359c1' })
    expect(detachedSource(lc('same', 'b9731f9'), r)).toBe('b9731f9')
  })
})

describe('at и from (раздел «git status и git branch»)', () => {
  const r = refs({ master: 'b9731f9', feature: '890beb2' })

  it('на ветке меток нет', () => {
    expect(detachedLabel(br('master'), lc('master', 'b9731f9'), r)).toBeNull()
  })

  it('О3: коммит в отсоединённом HEAD — from', () => {
    expect(firstLine(entry('О3', 'git status').output)).toBe(statusFirstLine(det('5327720'), lc('master~1', '8d359c1'), SEED_REFS, null))
    expect(entry('О3', 'git status').output.split('\n')[0]).toBe('HEAD detached from 8d359c1')
  })

  it('О6: merge-перемотка — from; reset обратно на тот же коммит — снова at', () => {
    expect(firstLine(entry('О6', 'git status', 0).output)).toBe(`HEAD detached ${detachedLabel(det('890beb2'), lc('master~1', '8d359c1'), r)}`)
    expect(firstLine(entry('О6', 'git status', 1).output)).toBe(`HEAD detached ${detachedLabel(det('b9731f9'), lc('master', 'b9731f9'), r)}`)
  })

  it('О18: cherry-pick — from refs/heads/master', () => {
    const after = advanceHead(det('2a72b28'), {}, f('42d8202'))
    expect(firstLine(entry('О18', 'git status').output)).toBe(`HEAD detached ${detachedLabel(after.head, lc('master', '2a72b28'), refs({ master: '2a72b28' }))}`)
  })

  it('О20: reset --soft и обратно — from, затем at', () => {
    const rr = refs({ master: '2a72b28' })
    const soft = advanceHead(det('2a72b28'), rr.branches, f('f642668'))
    expect(firstLine(entry('О20', 'git status', 0).output)).toBe(`HEAD detached ${detachedLabel(soft.head, lc('master', '2a72b28'), rr)}`)
    const back = advanceHead(soft.head, rr.branches, f('2a72b28'))
    expect(firstLine(entry('О20', 'git status', 1).output)).toBe(`HEAD detached ${detachedLabel(back.head, lc('master', '2a72b28'), rr)}`)
  })

  it('П8.12, П8.18: rebase без конфликта — from <id7>, до него — at', () => {
    const l = lc('feature~1', '3a46230')
    expect(firstLine(entry('П8.18', 'git status', 0).output)).toBe(statusFirstLine(det('3a46230'), l, refs({ master: '14f9d4e' }), null))
    const rebased = advanceHead(det('3a46230'), {}, f('96a6924'))
    expect(firstLine(entry('П8.18', 'git status', 1).output)).toBe(statusFirstLine(rebased.head, l, refs({ master: '14f9d4e' }), null))
    expect(entry('П8.12', 'git status | head -3').output.split('\n')[0]).toBe(statusFirstLine(det('2ef6650'), lc('feature~1', '0fea8ce'), refs({ master: 'd0cbaa0' }), null))
  })

  it('П8.19: коммит на теге не меняет X: from v1.0.0', () => {
    const rr = refs({ master: 'ce1d4dc', feature: '60817e2' }, { 'v1.0.0': 'e3ea6e8' })
    expect(firstLine(entry('П8.19', 'git status', 2).output)).toBe(statusFirstLine(det('e3ea6e8'), lc('v1.0.0', 'e3ea6e8'), rr, null))
    expect(firstLine(entry('П8.19', 'git status', 3).output)).toBe(statusFirstLine(det('1c2545c'), lc('v1.0.0', 'e3ea6e8'), rr, null))
  })

  it('О26, О27, О29, О31: rebase без ветки заканчивается отсоединённым HEAD — from <X>', () => {
    const rr = refs({ master: '9efda64', conf: 'db6f304', feature: '2d97f01' })
    expect(firstLine(entry('О26', 'git status').output)).toBe(statusFirstLine(det('40d17fd'), lc('feature', '2d97f01'), rr, null))
    expect(firstLine(entry('О27', 'git status').output)).toBe(statusFirstLine(det('60c5a8f'), lc('feature', '2d97f01'), rr, null))
    expect(firstLine(entry('О29', 'git status').output)).toBe(statusFirstLine(det('f7c868c'), lc('feature', '974a84b'), refs({ conf: '35e30b4', feature: '974a84b' }), null))
    expect(firstLine(entry('О31', 'git status').output)).toBe(
      statusFirstLine(det('76450cf'), lc('vf', '974a84b'), refs({ conf: '35e30b4', feature: '974a84b' }, { vf: '974a84b' }), null),
    )
  })

  it('без lastCheckout место называется по самому HEAD', () => {
    expect(detachedLabel(det('8d359c1'), null, r)).toBe('at 8d359c1')
  })
})

describe('statusFirstLine', () => {
  const rebase: OperationInput = { kind: 'rebase', branch: 'feature' }

  it('H0: On branch <ветка>', () => {
    expect(statusFirstLine(br('feature'), null, SEED_REFS, null)).toBe('On branch feature')
    expect(firstLine(entry('О10', 'git status', 1).output)).toBe(statusFirstLine(br('feature'), lc('feature', '84f9f02'), SEED_REFS, null))
  })

  it('О10, О21, О28: посреди rebase в отсоединённом HEAD строки нет — первой идёт строка rebase', () => {
    expect(statusFirstLine(det('a52cd89'), lc('conf', 'a52cd89'), SEED_REFS, rebase)).toBeNull()
    expect(statusFirstLine(det('d4a5777'), lc('feature', '2734c17'), SEED_REFS, { kind: 'rebase', branch: null })).toBeNull()
    expect(firstLine(entry('О10', 'git status', 0).output)).toBe('interactive rebase in progress; onto a52cd89')
  })

  it('К13.b: после checkout -b посреди rebase HEAD на ветке — On branch', () => {
    expect(statusFirstLine(br('rescue'), null, SEED_REFS, rebase)).toBe('On branch rescue')
  })

  it('О9: посреди bisect первой идёт обычная строка H0 или H1', () => {
    const r = refs({ master: '0e9b75d' })
    expect(firstLine(entry('О9', 'git status', 0).output)).toBe(statusFirstLine(det('a69b192'), lc(f('a69b192'), 'a69b192'), r, null))
    expect(firstLine(entry('О9', 'git status', 1).output)).toBe(statusFirstLine(det('adf89d1'), lc('HEAD~1', 'adf89d1'), r, null))
    expect(firstLine(entry('О9', 'git status', 3).output)).toBe(statusFirstLine(det('17ba023'), lc(f('17ba023'), '17ba023'), r, null))
    expect(firstLine(entry('О9', 'git status', 4).output)).toBe(statusFirstLine(det('c5cfcb0'), lc(f('c5cfcb0'), 'c5cfcb0'), r, null))
    expect(entry('О9', 'git status', 2).output.split('\n')[0]).toBe(statusFirstLine(br('master'), null, r, null))
  })
})

describe('branchListFirstLine', () => {
  const rr = refs({ master: '0e9b75d' })
  const bisectMaster: BisectInput = { startedFrom: br('master') }

  it('H0, в том числе в B0 (bisect начат, HEAD на ветке): строки нет', () => {
    expect(branchListFirstLine(br('master'), null, rr, null, null)).toBeNull()
    expect(branchListFirstLine(br('master'), null, rr, null, bisectMaster)).toBeNull()
  })

  it('О1, О3, О11, П8.19: * (HEAD detached at/from <X>)', () => {
    expect(firstLine(entry('О1', 'git branch', 0).output)).toBe(branchListFirstLine(det('8d359c1'), lc('HEAD~1', '8d359c1'), SEED_REFS, null, null))
    expect(firstLine(entry('О3', 'git branch').output)).toBe(branchListFirstLine(det('5327720'), lc('master~1', '8d359c1'), SEED_REFS, null, null))
    expect(firstLine(entry('О2', 'git branch').output)).toBe(branchListFirstLine(det('b9731f9'), lc('master', 'b9731f9'), SEED_REFS, null, null))
    expect(firstLine(entry('П8.19', 'git branch', 0).output)).toBe(
      branchListFirstLine(det('e3ea6e8'), lc('e3ea6e8', 'e3ea6e8'), refs({ master: 'ce1d4dc', feature: '60817e2' }), null, null),
    )
    expect(firstLine(entry('П8.19', 'git branch', 3).output)).toBe(
      branchListFirstLine(det('1c2545c'), lc('v1.0.0', 'e3ea6e8'), refs({ master: 'ce1d4dc', feature: '60817e2' }, { 'v1.0.0': 'e3ea6e8' }), null, null),
    )
    expect(firstLine(entry('О11', 'git branch', 0).output)).toBe(branchListFirstLine(det('bbff213'), lc('v2.0', 'bbff213'), refs({}, { 'v2.0': 'bbff213' }), null, null))
  })

  it('О9: bisect, HEAD отсоединён — * (no branch, bisect started on master); так же после ручного checkout', () => {
    expect(firstLine(entry('О9', 'git branch', 0).output)).toBe(branchListFirstLine(det('a69b192'), lc(f('a69b192'), 'a69b192'), rr, null, bisectMaster))
    expect(firstLine(entry('О9', 'git branch', 1).output)).toBe(branchListFirstLine(det('adf89d1'), lc('HEAD~1', 'adf89d1'), rr, null, bisectMaster))
  })

  it('О9: bisect, начатый с коммита — started on <id7>', () => {
    expect(firstLine(entry('О9', 'git branch', 2).output)).toBe(
      branchListFirstLine(det('c5cfcb0'), lc(f('c5cfcb0'), 'c5cfcb0'), rr, null, { startedFrom: det('40b4060') }),
    )
  })

  it('О10: rebase, начатый с ветки — * (no branch, rebasing feature)', () => {
    expect(firstLine(entry('О10', 'git branch').output)).toBe(branchListFirstLine(det('a52cd89'), lc('conf', 'a52cd89'), SEED_REFS, { kind: 'rebase', branch: 'feature' }, null))
  })

  it('О21: rebase, начатый с отсоединённого HEAD по ветке — rebasing detached HEAD refs/heads/feature', () => {
    const r = refs({ master: '2a72b28', conf: 'd4a5777', feature: '2734c17' })
    expect(firstLine(entry('О21', 'git branch').output)).toBe(branchListFirstLine(det('d4a5777'), lc('feature', '2734c17'), r, { kind: 'rebase', branch: null }, null))
  })

  it('О28: rebase, начатый с отсоединённого HEAD по id — rebasing detached HEAD <id7>; abort возвращает at <id7>', () => {
    const r = refs({ master: '9efda64', conf: 'db6f304', feature: '2d97f01' })
    const op: OperationInput = { kind: 'rebase', branch: null }
    expect(firstLine(entry('О28', 'git branch', 0).output)).toBe(branchListFirstLine(det('db6f304'), lc('2d97f01', '2d97f01'), r, op, null))
    expect(firstLine(entry('О28', 'git status', 1).output)).toBe(statusFirstLine(det('2d97f01'), lc('2d97f01', '2d97f01'), r, null))
    // вторая половина блока: HEAD уже стоял на том же коммите, записи checkout: не было, lastCheckout прежнее
    expect(firstLine(entry('О28', 'git branch', 1).output)).toBe(branchListFirstLine(det('db6f304'), lc('2d97f01', '2d97f01'), r, op, null))
  })

  it('О30: rebase после checkout <тег> — rebasing detached HEAD vf; после abort — at vf', () => {
    const r = refs({ master: '9efda64', conf: '35e30b4', feature: '974a84b' }, { vf: '974a84b' })
    const op: OperationInput = { kind: 'rebase', branch: null }
    expect(firstLine(entry('О30', 'git branch', 0).output)).toBe(branchListFirstLine(det('35e30b4'), lc('vf', '974a84b'), r, op, null))
    expect(firstLine(entry('О30', 'git branch', 1).output)).toBe(branchListFirstLine(det('974a84b'), lc('vf', '974a84b'), r, null, null))
    expect(firstLine(entry('О30', 'git status').output)).toBe(statusFirstLine(det('974a84b'), lc('vf', '974a84b'), r, null))
  })

  it('О26, О29, О31: после --continue / --skip — * (HEAD detached from <X>)', () => {
    const r = refs({ master: '9efda64', conf: 'db6f304', feature: '2d97f01' })
    expect(firstLine(entry('О26', 'git branch').output)).toBe(branchListFirstLine(det('40d17fd'), lc('feature', '2d97f01'), r, null, null))
    expect(firstLine(entry('О29', 'git branch').output)).toBe(
      branchListFirstLine(det('f7c868c'), lc('feature', '974a84b'), refs({ conf: '35e30b4', feature: '974a84b' }), null, null),
    )
  })

  it('rebase старше bisect: при обоих побеждает rebase', () => {
    expect(branchListFirstLine(det('a52cd89'), lc('conf', 'a52cd89'), SEED_REFS, { kind: 'rebase', branch: 'feature' }, bisectMaster)).toBe('* (no branch, rebasing feature)')
  })
})

// ---------- orphans ----------

describe('orphans', () => {
  const chain = graph(
    ['8d359c1', 'base', null],
    ['b9731f9', 'readme', '8d359c1'],
    ['5a1675c', 'e1', '8d359c1'],
    ['5327720', 'e2', '5a1675c'],
  )

  it('О3: два брошенных коммита, новый первым', () => {
    expect(orphans(f('5327720'), refs({ master: 'b9731f9' }), chain)).toEqual([f('5327720'), f('5a1675c')])
  })

  it('коммит на ветке не брошен; на теге тоже (О4)', () => {
    expect(orphans(f('5327720'), refs({ master: 'b9731f9', rescue: '5327720' }), chain)).toEqual([])
    expect(orphans(f('5327720'), refs({ master: 'b9731f9' }, { keep: '5327720' }), chain)).toEqual([])
    expect(orphans(f('5327720'), refs({ master: 'b9731f9' }, { keep: '5a1675c' }), chain)).toEqual([f('5327720')])
  })

  it('коммит, достижимый с удалённой ветки, не брошен', () => {
    expect(orphans(f('5327720'), refs({ master: 'b9731f9' }, {}, { 'origin/master': '5327720' }), chain)).toEqual([])
  })

  it('коммит слияния: ребёнок раньше обоих родителей, сначала первый родитель', () => {
    const g = graph(['8d359c1', 'base', null], ['aaaaaa1', 'left', '8d359c1'], ['bbbbbb1', 'right', '8d359c1'], ['ccccccc', 'merge', 'aaaaaa1', 'bbbbbb1'])
    expect(orphans(f('ccccccc'), refs({ master: '8d359c1' }), g)).toEqual([f('ccccccc'), f('aaaaaa1'), f('bbbbbb1')])
  })

  it('HEAD на кончике ветки — брошенных нет', () => {
    expect(orphans(f('b9731f9'), refs({ master: 'b9731f9' }), chain)).toEqual([])
  })
})

// ---------- switchOutput ----------

describe('switchOutput: вход в отсоединённый HEAD', () => {
  it('О1: git switch HEAD~1 и git switch master~1 отказывают, код 128, hint про --detach', () => {
    for (const [command, spec] of [
      ['git switch HEAD~1', 'HEAD~1'],
      ['git switch master~1', 'master~1'],
    ] as const) {
      const e = entry('О1', command)
      const res = switchOutput(br('master'), toCommit('8d359c1', spec), 'switch', SEED_REFS, SEED, [])
      expect(res).toEqual({ ok: false, reason: 'branchExpected', exitCode: 128, output: e.output })
      expect(e.exitCode).toBe(128)
    }
  })

  it('О17: git switch <тег> — got tag', () => {
    const e = entry('О17', 'git switch v2.0')
    const res = switchOutput(br('master'), toCommit('f642668', 'v2.0', 'tag'), 'switch', SEED_REFS, SEED, [])
    expect(res).toEqual({ ok: false, reason: 'branchExpected', exitCode: 128, output: e.output })
  })

  it('О1: switch --detach master~1 — только HEAD is now at, без Note:; запись master → master~1', () => {
    const to = toCommit('8d359c1', 'master~1')
    expect(out(br('master'), to, 'detach', SEED_REFS, SEED)).toBe(entry('О1', 'git switch --detach master~1').output)
    expect(checkoutReflogEntry(br('master'), to)).toEqual({ message: msgOf('О1', 'git reflog -1', 0), lastCheckout: lc('master~1', '8d359c1') })
  })

  it('О1: checkout HEAD~1 с ветки — блок Note:, пустая строка, HEAD is now at', () => {
    expect(out(br('master'), toCommit('8d359c1', 'HEAD~1'), 'checkout', SEED_REFS, SEED)).toBe(entry('О1', 'git checkout HEAD~1').output)
  })

  it('П8.15: checkout <тег> с ветки', () => {
    const g = graph(['52407b7', 'Базовая версия приложения', null], ['d1cb1bd', 'Добавить README', '52407b7'])
    const to = toCommit('52407b7', 'v1.0.0')
    expect(out(br('master'), to, 'checkout', refs({ master: 'd1cb1bd' }, { 'v1.0.0': '52407b7' }), g)).toBe(entry('П8.15', 'git checkout v1.0.0').output)
    expect(checkoutReflogEntry(br('master'), to)?.message).toBe(msgOf('П8.15', 'git reflog -1', 0))
  })

  it('П8.2/О11: аннотированный тег, origin/master и tags/<тег> с ветки', () => {
    const g = graph(['bbff213', 'Базовая версия приложения', null], ['b0b0b01', 'Добавить README', 'bbff213'])
    const r = refs({ master: 'b0b0b01' }, { 'v2.0': 'bbff213' }, { 'origin/master': 'bbff213' })
    expect(out(br('master'), toCommit('bbff213', 'v2.0'), 'checkout', r, g)).toBe(entry('О11', 'git checkout v2.0').output)
    expect(out(br('master'), toCommit('bbff213', 'origin/master'), 'checkout', r, g)).toBe(entry('О11', "git update-ref refs/remotes/origin/master master~1; git checkout origin/master").output)
    expect(checkoutReflogEntry(br('master'), toCommit('bbff213', 'v2.0'))?.message).toBe(msgOf('О11', 'git reflog -1'))
    expect(out(det('bbff213'), toBranch('master', 'b0b0b01'), 'checkout', r, g)).toBe(entry('О11', 'git checkout master', 0).output)
  })

  it('О12: checkout tags/<тег> — Note: switching to \'tags/v2.0\'; запись to tags/v2.0', () => {
    const g = graph(['f642668', 'Базовая версия приложения', null], ['2a72b28', 'Добавить README', 'f642668'])
    const to = toCommit('f642668', 'tags/v2.0')
    expect(out(br('master'), to, 'checkout', refs({ master: '2a72b28' }, { 'v2.0': 'f642668' }), g)).toBe(entry('О12', 'git checkout tags/v2.0').output)
    expect(checkoutReflogEntry(br('master'), to)).toEqual({ message: msgOf('О12', 'git reflog -1'), lastCheckout: lc('tags/v2.0', 'f642668') })
  })

  it('О23: checkout HEAD@{1} с ветки; checkout --detach без ссылки печатает только HEAD is now at, запись to HEAD', () => {
    const g = graph(['2a72b28', 'Добавить README', null], ['79386ed', 'Опыт 7', '2a72b28'])
    const r = refs({ master: '2a72b28' })
    const first = toCommit('79386ed', 'HEAD@{1}')
    expect(out(br('master'), first, 'checkout', r, g)).toBe(entry('О23', 'git checkout HEAD@{1}').output)
    expect(checkoutReflogEntry(br('master'), first)?.message).toBe(msgOf('О23', 'git reflog -1', 0))
    const bare = toCommit('2a72b28', 'HEAD')
    expect(out(br('master'), bare, 'detach', r, g)).toBe(entry('О23', 'git checkout --detach').output)
    expect(checkoutReflogEntry(br('master'), bare)).toEqual({ message: msgOf('О23', 'git reflog -1', 1), lastCheckout: lc('HEAD', '2a72b28') })
    expect(out(det('2a72b28'), toBranch('master', '2a72b28'), 'checkout', r, g)).toBe(entry('О23', 'git checkout master').output)
  })

  it('О2, П8.15, О14: checkout --detach <ветка> и <ссылка>~n; запись to master', () => {
    expect(out(br('master'), toCommit('b9731f9', 'master'), 'detach', SEED_REFS, SEED)).toBe(entry('О2', 'git checkout --detach master').output)
    const g = graph(['f642668', 'Базовая версия приложения', null], ['2a72b28', 'Добавить README', 'f642668'])
    const r = refs({ master: '2a72b28' })
    expect(out(br('master'), toCommit('2a72b28', 'master'), 'detach', r, g)).toBe(entry('О14', 'git checkout --detach master').output)
    expect(checkoutReflogEntry(br('master'), toCommit('2a72b28', 'master'))?.message).toBe(msgOf('О14', 'git reflog -1', 1))
    const g2 = graph(['12f563f', 'fix: опечатка в логе', null], ['d1cb1bd', 'Добавить README', null])
    expect(out(br('master'), toCommit('12f563f', 'feature~1'), 'detach', refs({ master: 'd1cb1bd' }), g2)).toBe(entry('П8.15', 'git checkout --detach feature~1').output)
    expect(checkoutReflogEntry(br('master'), toCommit('12f563f', 'feature~1'))?.message).toBe(msgOf('П8.15', 'git reflog -1', 2))
  })

  it('П8.19: checkout <id7>, spec = id7', () => {
    const g = graph(['e3ea6e8', 'Базовая версия приложения', null], ['ce1d4dc', 'Добавить README', 'e3ea6e8'])
    const to = toCommit('e3ea6e8', 'e3ea6e8')
    expect(out(br('master'), to, 'checkout', refs({ master: 'ce1d4dc' }), g)).toBe(entry('П8.19', 'git checkout $(git rev-parse --short HEAD~1)').output)
    expect(checkoutReflogEntry(br('master'), to)?.message).toBe(msgOf('П8.19', 'git reflog -1', 0))
  })

  it('checkout HEAD с ветки в прогонах нет — unverifiedForm', () => {
    expect(switchOutput(br('master'), toCommit('b9731f9', 'HEAD'), 'checkout', SEED_REFS, SEED, [])).toEqual({ ok: false, reason: 'unverifiedForm' })
  })
})

describe('switchOutput: переходы из отсоединённого HEAD', () => {
  it('О1: git switch - и git checkout master с коммита без брошенных — Previous HEAD position + Switched to branch', () => {
    const r = SEED_REFS
    expect(out(det('8d359c1'), toBranch('master', 'b9731f9'), 'switch', r, SEED)).toBe(entry('О1', 'git switch -').output)
    expect(checkoutReflogEntry(det('8d359c1'), toBranch('master', 'b9731f9'))?.message).toBe(msgOf('О1', 'git reflog -1', 1))
  })

  it('О1: checkout HEAD с коммита — пустой вывод, записи в журнал нет', () => {
    const to = toCommit('8d359c1', 'HEAD')
    for (const nth of [0, 1]) {
      expect(entry('О1', 'git checkout HEAD', nth).output).toBe('')
      expect(out(det('8d359c1'), to, 'checkout', SEED_REFS, SEED)).toBe('')
    }
    expect(checkoutReflogEntry(det('8d359c1'), to)).toBeNull()
    expect(entry('О1', 'git reflog -2').output.split('\n')).toHaveLength(2)
  })

  it('О1: checkout другого коммита с коммита — Previous HEAD position + HEAD is now at, без Note:', () => {
    const to = toCommit('59802bc', 'feature~1')
    expect(out(det('8d359c1'), to, 'checkout', SEED_REFS, SEED)).toBe(entry('О1', 'git checkout feature~1', 0).output)
    expect(checkoutReflogEntry(det('8d359c1'), to)).toEqual({ message: msgOf('О1', 'git reflog -1', 2), lastCheckout: lc('feature~1', '59802bc') })
  })

  it('О1: тот же коммит под другим именем — только HEAD is now at, без Previous HEAD position; записи нет', () => {
    const to = toCommit('59802bc', 'feature~1')
    expect(out(det('59802bc'), to, 'checkout', SEED_REFS, SEED)).toBe(entry('О1', 'git checkout feature~1', 1).output)
    expect(checkoutReflogEntry(det('59802bc'), to)).toBeNull()
  })

  it('О1: checkout <ветка на том же коммите> — только Switched to branch', () => {
    const r = refs({ master: 'b9731f9', feature: '890beb2', same: '59802bc' })
    expect(out(det('59802bc'), toBranch('same', '59802bc'), 'checkout', r, SEED)).toBe(entry('О1', 'git checkout same').output)
    expect(checkoutReflogEntry(det('59802bc'), toBranch('same', '59802bc'))?.message).toBe(`checkout: moving from ${f('59802bc')} to same`)
    expect(out(br('same'), toBranch('master', 'b9731f9'), 'checkout', r, SEED)).toBe(entry('О1', 'git checkout master').output)
  })

  it('О13: checkout <тег на том же коммите> — HEAD is now at; записи в журнал нет, X прежний', () => {
    const g = graph(['f642668', 'Базовая версия приложения', null], ['2a72b28', 'Добавить README', 'f642668'])
    const r = refs({ master: '2a72b28' }, { v2: 'f642668', t0: 'f642668' })
    const to = toCommit('f642668', 't0')
    expect(out(det('f642668'), to, 'checkout', r, g)).toBe(entry('О13', 'git checkout t0').output)
    expect(checkoutReflogEntry(det('f642668'), to)).toBeNull()
    expect(entry('О13', 'git reflog -2').output.split('\n')[0]).toContain('checkout: moving from master to master~1')
    expect(entry('О13', 'git status').output).toBe(`${statusFirstLine(det('f642668'), lc('master~1', 'f642668'), r, null)}\nnothing to commit, working tree clean`)
  })

  it('О3: два брошенных коммита — leaving 2 commits behind, строки Previous HEAD position нет', () => {
    const g = graph(
      ['8d359c1', 'Базовая версия приложения', null],
      ['b9731f9', 'Добавить README', '8d359c1'],
      ['5a1675c', 'Эксперимент 1', '8d359c1'],
      ['5327720', 'Эксперимент 2', '5a1675c'],
    )
    const to = toBranch('master', 'b9731f9')
    expect(out(det('5327720'), to, 'checkout', refs({ master: 'b9731f9' }), g)).toBe(entry('О3', 'git checkout master').output)
    expect(checkoutReflogEntry(det('5327720'), to)?.message).toBe(msgOf('О3', 'git reflog -1', 0))
  })

  it('О4: пять коммитов — все; шесть — первые четыре и « ... and 2 more.»; уход на коммит; один коммит; тег гасит предупреждение', () => {
    const base = ['b9731f9', 'Добавить README', null] as Row
    const five = graph(
      base,
      ['a826003', 'Опыт 1', 'b9731f9'],
      ['16174e4', 'Опыт 2', 'a826003'],
      ['703dfe3', 'Опыт 3', '16174e4'],
      ['2190297', 'Опыт 4', '703dfe3'],
      ['1f0be26', 'Опыт 5', '2190297'],
    )
    expect(out(det('1f0be26'), toBranch('master', 'b9731f9'), 'switch', refs({ master: 'b9731f9' }), five)).toBe(entry('О4', 'git switch master').output)

    const six = graph(
      base,
      ['aaaaaa1', 'Опыт 1', 'b9731f9'],
      ['aaaaaa2', 'Опыт 2', 'aaaaaa1'],
      ['929d63f', 'Опыт 3', 'aaaaaa2'],
      ['48afb25', 'Опыт 4', '929d63f'],
      ['8889b03', 'Опыт 5', '48afb25'],
      ['b15a948', 'Опыт 6', '8889b03'],
    )
    expect(out(det('b15a948'), toBranch('master', 'b9731f9'), 'checkout', refs({ master: 'b9731f9' }), six)).toBe(entry('О4', 'git checkout master', 0).output)

    const one = graph(['8d359c1', 'Базовая версия приложения', null], ['b9731f9', 'Добавить README', '8d359c1'], ['ae38b02', 'Опыт z', 'b9731f9'])
    const r = refs({ master: 'b9731f9' })
    expect(out(det('ae38b02'), toCommit('8d359c1', 'master~1'), 'checkout', r, one)).toBe(entry('О4', 'git checkout master~1').output)
    expect(out(det('8d359c1'), toBranch('master', 'b9731f9'), 'checkout', r, one)).toBe(entry('О4', 'git checkout master', 1).output)

    const tagged = graph(['b9731f9', 'Добавить README', null], ['1efa9d6', 'Опыт t', 'b9731f9'])
    expect(out(det('1efa9d6'), toBranch('master', 'b9731f9'), 'checkout', refs({ master: 'b9731f9' }, { keep: '1efa9d6' }), tagged)).toBe(entry('О4', 'git checkout master', 2).output)
  })

  it('О22: семь брошенных коммитов — первые четыре и « ... and 3 more.»', () => {
    const g = graph(
      ['b9731f9', 'Добавить README', null],
      ['aaaaaa1', 'Опыт 1', 'b9731f9'],
      ['aaaaaa2', 'Опыт 2', 'aaaaaa1'],
      ['aaaaaa3', 'Опыт 3', 'aaaaaa2'],
      ['36ed8a4', 'Опыт 4', 'aaaaaa3'],
      ['d7f4810', 'Опыт 5', '36ed8a4'],
      ['9e39861', 'Опыт 6', 'd7f4810'],
      ['79386ed', 'Опыт 7', '9e39861'],
    )
    expect(out(det('79386ed'), toBranch('master', 'b9731f9'), 'checkout', refs({ master: 'b9731f9' }), g)).toBe(entry('О22', 'git checkout master').output)
  })

  it('П8.19: один брошенный коммит после коммита на теге — leaving 1 commit behind', () => {
    const g = graph(['e3ea6e8', 'Базовая версия приложения', null], ['ce1d4dc', 'Добавить README', 'e3ea6e8'], ['1c2545c', 'Правка в отсоединённом HEAD', 'e3ea6e8'])
    const r = refs({ master: 'ce1d4dc' }, { 'v1.0.0': 'e3ea6e8' })
    expect(out(det('1c2545c'), toBranch('master', 'ce1d4dc'), 'checkout', r, g)).toBe(entry('П8.19', 'git checkout master', 2).output)
    const g2 = graph(['e3ea6e8', 'Базовая версия приложения', null], ['ce1d4dc', 'Добавить README', 'e3ea6e8'], ['c1fa5c6', 'fix: опечатка в логе', 'e3ea6e8'])
    expect(out(det('e3ea6e8'), toBranch('master', 'ce1d4dc'), 'checkout', refs({ master: 'ce1d4dc' }), g2)).toBe(entry('П8.19', 'git checkout master', 0).output)
    expect(out(det('c1fa5c6'), toBranch('master', 'ce1d4dc'), 'checkout', refs({ master: 'ce1d4dc', feature: 'c1fa5c6' }), g2)).toBe(entry('П8.19', 'git checkout master', 1).output)
  })

  it('О5: checkout -b и switch -c с коммита — только Switched to a new branch; запись moving from <id> to <имя>', () => {
    const g = graph(['8d359c1', 'Базовая версия приложения', null], ['b9731f9', 'Добавить README', '8d359c1'], ['8e13e06', 'Эксперимент на ветку', '8d359c1'])
    const created = toBranch('experiment', '8e13e06', true)
    const r = refs({ master: 'b9731f9' })
    expect(out(det('8e13e06'), created, 'checkout', r, g)).toBe(entry('О5', 'git checkout -b experiment').output)
    expect(checkoutReflogEntry(det('8e13e06'), created)?.message).toBe(reflogMessage(firstLine(entry('О5', 'git reflog -2').output)))
    const exp2 = toBranch('exp2', '8d359c1', true)
    expect(out(det('8d359c1'), exp2, 'switch', r, g)).toBe(entry('О5', 'git switch -c exp2').output)
    expect(checkoutReflogEntry(det('8d359c1'), exp2)?.message).toBe(msgOf('О5', 'git reflog -1', 0))
  })

  it('О5: после git branch <имя> HEAD остаётся отсоединённым, уход на master без брошенных — Previous HEAD position', () => {
    const g = graph(['8d359c1', 'Базовая версия приложения', null], ['b9731f9', 'Добавить README', '8d359c1'])
    const r = refs({ master: 'b9731f9', here: '8d359c1', exp2: '8d359c1' })
    expect(entry('О5', 'git status', 1).output.split('\n')[0]).toBe(statusFirstLine(det('8d359c1'), lc('master~1', '8d359c1'), r, null))
    expect(out(det('8d359c1'), toBranch('master', 'b9731f9'), 'checkout', r, g)).toBe(entry('О5', 'git checkout master', 1).output)
  })

  it('П8.15: уход с коммита на master и checkout -b с ветки', () => {
    const g = graph(['52407b7', 'Базовая версия приложения', null], ['d1cb1bd', 'Добавить README', '52407b7'], ['12f563f', 'fix: опечатка в логе', '52407b7'])
    const r = refs({ master: 'd1cb1bd' })
    expect(out(det('12f563f'), toBranch('master', 'd1cb1bd'), 'checkout', refs({ master: 'd1cb1bd', feature: '12f563f' }), g)).toBe(entry('П8.15', 'git checkout master', 1).output)
    expect(checkoutReflogEntry(br('master'), toBranch('hotfix', 'd1cb1bd', true))?.message).toBe(msgOf('П8.15', 'git reflog -1', 3))
    expect(out(br('master'), toBranch('hotfix', 'd1cb1bd', true), 'checkout', r, g)).toBe(entry('П8.15', 'git checkout -b hotfix').output)
    expect(checkoutReflogEntry(br('master'), toBranch('topic', '52407b7'))?.message).toBe(msgOf('П8.15', 'git reflog -1', 5))
    expect(out(br('hotfix'), toBranch('master', 'd1cb1bd'), 'checkout', r, g)).toBe(entry('П8.15', 'git checkout master', 2).output)
  })

  it('О29: уход после rebase, начатого с коммита, — leaving 2 commits behind (перенесённые не на ветке)', () => {
    const g = graph(
      ['8d359c1', 'Базовая версия приложения', null],
      ['9efda64', 'Добавить README', '8d359c1'],
      ['35e30b4', 'conf: другая строка', '8d359c1'],
      ['474ce06', 'fix: опечатка в логе', '35e30b4'],
      ['f7c868c', 'Добавить страницу «О проекте»', '474ce06'],
    )
    const r = refs({ master: '9efda64', conf: '35e30b4' })
    expect(out(det('f7c868c'), toBranch('master', '9efda64'), 'checkout', r, g)).toBe(entry('О29', 'git checkout master').output)
  })
})

describe('switchOutput: bisect и ручной checkout посреди bisect (О9)', () => {
  const c = graph(
    ['c55df67', 'c1', null],
    ['af9e45f', 'c2', 'c55df67'],
    ['17ba023', 'c3', 'af9e45f'],
    ['c5cfcb0', 'c4', '17ba023'],
    ['a69b192', 'c5', 'c5cfcb0'],
    ['adf89d1', 'c6', 'a69b192'],
    ['d6831c2', 'c7', 'adf89d1'],
    ['40b4060', 'c8', 'd6831c2'],
    ['0e9b75d', 'c9', '40b4060'],
    ['90d2a13', 'правка посреди bisect', 'a69b192'],
  )
  const r = refs({ master: '0e9b75d' })

  it('переключение bisect не печатает строк перехода; запись moving from <ветка> to <полный id>', () => {
    const first = toCommit('a69b192', f('a69b192'))
    expect(out(br('master'), first, 'bisect', r, c)).toBe('')
    expect(checkoutReflogEntry(br('master'), first)).toEqual({ message: msgOf('О9', 'git reflog -2', 0), lastCheckout: lc(f('a69b192'), 'a69b192') })
    const next = toCommit('d6831c2', f('d6831c2'))
    expect(out(det('a69b192'), next, 'bisect', r, c)).toBe('')
    expect(checkoutReflogEntry(det('a69b192'), next)?.message).toBe(msgOf('О9', 'git reflog -1', 1))
  })

  it('ручной checkout посреди bisect: Previous HEAD position + HEAD is now at; запись to HEAD~1', () => {
    const to = toCommit('adf89d1', 'HEAD~1')
    expect(out(det('d6831c2'), to, 'checkout', r, c)).toBe(entry('О9', 'git checkout HEAD~1').output)
    expect(checkoutReflogEntry(det('d6831c2'), to)?.message).toBe(msgOf('О9', 'git reflog -1', 2))
  })

  it('git bisect reset: Previous HEAD position + Switched to branch; запись moving from <id> to master', () => {
    const to = toBranch('master', '0e9b75d')
    expect(out(det('adf89d1'), to, 'checkout', r, c)).toBe(entry('О9', 'git bisect reset', 0).output)
    expect(checkoutReflogEntry(det('adf89d1'), to)?.message).toBe(msgOf('О9', 'git reflog -3', 0))
  })

  it('git bisect reset после коммита посреди bisect — leaving 1 commit behind', () => {
    expect(out(det('90d2a13'), toBranch('master', '0e9b75d'), 'checkout', r, c)).toBe(entry('О9', 'git bisect reset', 2).output)
  })

  it('git bisect reset на ветке, куда уже перешли вручную — Already on', () => {
    expect(out(br('master'), toBranch('master', '0e9b75d'), 'checkout', r, c)).toBe(entry('О9', 'git bisect reset', 3).output)
    expect(out(br('master'), toBranch('master', '0e9b75d'), 'checkout', r, c)).toBe(entry('О9', 'git checkout master', 0).output)
  })

  it('checkout ветки посреди bisect с коммита — Previous HEAD position + Switched to branch', () => {
    expect(out(det('a69b192'), toBranch('master', '0e9b75d'), 'checkout', r, c)).toBe(entry('О9', 'git checkout master', 1).output)
  })

  it('bisect, начатый с коммита: reset возвращает на этот коммит — Previous HEAD position + HEAD is now at, без Note:', () => {
    const to = toCommit('40b4060', f('40b4060'))
    expect(out(det('c5cfcb0'), to, 'checkout', r, c)).toBe(entry('О9', 'git bisect reset', 1).output)
    expect(checkoutReflogEntry(det('c5cfcb0'), to)?.message).toBe(msgOf('О9', 'git reflog -2', 1))
  })

  it('git bisect reset <коммит>: те же строки, что у checkout с коммита', () => {
    const to = toCommit('17ba023', 'HEAD~2')
    expect(out(det('a69b192'), to, 'checkout', r, c)).toBe(entry('О9', 'git bisect reset HEAD~2').output)
  })
})

describe('switchOutput: перенесённые правки и отказы', () => {
  const g = graph(['479d20e', 'Базовая версия приложения', null], ['c0ffee1', 'Добавить README', '479d20e'])
  const r = refs({ master: 'c0ffee1' })

  it('О24: M\\t<файл> раньше блока Note:, Previous HEAD position и Already on', () => {
    expect(out(br('master'), toCommit('479d20e', 'master~1'), 'checkout', r, g, ['app.js'])).toBe(
      entry('О24', 'echo x >> app.js; stdbuf -oL -eL git checkout master~1 2>&1 | cat').output,
    )
    expect(out(det('479d20e'), toBranch('master', 'c0ffee1'), 'checkout', r, g, ['app.js'])).toBe(entry('О24', 'stdbuf -oL -eL git checkout master 2>&1 | cat', 0).output)
    expect(out(br('master'), toBranch('master', 'c0ffee1'), 'checkout', r, g, ['app.js'])).toBe(entry('О24', 'stdbuf -oL -eL git checkout master 2>&1 | cat', 1).output)
  })

  it('О7: вне терминала M\\t<файл> стоит в конце; модуль печатает порядок терминала (О24)', () => {
    const protocol = entry('О7', 'git checkout master').output.split('\n')
    expect(protocol).toEqual(["Already on 'master'", 'M\tREADME.md'])
    expect(out(br('master'), toBranch('master', 'c0ffee1'), 'checkout', r, g, ['README.md'])).toBe(['M\tREADME.md', "Already on 'master'"].join('\n'))
  })

  it('О16: с ветки на коммит с переносом правки — Note: и HEAD is now at, M\\t<файл> первой строкой', () => {
    const protocol = entry('О16', 'echo x >> app.js; git checkout master~1').output.split('\n')
    expect(protocol[protocol.length - 1]).toBe('M\tapp.js')
    const expected = ['M\tapp.js', ...protocol.slice(0, -1)].join('\n')
    const g16 = graph(['f642668', 'Базовая версия приложения', null], ['2a72b28', 'Добавить README', 'f642668'])
    expect(out(br('master'), toCommit('f642668', 'master~1'), 'checkout', refs({ master: '2a72b28' }), g16, ['app.js'])).toBe(expected)
  })

  it('перенесённые файлы идут в порядке, в котором их передали; переход bisect печатает только их', () => {
    expect(out(br('master'), toCommit('479d20e', f('479d20e')), 'bisect', r, g, ['a.js', 'b.js'])).toBe('M\ta.js\nM\tb.js')
  })

  it('отказ switch на коммит не печатает M\\t-строки', () => {
    const res = switchOutput(br('master'), toCommit('479d20e', 'master~1'), 'switch', r, g, ['app.js'])
    expect(res.ok).toBe(false)
    expect(res.ok === false && 'output' in res ? res.output.includes('M\t') : null).toBe(false)
  })

  it('О8: git switch - на коммит отказывает, в кавычках полный id', () => {
    const g8 = graph(['8d359c1', 'Базовая версия приложения', null], ['b9731f9', 'Добавить README', '8d359c1'])
    const res = switchOutput(br('master'), toCommit('8d359c1', f('8d359c1')), 'switch', SEED_REFS, g8, [])
    expect(res).toEqual({ ok: false, reason: 'branchExpected', exitCode: 128, output: entry('О8', 'git switch -', 0).output })
  })

  it('О7, О16, О24: отказ из-за правок — error, файлы с табуляцией, Please commit…, Aborting; код 1', () => {
    for (const [block, command, files, nth] of [
      ['О7', 'echo dirty >> README.md; git checkout master~1', ['README.md'], 0],
      ['О7', 'echo dirty >> app.js; git checkout feature~1', ['app.js'], 0],
      ['О16', 'echo x >> README.md; git checkout master~1', ['README.md'], 0],
      ['О16', 'echo x >> app.js; git checkout master', ['app.js'], 0],
      ['О24', 'stdbuf -oL -eL git checkout --detach feature 2>&1 | cat', ['app.js'], 0],
    ] as const) {
      const e = entry(block, command, nth)
      const refusal = overwriteRefusalOutput(files)
      expect(refusal.output).toBe(e.output)
      expect(refusal.exitCode).toBe(block === 'О24' ? 1 : e.exitCode)
    }
  })
})

describe('О8: checkout - и switch -', () => {
  const g = graph(['8d359c1', 'Базовая версия приложения', null], ['b9731f9', 'Добавить README', '8d359c1'])
  const r = SEED_REFS

  it('цепочка переходов: previousPosition читает «from» последней записи checkout:', () => {
    const reflog: string[] = []
    const push = (from: Head, to: SwitchTarget) => {
      const e = checkoutReflogEntry(from, to)
      if (e) reflog.unshift(e.message)
    }
    // checkout -q --detach master~1
    push(br('master'), toCommit('8d359c1', 'master~1'))
    expect(previousPosition(reflog)).toEqual({ kind: 'branch', name: 'master' })
    // git checkout -
    expect(out(det('8d359c1'), toBranch('master', 'b9731f9'), 'checkout', r, g)).toBe(entry('О8', 'git checkout -', 0).output)
    push(det('8d359c1'), toBranch('master', 'b9731f9'))
    expect(previousPosition(reflog)).toEqual({ kind: 'commit', id: f('8d359c1') })
    // git checkout - снова: на коммит, spec — полный id
    const back = toCommit('8d359c1', f('8d359c1'))
    expect(out(br('master'), back, 'checkout', r, g)).toBe(entry('О8', 'git checkout -', 1).output)
    push(br('master'), back)
    expect(reflog[0]).toBe(msgOf('О14', 'git reflog -1', 0).replace(f('f642668'), f('8d359c1')))
    expect(statusFirstLine(det('8d359c1'), lc(f('8d359c1'), '8d359c1'), r, null)).toBe(firstLine(entry('О8', 'git status', 0).output))
    // git checkout - обратно на ветку
    expect(previousPosition(reflog)).toEqual({ kind: 'branch', name: 'master' })
    expect(out(det('8d359c1'), toBranch('master', 'b9731f9'), 'checkout', r, g)).toBe(entry('О8', 'git checkout -', 2).output)
  })

  it('О14: checkout - на коммит с ветки пишет to <полный id>', () => {
    expect(checkoutReflogEntry(br('master'), toCommit('f642668', f('f642668')))?.message).toBe(msgOf('О14', 'git reflog -1', 0))
    expect(previousPosition([msgOf('О14', 'git reflog -1', 0)])).toEqual({ kind: 'branch', name: 'master' })
  })

  it('previousPosition пропускает записи не-checkout и возвращает null, если записей нет', () => {
    expect(previousPosition(['commit: Эксперимент 2', 'checkout: moving from feature to master', 'checkout: moving from master to feature'])).toEqual({ kind: 'branch', name: 'feature' })
    expect(previousPosition(['commit: x'])).toBeNull()
    expect(previousPosition([])).toBeNull()
  })

  it('О3 (строка 220): после коммитов previousPosition берёт запись checkout:, а не commit:', () => {
    const lines = entry('О3', 'git reflog -5').output.split('\n').map(reflogMessage)
    expect(previousPosition(lines.slice(1))).toEqual({ kind: 'branch', name: 'master' })
    expect(previousPosition(lines)).toEqual({ kind: 'commit', id: f('5327720') })
  })
})

describe('checkoutReflogEntry', () => {
  it('О1: с коммита на ветку — moving from <полный id> to <ветка>', () => {
    expect(checkoutReflogEntry(det('59802bc'), toBranch('master', 'b9731f9'))).toEqual({
      message: `checkout: moving from ${f('59802bc')} to master`,
      lastCheckout: lc('master', 'b9731f9'),
    })
  })

  it('О25: checkout --detach master с master — moving from master to master', () => {
    expect(checkoutReflogEntry(br('master'), toCommit('9efda64', 'master'))?.message).toBe(msgOf('О25', 'git reflog -1', 0))
  })

  it('не меняет входы', () => {
    const from = det('59802bc')
    const to = toCommit('8d359c1', 'HEAD~1')
    checkoutReflogEntry(from, to)
    expect(from).toEqual(det('59802bc'))
    expect(to).toEqual(toCommit('8d359c1', 'HEAD~1'))
  })
})
