import { describe, expect, it } from 'vitest'
import { ambiguousArgumentOutput, resolveRevision } from './appendixRevisions'
import { currentCommitId } from './appendixRepo'
import { fresh, protocolEntry, runAll, where } from './appendixProtocolKit'
import { ru } from '../locales/ru'

const seed = ru.appendix.seed
const idOf = (state: ReturnType<typeof fresh>, message: string) => Object.values(state.commits).find((c) => c.message === message)!.id

describe('разбор ссылки', () => {
  const s = runAll(fresh(), ['git tag v1', 'git tag -a v2 -m "Релиз" feature'])
  const base = idOf(s, seed.baseMessage)
  const readme = idOf(s, seed.readmeMessage)
  const about = idOf(s, seed.aboutMessage)
  const fix = idOf(s, seed.fixMessage)

  it('HEAD, ветка и лёгкий тег дают коммит; аннотированного тега нет', () => {
    expect(resolveRevision(s, 'HEAD')).toEqual({ kind: 'commit', id: readme, annotated: null })
    expect(resolveRevision(s, 'feature')).toEqual({ kind: 'commit', id: about, annotated: null })
    expect(resolveRevision(s, 'v1')).toEqual({ kind: 'commit', id: readme, annotated: null })
  })

  it('аннотированный тег дают коммит и сам тег; с цепочкой ~/^ тег уже не называется', () => {
    const r = resolveRevision(s, 'v2')
    expect(r.kind).toBe('commit')
    if (r.kind === 'commit') {
      expect(r.id).toBe(about)
      expect(r.annotated?.name).toBe('v2')
      expect(r.annotated?.tag.message).toBe('Релиз')
    }
    expect(resolveRevision(s, 'v2~1')).toEqual({ kind: 'commit', id: fix, annotated: null })
  })

  it('цепочка: ~, ~N, ^, ^1, ^0, ~0 и их сочетания (П8.2: HEAD~0, HEAD~1; П8.30: HEAD~, HEAD^)', () => {
    expect(resolveRevision(s, 'HEAD~0')).toMatchObject({ id: readme })
    expect(resolveRevision(s, 'HEAD~1')).toMatchObject({ id: base })
    expect(resolveRevision(s, 'HEAD~')).toMatchObject({ id: base })
    expect(resolveRevision(s, 'HEAD^')).toMatchObject({ id: base })
    expect(resolveRevision(s, 'HEAD^1')).toMatchObject({ id: base })
    expect(resolveRevision(s, 'HEAD^0')).toMatchObject({ id: readme })
    expect(resolveRevision(s, 'feature~2')).toMatchObject({ id: base })
    expect(resolveRevision(s, 'feature~1~1')).toMatchObject({ id: base })
    expect(resolveRevision(s, 'feature^^')).toMatchObject({ id: base })
  })

  it(`за корнем истории — missing: HEAD~9, master~5, HEAD~~ (${where('П8.31', 'git log HEAD~9')})`, () => {
    expect(resolveRevision(s, 'HEAD~9')).toEqual({ kind: 'missing' })
    expect(resolveRevision(s, 'master~5')).toEqual({ kind: 'missing' })
    expect(resolveRevision(s, 'HEAD~~')).toEqual({ kind: 'missing' })
    expect(protocolEntry('П8.31', 'git log master~5').exitCode).toBe(128)
  })

  it('второго родителя нет: ^2 — missing', () => {
    expect(resolveRevision(s, 'HEAD^2')).toEqual({ kind: 'missing' })
  })

  it('id коммита: 4–40 знаков, однозначное начало; короче четырёх — missing (не id)', () => {
    expect(resolveRevision(s, base.slice(0, 7))).toMatchObject({ id: base })
    expect(resolveRevision(s, base.slice(0, 4))).toMatchObject({ id: base })
    expect(resolveRevision(s, base)).toMatchObject({ id: base })
    expect(resolveRevision(s, base.slice(0, 7) + '~0')).toMatchObject({ id: base })
    expect(resolveRevision(s, '1234567')).toEqual({ kind: 'missing' })
  })

  it('id с заглавными буквами и начало id объекта тега — foreign (git их понимает, модель нет)', () => {
    expect(resolveRevision(s, base.slice(0, 7).toUpperCase().replace(/[0-9]/g, 'A'))).toEqual({ kind: 'foreign' })
    const tagObject = (s.tags.v2 as { object: string }).object
    expect(resolveRevision(s, tagObject.slice(0, 7))).toEqual({ kind: 'foreign' })
  })

  it('неоднозначное начало id — foreign; однозначное — коммит', () => {
    const a = 'abcd1' + '0'.repeat(35)
    const b = 'abcd2' + '0'.repeat(35)
    const state = { ...s, commits: { ...s.commits, [a]: { ...s.commits[base], id: a }, [b]: { ...s.commits[base], id: b } } }
    expect(resolveRevision(state, 'abcd')).toEqual({ kind: 'foreign' })
    expect(resolveRevision(state, 'abcd1')).toMatchObject({ id: a })
    expect(resolveRevision(state, 'abce')).toEqual({ kind: 'missing' })
  })

  it(`неизвестное имя — missing (${where('П8.2', 'git tag v9 nosuch')})`, () => {
    expect(resolveRevision(s, 'nosuch')).toEqual({ kind: 'missing' })
    expect(resolveRevision(s, '')).toEqual({ kind: 'missing' })
  })

  it('выражения, которые git понимает, а модель нет, — foreign', () => {
    for (const token of ['HEAD@{1}~1', 'HEAD@{01}', 'HEAD@{-1}', 'HEAD@{x}', 'master@{1}', '@{1}', '@', 'master..feature', 'a...b', 'refs/tags/v1', 'refs/heads/', 'tags/', 'tags/a/b', 'refs/heads/master..feature', 'origin/master', 'v1^{}', ':/README', '^master', '~1', '-x', 'a:b', 'a*', 'a?', 'a[1]', 'a\\b', 'a b', 'HEAD~x', 'HEAD~1x']) {
      expect(resolveRevision(s, token), token).toEqual({ kind: 'foreign' })
    }
  })

  it('тег и ветка с одним именем не создаются, поэтому порядок поиска ветка → тег не важен; имя ветки находится раньше id', () => {
    const state = runAll(fresh(), ['git branch dead'])
    expect(resolveRevision(state, 'dead')).toMatchObject({ id: currentCommitId(state) })
  })
})

