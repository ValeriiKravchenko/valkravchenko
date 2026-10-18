// git show коммита и тега (target.md, часть X, места 1 и 5). Вывод — дословно из section8-git-runs.txt
// (П8.2) и appendix-g18e-git-runs.txt (П8.23, П8.25, П8.31): без Author, Date и Tagger.
import { describe, expect, it } from 'vitest'
import { currentCommitId } from './appendixRepo'
import { fresh, normalizeGitOutput, protocolEntry, run, runAll, where } from './appendixProtocolKit'
import { ru } from '../locales/ru'

const ax = ru.appendix.explain
const refusal = (output: string) => expect(output.startsWith('[тренажёр]')).toBe(true)
const normalize = (s: string) => s.replace(/index [0-9a-f]{7}\.\.[0-9a-f]{7}/g, 'index <blob>..<blob>')

describe('git show коммита', () => {
  it(`git show: commit <id> (подписи), пустая строка, сообщение, пустая строка, diff (${where('П8.31', 'git show')})`, () => {
    const s = fresh()
    const r = run(s, 'git show').result
    const id = currentCommitId(s)
    expect(normalize(r.output)).toBe(
      [
        `commit ${id} (HEAD -> master)`,
        '',
        '    Добавить README',
        '',
        'diff --git a/README.md b/README.md',
        'new file mode 100644',
        'index <blob>..<blob>',
        '--- /dev/null',
        '+++ b/README.md',
        '@@ -0,0 +1 @@',
        '+# Мини-сайт',
      ].join('\n'),
    )
    expect(r.exitCode).toBe(0)
    expect(r.explanation).toBe(ax.authorDateNotShown)
    expect(normalize(normalizeGitOutput('git show', protocolEntry('П8.31', 'git show').output)).split('\n').slice(1)).toEqual(normalize(r.output).split('\n').slice(1))
  })

  it(`git show <ветка> и git show HEAD~1: корневой коммит — всё содержимое как новое (${where('П8.31', 'git show feature')}, ${where('П8.31', 'git show HEAD~1')})`, () => {
    const s = fresh()
    const feature = run(s, 'git show feature').result.output.split('\n')
    expect(feature[0]).toMatch(/^commit [0-9a-f]{40} \(feature\)$/)
    expect(feature).toContain('+++ b/about.html')
    const root = run(s, 'git show HEAD~1').result.output.split('\n')
    expect(root[0]).toMatch(/^commit [0-9a-f]{40}$/)
    expect(root).toContain('new file mode 100644')
    expect(root).toContain('+console.log("v1");')
  })

  it(`изменённый файл: хунк с одной строкой «-» и одной «+» (${where('П8.31', 'git show feature~1')})`, () => {
    const out = run(fresh(), 'git show feature~1').result.output.split('\n')
    expect(out.slice(-3)).toEqual(['@@ -1 +1 @@', '-console.log("v1");', '+console.log("v1"); // исправлена опечатка в логе'])
  })

  it(`удалённый файл: deleted file mode (${where('П8.23', 'git show')})`, () => {
    const s = runAll(fresh(), ['git checkout feature'])
    const state = { ...s, working: { 'app.js': s.working['app.js'] } }
    const after = runAll(state, ['git add about.html', 'git commit -m "Удалить страницу"'])
    const out = run(after, 'git show').result.output
    expect(out).toContain('deleted file mode 100644')
    expect(out).toContain('-<h1>О проекте</h1>')
    expect(out.split('\n')[0]).toMatch(/\(HEAD -> feature\)$/)
  })

  it('начало id коммита; неизвестный id — ambiguous argument (П8.31: git show 1234567)', () => {
    const s = fresh()
    const base = s.commits[s.branches.master].parents[0]
    expect(run(s, `git show ${base.slice(0, 7)}`).result.output.split('\n')[0]).toBe(`commit ${base}`)
    const r = run(s, 'git show 1234567').result
    expect(r.output).toBe(protocolEntry('П8.31', 'git show 1234567').output)
    expect(r.exitCode).toBe(128)
  })

  it(`неизвестное имя и ссылка за корнем: ambiguous argument, код 128 (${where('П8.31', 'git show nosuch')})`, () => {
    for (const command of ['git show nosuch', 'git show master~5']) {
      const r = run(fresh(), command).result
      expect(r.output).toBe(protocolEntry('П8.31', command).output)
      expect(r.exitCode).toBe(128)
    }
  })

  it('файл рабочего каталога, ключи (--stat, -s, --no-patch), несколько слов, выражения — отказ области', () => {
    for (const form of ['git show app.js', 'git show --stat', 'git show -s', 'git show --no-patch', 'git show feature master', 'git show HEAD@{1}~1', 'git show -- app.js']) {
      const r = run(fresh(), form).result
      expect(r.exitCode, form).toBeUndefined()
      refusal(r.output)
    }
  })

  it('коммит, который удаляет один файл и добавляет другой, — отказ области про переименование (П8.25)', () => {
    const s = runAll(fresh(), [])
    const state = { ...s, working: { 'app.js': s.working['app.js'], 'y.txt': 'новый файл\n' } }
    const after = runAll(state, ['git add .', 'git commit -m "Заменить"'])
    const r = run(after, 'git show').result
    refusal(r.output)
    expect(r.output).toContain('renamed')
    expect(r.exitCode).toBeUndefined()
    expect(protocolEntry('П8.25', 'git show').output).toContain('rename from x.txt')
  })
})

