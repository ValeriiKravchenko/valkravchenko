// git log с подписями (target.md, часть X, место 5). Вывод — дословно из section8-git-runs.txt
// (П8.1, П8.2, П8.13) и appendix-g18e-git-runs.txt (П8.31); без строк Author и Date (часть X,
// «Автор и дата в разделе 8»).
import { describe, expect, it } from 'vitest'
import { currentCommitId } from './appendixRepo'
import { fresh, normalizeGitOutput, protocolEntry, run, runAll, where } from './appendixProtocolKit'
import type { AppendixState } from './appendixSection'
import { ru } from '../locales/ru'

const refusal = (output: string) => expect(output.startsWith('[тренажёр]')).toBe(true)
const lines = (s: AppendixState, command: string) => run(s, command).result.output.split('\n')

describe('git log: исходная история', () => {
  it(`--oneline: подпись только у верхушки, остальные строки без подписи (${where('П8.1', 'git log --oneline')})`, () => {
    const out = lines(fresh(), 'git log --oneline')
    expect(out).toHaveLength(2)
    expect(out[0]).toMatch(/^[0-9a-f]{7} \(HEAD -> master\) Добавить README$/)
    expect(out[1]).toMatch(/^[0-9a-f]{7} Базовая версия приложения$/)
  })

  it(`--oneline --all: README, «О проекте», fix, базовый; feature подписана (${where('П8.1', 'git log --oneline --all')})`, () => {
    const out = lines(fresh(), 'git log --oneline --all')
    expect(out.map((l) => l.replace(/^[0-9a-f]{7}/, '<id7>'))).toEqual([
      '<id7> (HEAD -> master) Добавить README',
      '<id7> (feature) Добавить страницу «О проекте»',
      '<id7> fix: опечатка в логе',
      '<id7> Базовая версия приложения',
    ])
    expect(protocolEntry('П8.1', 'git log --oneline --all').output.split('\n')).toHaveLength(4)
  })

  it(`git log <ветка> и --oneline <ветка>: история ветки, подпись ветки (${where('П8.1', 'git log --oneline feature')})`, () => {
    const out = lines(fresh(), 'git log --oneline feature')
    expect(out.map((l) => l.replace(/^[0-9a-f]{7}/, '<id7>'))).toEqual(['<id7> (feature) Добавить страницу «О проекте»', '<id7> fix: опечатка в логе', '<id7> Базовая версия приложения'])
  })

  it(`полный вид: commit <40 знаков> (подписи), пустая строка, сообщение с отступом; записи через пустую строку (${where('П8.1', 'git log')})`, () => {
    const s = fresh()
    const r = run(s, 'git log').result
    const [readme, base] = [currentCommitId(s), s.commits[currentCommitId(s)].parents[0]]
    expect(r.output).toBe(
      [`commit ${readme} (HEAD -> master)`, '', '    Добавить README', '', `commit ${base}`, '', '    Базовая версия приложения'].join('\n'),
    )
    expect(r.exitCode).toBe(0)
    expect(r.explanation).toBe(ru.appendix.explain.authorDateNotShown)
    expect(normalizeGitOutput('git log', protocolEntry('П8.1', 'git log').output).split('\n')[0]).toMatch(/^commit [0-9a-f]{40} \(HEAD -> master\)$/)
  })

  it('--oneline без пояснения про автора и дату', () => {
    expect(run(fresh(), 'git log --oneline').result.explanation).toBeNull()
  })
})

