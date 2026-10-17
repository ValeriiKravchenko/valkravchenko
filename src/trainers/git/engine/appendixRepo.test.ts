import { describe, expect, it } from 'vitest'
import {
  allStarts,
  branchNames,
  commitOf,
  commitTree,
  createAppendixSection,
  currentCommitId,
  decorationMap,
  decorationText,
  diffTrees,
  graphOf,
  headTree,
  listWorkingFiles,
  logOrder,
  mayContainRename,
  reachableFrom,
  refsOf,
  sameTree,
  subjectOf,
  tagNames,
} from './appendixRepo'
import { fresh, protocolEntry, runAll, where } from './appendixProtocolKit'
import { ru } from '../locales/ru'

const byMessage = (state: ReturnType<typeof createAppendixSection>, message: string) => Object.values(state.commits).find((c) => c.message === message)!

describe('исходное состояние (target.md, часть X, «Исходное состояние»; П8.1)', () => {
  const s = createAppendixSection()
  const seed = ru.appendix.seed

  it('четыре коммита с 40-значными id в порядке создания: базовый, fix, «О проекте», README', () => {
    const commits = Object.values(s.commits)
    expect(commits.map((c) => c.message)).toEqual([seed.baseMessage, seed.fixMessage, seed.aboutMessage, seed.readmeMessage])
    expect(commits.map((c) => c.clock)).toEqual([0, 1, 2, 3])
    for (const c of commits) expect(c.id).toMatch(/^[0-9a-f]{40}$/)
    expect(new Set(commits.map((c) => c.id)).size).toBe(4)
  })

  it('родители: fix от базового, «О проекте» от fix, README от базового', () => {
    const base = byMessage(s, seed.baseMessage)
    expect(base.parents).toEqual([])
    expect(byMessage(s, seed.fixMessage).parents).toEqual([base.id])
    expect(byMessage(s, seed.aboutMessage).parents).toEqual([byMessage(s, seed.fixMessage).id])
    expect(byMessage(s, seed.readmeMessage).parents).toEqual([base.id])
  })

  it('master на README, feature на «О проекте», HEAD на master, тегов нет', () => {
    expect(s.branches).toEqual({ master: byMessage(s, seed.readmeMessage).id, feature: byMessage(s, seed.aboutMessage).id })
    expect(s.head).toEqual({ kind: 'branch', name: 'master' })
    expect(s.tags).toEqual({})
  })

  it('файлы: app.js (базовый), README.md; каждый кончается переводом строки; индекс совпадает с рабочим каталогом и HEAD', () => {
    expect(s.working).toEqual({ 'app.js': 'console.log("v1");\n', 'README.md': '# Мини-сайт\n' })
    expect(s.index).toEqual(s.working)
    expect(headTree(s)).toEqual(s.working)
    for (const content of Object.values(s.working)) expect(content.endsWith('\n')).toBe(true)
  })

  it('деревья коммитов: fix меняет app.js, «О проекте» добавляет about.html', () => {
    expect(commitTree(s, byMessage(s, seed.fixMessage).id)).toEqual({ 'app.js': 'console.log("v1"); // исправлена опечатка в логе\n' })
    expect(Object.keys(commitTree(s, byMessage(s, seed.aboutMessage).id)).sort()).toEqual(['about.html', 'app.js'])
  })

  it(`журнал HEAD — шесть записей, как в ${where('П8.1', 'git reflog')}, новая первой`, () => {
    expect(s.reflog.map((e) => e.message)).toEqual([
      'commit: Добавить README',
      'checkout: moving from feature to master',
      'commit: Добавить страницу «О проекте»',
      'commit: fix: опечатка в логе',
      'checkout: moving from master to feature',
      'commit (initial): Базовая версия приложения',
    ])
    expect(protocolEntry('П8.1', 'git reflog').output.split('\n')).toHaveLength(6)
  })

  it('lastCheckout — последняя запись checkout: переход на master с базового коммита', () => {
    expect(s.lastCheckout).toEqual({ spec: 'master', id: byMessage(s, seed.baseMessage).id })
  })

  it('логические часы продолжаются с четвёртого шага; история терминала и миссии пусты', () => {
    expect(s.clock).toBe(4)
    expect(s.history).toEqual([])
    expect(s.missionsDone).toEqual({ lightTag: false, annotatedShow: false })
  })

  it('два вызова дают одинаковое состояние (детерминизм id)', () => {
    expect(createAppendixSection()).toEqual(createAppendixSection())
  })
})