describe('git show тега', () => {
  const s = runAll(fresh(), ['git tag v1', 'git tag -a v2 -m "Релиз"'])

  it(`аннотированный тег: tag <имя>, пустая строка, сообщение, пустая строка, commit с подписями (${where('П8.2', 'git show v1.1.0')})`, () => {
    const r = run(s, 'git show v2').result
    const out = r.output.split('\n')
    expect(out.slice(0, 4)).toEqual(['tag v2', '', 'Релиз', ''])
    expect(out[4]).toBe(`commit ${currentCommitId(s)} (HEAD -> master, tag: v2, tag: v1)`)
    expect(out.slice(5, 8)).toEqual(['', '    Добавить README', ''])
    expect(r.exitCode).toBe(0)
    expect(r.explanation).toBe(ax.showAnnotated)
    expect(r.output).not.toContain('Tagger')
    expect(r.output).not.toContain('Date:')
  })

  it(`лёгкий тег: вывод начинается с commit, без tag (${where('П8.2', 'git show v1.0.0')})`, () => {
    const r = run(s, 'git show v1').result
    expect(r.output.startsWith(`commit ${currentCommitId(s)} (HEAD -> master, tag: v2, tag: v1)`)).toBe(true)
    expect(r.explanation).toBe(ax.authorDateNotShown)
  })

  it('миссия 2: засчитывает git show аннотированного тега, но не лёгкого, не коммита и не тега с цепочкой', () => {
    expect(run(s, 'git show v2').state.missionsDone.annotatedShow).toBe(true)
    for (const form of ['git show v1', 'git show', 'git show HEAD', 'git show v2~0', 'git show v2~1', 'git show master']) expect(run(s, form).state.missionsDone.annotatedShow, form).toBe(false)
    expect(run(s, 'git show nosuch').state.missionsDone.annotatedShow).toBe(false)
  })

  it('show ничего не меняет в тегах и коммитах', () => {
    const r = run(s, 'git show v2')
    expect(r.state.tags).toEqual(s.tags)
    expect(r.state.commits).toEqual(s.commits)
  })

  it('аннотированный тег на другом коммите: tag, сообщение, коммит feature с подписью (tag: v3, feature)', () => {
    const t = runAll(fresh(), ['git tag -a v3 -m "На feature" feature'])
    const out = run(t, 'git show v3').result.output.split('\n')
    expect(out[0]).toBe('tag v3')
    expect(out[4]).toMatch(/^commit [0-9a-f]{40} \(tag: v3, feature\)$/)
  })
})