describe('git log: подписи тегов и ограничения', () => {
  const tagged = runAll(fresh(), ['git tag v1', 'git tag -a v2 -m "Релиз" feature'])

  it(`теги на каждой строке своего коммита; тег перед веткой (${where('П8.31', 'git log --oneline --all')})`, () => {
    const out = lines(tagged, 'git log --oneline --all')
    expect(out.map((l) => l.replace(/^[0-9a-f]{7}/, '<id7>'))).toEqual([
      '<id7> (HEAD -> master, tag: v1) Добавить README',
      '<id7> (tag: v2, feature) Добавить страницу «О проекте»',
      '<id7> fix: опечатка в логе',
      '<id7> Базовая версия приложения',
    ])
  })

  it(`-1: одна запись (${where('П8.31', 'git log --all -1')})`, () => {
    expect(lines(tagged, 'git log -1')).toHaveLength(3)
    expect(lines(tagged, 'git log -1')[0]).toMatch(/^commit [0-9a-f]{40} \(HEAD -> master, tag: v1\)$/)
    expect(lines(tagged, 'git log --all -1')[0]).toMatch(/^commit [0-9a-f]{40} \(HEAD -> master, tag: v1\)$/)
  })

  it(`-N любое положительное: -2 (${where('П8.31', 'git log -2')})`, () => {
    expect(lines(tagged, 'git log --oneline -2')).toHaveLength(2)
    expect(lines(tagged, 'git log --oneline --all -3')).toHaveLength(3)
  })

  it(`ключи в любом порядке: --oneline -1 feature, -1 --oneline, --oneline --all -1 (${where('П8.31', 'git log --oneline -1 feature')}, ${where('П8.31', 'git log -1 --oneline')})`, () => {
    const a = run(tagged, 'git log --oneline -1 feature').result.output
    const b = run(tagged, 'git log feature -1 --oneline').result.output
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{7} \(tag: v2, feature\) Добавить страницу «О проекте»$/)
    expect(run(tagged, 'git log -1 --oneline').result.output).toBe(run(tagged, 'git log --oneline -1').result.output)
    expect(run(tagged, 'git log --oneline --all -1').result.output).toMatch(/^[0-9a-f]{7} \(HEAD -> master, tag: v1\) Добавить README$/)
  })

  it(`ссылка: лёгкий и аннотированный тег, HEAD~1, HEAD~, HEAD^, начало id (${where('П8.31', 'git log --oneline v2')}, ${where('П8.31', 'git log HEAD~')})`, () => {
    expect(lines(tagged, 'git log --oneline v2')[0]).toMatch(/\(tag: v2, feature\)/)
    expect(lines(tagged, 'git log --oneline v2')).toHaveLength(3)
    for (const form of ['git log --oneline HEAD~1', 'git log --oneline HEAD~', 'git log --oneline HEAD^']) expect(lines(tagged, form), form).toHaveLength(1)
    const base = tagged.commits[currentCommitId(tagged)].parents[0]
    expect(lines(tagged, `git log --oneline ${base.slice(0, 7)}`)).toEqual([`${base.slice(0, 7)} Базовая версия приложения`])
  })

  it('новый коммит на feature встаёт сверху в --all, родитель ниже потомка', () => {
    const s = runAll(fresh(), ['git checkout feature'])
    const edited = { ...s, working: { ...s.working, 'app.js': 'z\n' } }
    const after = runAll(edited, ['git commit -am "На feature"'])
    const out = lines(after, 'git log --oneline --all')
    expect(out[0]).toMatch(/^[0-9a-f]{7} \(HEAD -> feature\) На feature$/)
    expect(out[1]).toMatch(/\(master\) Добавить README$/)
    expect(out).toHaveLength(5)
    expect(lines(after, 'git log --oneline')).toHaveLength(4)
  })

  it('подписи отсоединённого HEAD: HEAD без стрелки (П8.2)', () => {
    const s = fresh()
    const base = s.commits[s.branches.master].parents[0]
    const d = { ...s, head: { kind: 'detached' as const, id: base } }
    expect(lines(d, 'git log --oneline')).toEqual([`${base.slice(0, 7)} (HEAD) Базовая версия приложения`])
    expect(lines(d, 'git log --oneline --all')[0]).toMatch(/\(master\) Добавить README$/)
  })
})

describe('git log: ошибки и отказы области', () => {
  it(`неизвестное слово: fatal: ambiguous argument …, код 128 (${where('П8.31', 'git log nosuch')})`, () => {
    for (const command of ['git log nosuch', 'git log HEAD~9', 'git log master~5']) {
      const r = run(fresh(), command).result
      expect(r.output, command).toBe(protocolEntry('П8.31', command).output)
      expect(r.exitCode).toBe(128)
    }
  })

  it(`файл рабочего каталога git принял бы за путь: отказ области (${where('П8.31', 'git log app.js')})`, () => {
    const r = run(fresh(), 'git log app.js').result
    refusal(r.output)
    expect(r.exitCode).toBeUndefined()
    expect(protocolEntry('П8.31', 'git log app.js').exitCode).toBe(0)
  })

  it(`две ссылки (${where('П8.31', 'git log feature master')}), --all со ссылкой, другие ключи, 0 и выражения — отказ области`, () => {
    for (const form of ['git log feature master', 'git log --all feature', 'git log --graph', 'git log -p', 'git log --stat', 'git log -n 1', 'git log --max-count=1', 'git log -0', 'git log --no-decorate', 'git log --decorate=full', 'git log -- app.js', 'git log HEAD@{1}', 'git log master..feature']) {
      const r = run(fresh(), form).result
      expect(r.exitCode, form).toBeUndefined()
      refusal(r.output)
    }
  })

  it('log ничего не меняет, кроме истории терминала', () => {
    const s = fresh()
    expect({ ...run(s, 'git log --all').state, history: [] }).toEqual(s)
  })
})