describe('чтение модели', () => {
  const s = createAppendixSection()

  it('commitOf: неизвестный id — нарушение условия вызова, исключение', () => {
    expect(() => commitOf(s, 'x')).toThrow('коммита x нет в состоянии')
  })

  it('currentCommitId: у ветки HEAD, которой нет в branches, коммита нет — исключение', () => {
    expect(() => currentCommitId({ ...s, head: { kind: 'branch', name: 'ghost' } })).toThrow('у ветки HEAD нет коммита')
  })

  it('currentCommitId в отсоединённом HEAD — сам id', () => {
    const base = byMessage(s, ru.appendix.seed.baseMessage).id
    expect(currentCommitId({ ...s, head: { kind: 'detached', id: base } })).toBe(base)
  })

  it('refsOf раскрывает аннотированные теги до коммитов; graphOf отдаёт родителей и сообщения', () => {
    const state = runAll(fresh(), ['git tag v1', 'git tag -a v2 -m "Релиз" HEAD~1'])
    const refs = refsOf(state)
    expect(Object.keys(refs.tags)).toEqual(['v1', 'v2'])
    expect(refs.tags.v1).toBe(currentCommitId(state))
    expect(refs.tags.v2).toBe(byMessage(state, ru.appendix.seed.baseMessage).id)
    const graph = graphOf(state)
    expect(graph[currentCommitId(state)].message).toBe(ru.appendix.seed.readmeMessage)
    expect(graph[currentCommitId(state)].parents).toEqual(commitOf(state, currentCommitId(state)).parents)
  })

  it('subjectOf — первая строка сообщения', () => {
    expect(subjectOf(s, currentCommitId(s))).toBe('Добавить README')
  })

  it('branchNames и tagNames — в порядке байтов; listWorkingFiles — в порядке байтов', () => {
    const state = runAll(fresh(), ['git tag v2', 'git tag V1', 'git tag Релиз'])
    expect(branchNames(state)).toEqual(['feature', 'master'])
    expect(tagNames(state)).toEqual(['V1', 'v2', 'Релиз'])
    expect(listWorkingFiles(s)).toEqual(['README.md', 'app.js'])
  })

  it('reachableFrom — предки включая сам коммит; logOrder — новые сверху (П8.1: README, «О проекте», fix, базовый)', () => {
    const feature = s.branches.feature
    expect(reachableFrom(s, [feature]).size).toBe(3)
    const all = logOrder(s, allStarts(s))
    expect(all.map((id) => subjectOf(s, id))).toEqual(['Добавить README', 'Добавить страницу «О проекте»', 'fix: опечатка в логе', 'Базовая версия приложения'])
    expect(logOrder(s, [s.branches.master]).map((id) => subjectOf(s, id))).toEqual(['Добавить README', 'Базовая версия приложения'])
  })

  it('allStarts: ветки, теги и коммит HEAD', () => {
    const state = runAll(fresh(), ['git tag v1 HEAD~1'])
    expect(allStarts(state).sort()).toEqual([state.branches.master, state.branches.feature, byMessage(state, ru.appendix.seed.baseMessage).id, state.branches.master].sort())
  })
})

describe('подписи (target.md, часть X, место 5)', () => {
  it('HEAD -> ветка первой, затем теги в обратном порядке байтов, затем остальные ветки в обратном порядке', () => {
    const state = runAll(fresh(), ['git tag v1.0.0', 'git tag v1.1.0', 'git tag v-x', 'git branch hotfix', 'git branch alpha'])
    const decorations = decorationMap(state)
    expect(decorations.get(currentCommitId(state))).toEqual(['HEAD -> master', 'tag: v1.1.0', 'tag: v1.0.0', 'tag: v-x', 'hotfix', 'alpha'])
    expect(decorationText(decorations, currentCommitId(state))).toBe(' (HEAD -> master, tag: v1.1.0, tag: v1.0.0, tag: v-x, hotfix, alpha)')
  })

  it('у коммита без подписей текст пустой', () => {
    const state = fresh()
    expect(decorationText(decorationMap(state), byMessage(state, ru.appendix.seed.fixMessage).id)).toBe('')
  })

  it('отсоединённый HEAD подписывается просто HEAD, без стрелки (П8.2: (HEAD, tag: v1.1.0, tag: v1.0.0))', () => {
    const state = fresh()
    const base = byMessage(state, ru.appendix.seed.baseMessage).id
    const detached = { ...state, head: { kind: 'detached' as const, id: base } }
    expect(decorationMap(detached).get(base)).toEqual(['HEAD'])
    // Ветка master теперь не текущая и стоит в своём коммите как обычная.
    expect(decorationMap(detached).get(state.branches.master)).toEqual(['master'])
  })
})

describe('diff и сравнение деревьев', () => {
  it('diffTrees срезает один перевод строки в конце: ни лишней строки «+», ни маркера конца файла', () => {
    const out = diffTrees({}, { 'a.txt': 'x\n' })
    expect(out.split('\n')).toEqual([
      'diff --git a/a.txt b/a.txt',
      'new file mode 100644',
      expect.stringMatching(/^index 0000000\.\.[0-9a-f]{7}$/),
      '--- /dev/null',
      '+++ b/a.txt',
      '@@ -0,0 +1 @@',
      '+x',
    ])
  })

  it('изменённая строка: одна строка «-» и одна «+»', () => {
    const out = diffTrees({ f: 'a\n' }, { f: 'b\n' }).split('\n')
    expect(out.slice(-3)).toEqual(['@@ -1 +1 @@', '-a', '+b'])
  })

  it('дерево без перевода строки в конце сравнивается как есть', () => {
    expect(diffTrees({ f: 'a' }, { f: 'b' }).split('\n').slice(-2)).toEqual(['-a', '+b'])
  })

  it('одинаковые деревья — пустой diff', () => {
    expect(diffTrees({ f: 'a\n' }, { f: 'a\n' })).toBe('')
  })

  it('sameTree: те же пути и то же содержимое', () => {
    expect(sameTree({ a: '1' }, { a: '1' })).toBe(true)
    expect(sameTree({ a: '1' }, { a: '2' })).toBe(false)
    expect(sameTree({ a: '1' }, { a: '1', b: '2' })).toBe(false)
    expect(sameTree({ a: '1', c: '2' }, { a: '1', b: '2' })).toBe(false)
  })

  it('mayContainRename: есть и удалённый, и добавленный путь (П8.24, П8.25)', () => {
    expect(mayContainRename({ a: '1' }, { b: '1' })).toBe(true)
    expect(mayContainRename({ a: '1' }, { a: '1', b: '1' })).toBe(false)
    expect(mayContainRename({ a: '1', b: '1' }, { a: '1' })).toBe(false)
    expect(mayContainRename({ a: '1' }, { a: '2' })).toBe(false)
  })
})