describe('HEAD@{n}, tags/<тег> и refs/heads/<ветка>', () => {
  const s = runAll(fresh(), ['git tag v1', 'git tag -a v2 -m "Релиз" feature'])
  const base = idOf(s, seed.baseMessage)
  const about = idOf(s, seed.aboutMessage)
  const fix = idOf(s, seed.fixMessage)

  it(`HEAD@{n}: запись журнала HEAD с номером n, считая с нуля; {0} — сам HEAD (${where('П8.61', 'git log --oneline HEAD@{2}')})`, () => {
    expect(resolveRevision(s, 'HEAD@{0}')).toEqual({ kind: 'commit', id: s.reflog[0].id, annotated: null })
    expect(resolveRevision(s, 'HEAD@{1}')).toEqual({ kind: 'commit', id: base, annotated: null })
    expect(resolveRevision(s, 'HEAD@{2}')).toEqual({ kind: 'commit', id: about, annotated: null })
    expect(resolveRevision(s, 'HEAD@{3}')).toEqual({ kind: 'commit', id: fix, annotated: null })
    expect(resolveRevision(s, 'HEAD@{5}')).toEqual({ kind: 'commit', id: base, annotated: null })
  })

  it(`за концом журнала — reflogShort с числом записей (${where('П8.61', 'git show HEAD@{6}')}); число растёт с перемещениями HEAD`, () => {
    expect(resolveRevision(s, 'HEAD@{6}')).toEqual({ kind: 'reflogShort', entries: 6 })
    expect(resolveRevision(s, 'HEAD@{99}')).toEqual({ kind: 'reflogShort', entries: 6 })
    const moved = runAll(s, ['git checkout feature'])
    expect(resolveRevision(moved, 'HEAD@{6}')).toMatchObject({ kind: 'commit' })
    expect(resolveRevision(moved, 'HEAD@{7}')).toEqual({ kind: 'reflogShort', entries: 7 })
  })

  it('номер без ведущих нулей и не больше шести знаков; цепочка после HEAD@{n} не разбирается', () => {
    for (const token of ['HEAD@{01}', 'HEAD@{-1}', 'HEAD@{1000000}', 'HEAD@{}', 'HEAD@{1}~1', 'HEAD@{1}^', 'head@{1}']) expect(resolveRevision(s, token), token).toEqual({ kind: 'foreign' })
  })

  it(`tags/<тег> и refs/heads/<ветка> называют ссылку целиком (${where('О12', 'git checkout tags/v2.0')}, ${where('О11', 'git checkout -q refs/heads/master; git status | head -1')})`, () => {
    expect(resolveRevision(s, 'tags/v1')).toEqual({ kind: 'commit', id: currentCommitId(s), annotated: null })
    expect(resolveRevision(s, 'refs/heads/feature')).toEqual({ kind: 'commit', id: about, annotated: null })
    expect(resolveRevision(s, 'refs/heads/feature~1')).toEqual({ kind: 'commit', id: fix, annotated: null })
    expect(resolveRevision(s, 'tags/v2~1')).toEqual({ kind: 'commit', id: fix, annotated: null })
    const annotated = resolveRevision(s, 'tags/v2')
    expect(annotated).toMatchObject({ kind: 'commit', id: about })
    if (annotated.kind === 'commit') expect(annotated.annotated?.name).toBe('v2')
  })

  it('префикс ищет только среди своих ссылок: tags/<ветка> и refs/heads/<тег> — missing; чужой префикс — foreign', () => {
    expect(resolveRevision(s, 'tags/feature')).toEqual({ kind: 'missing' })
    expect(resolveRevision(s, 'refs/heads/v1')).toEqual({ kind: 'missing' })
    expect(resolveRevision(s, 'tags/nosuch')).toEqual({ kind: 'missing' })
    expect(resolveRevision(s, 'tags/v1~9')).toEqual({ kind: 'missing' })
    for (const token of ['refs/tags/v1', 'refs/remotes/origin/x', 'tags/', 'tags/a/b', 'refs/heads/a..b']) expect(resolveRevision(s, token), token).toEqual({ kind: 'foreign' })
  })
})

describe('ответ git на слово, которого нет (П8.30)', () => {
  it(`ambiguousArgumentOutput дословно совпадает с протоколом (${where('П8.31', 'git log nosuch')})`, () => {
    expect(ambiguousArgumentOutput('nosuch')).toBe(protocolEntry('П8.31', 'git log nosuch').output)
    expect(ambiguousArgumentOutput('master~5')).toBe(protocolEntry('П8.31', 'git show master~5').output)
  })
})
