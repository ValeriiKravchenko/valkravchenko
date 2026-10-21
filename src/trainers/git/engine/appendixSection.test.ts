// Публичная точка входа раздела 8 (шаг A): то, что берёт экран.
import { describe, expect, it } from 'vitest'
import {
  APPENDIX_MISSION_IDS,
  createAppendixFile,
  createAppendixSection,
  deleteAppendixFile,
  editAppendixFile,
  getAppendixMissions,
  getBranches,
  getCommits,
  getFileContent,
  getTags,
  getWorkingFiles,
  resetAppendixSection,
  runAppendixCommand,
} from './appendixSection'
import { ru } from '../locales/ru'

describe('создание и сброс', () => {
  it('createAppendixSection и resetAppendixSection дают одно и то же исходное состояние', () => {
    expect(resetAppendixSection()).toEqual(createAppendixSection())
    expect(resetAppendixSection()).toMatchObject({ unmerged: {}, operation: null })
  })

  it('сброс после игры возвращает чистое состояние, не связанное со старым', () => {
    const played = runAppendixCommand(createAppendixSection(), 'git tag v1').state
    expect(played.tags).not.toEqual({})
    expect(resetAppendixSection().tags).toEqual({})
  })

  it('сброс раздела посреди конфликта снимает неслитые пути и операцию', () => {
    let played = editAppendixFile(createAppendixSection(), 'app.js')
    played = runAppendixCommand(runAppendixCommand(played, 'git commit -am "master: v2"').state, 'git cherry-pick feature~1').state
    expect(Object.keys(played.unmerged)).toEqual(['app.js'])
    expect(played.operation).not.toBeNull()
    const again = resetAppendixSection()
    expect(again.unmerged).toEqual({})
    expect(again.operation).toBeNull()
  })
})

describe('runAppendixCommand', () => {
  it('пустая строка: result null, состояние то же', () => {
    const s = createAppendixSection()
    const r = runAppendixCommand(s, '  ')
    expect(r.result).toBeNull()
    expect(r.state).toBe(s)
  })

  it('команда: новое состояние и результат; отказ git — exitCode, отказ области — без exitCode', () => {
    const s = createAppendixSection()
    expect(runAppendixCommand(s, 'git tag v1').result).toMatchObject({ ok: true, exitCode: 0 })
    expect(runAppendixCommand(s, 'git tag "a b"').result).toMatchObject({ ok: false, exitCode: 128 })
    const scope = runAppendixCommand(s, 'git rebase -i master').result
    expect(scope?.ok).toBe(false)
    expect(scope?.exitCode).toBeUndefined()
  })
})

describe('файлы', () => {
  it('список и содержимое: README.md и app.js в порядке байтов, содержимое кончается переводом строки', () => {
    const s = createAppendixSection()
    expect(getWorkingFiles(s)).toEqual(['README.md', 'app.js'])
    expect(getFileContent(s, 'app.js')).toBe('console.log("v1");\n')
    expect(getFileContent(s, 'nosuch')).toBeNull()
  })

  it('✎, 🗑 и «создать файл» меняют рабочий каталог и сразу видны', () => {
    let s = createAppendixSection()
    s = editAppendixFile(s, 'app.js')
    expect(getFileContent(s, 'app.js')).toBe(`console.log("v1");${ru.fileOps.editedSuffix}\n`)
    s = createAppendixFile(s, 'x.txt')
    expect(getWorkingFiles(s)).toEqual(['README.md', 'app.js', 'x.txt'])
    s = deleteAppendixFile(s, 'README.md')
    expect(getWorkingFiles(s)).toEqual(['app.js', 'x.txt'])
    expect(runAppendixCommand(s, 'git status -s').result?.output).toBe(' D README.md\n M app.js\n?? x.txt')
  })
})

describe('ветки, коммиты и теги для списка', () => {
  it('ветки: порядок байтов, текущая отмечена, id 40 знаков и показ 7', () => {
    const s = createAppendixSection()
    const branches = getBranches(s)
    expect(branches.map((b) => [b.name, b.current])).toEqual([['feature', false], ['master', true]])
    for (const b of branches) {
      expect(b.id).toMatch(/^[0-9a-f]{40}$/)
      expect(b.shortId).toBe(b.id.slice(0, 7))
    }
    const moved = runAppendixCommand(s, 'git checkout feature').state
    expect(getBranches(moved).map((b) => b.current)).toEqual([true, false])
  })

  it('коммиты: четыре, новые сверху; у каждого родители и подписи в порядке git', () => {
    const s = runAppendixCommand(runAppendixCommand(createAppendixSection(), 'git tag v1').state, 'git tag -a v2 -m "Релиз" feature').state
    const commits = getCommits(s)
    expect(commits.map((c) => c.subject)).toEqual(['Добавить README', 'Добавить страницу «О проекте»', 'fix: опечатка в логе', 'Базовая версия приложения'])
    expect(commits[0].decorations).toEqual(['HEAD -> master', 'tag: v1'])
    expect(commits[1].decorations).toEqual(['tag: v2', 'feature'])
    expect(commits[2].decorations).toEqual([])
    expect(commits[3].parents).toEqual([])
    expect(commits[0].parents).toEqual([commits[3].id])
    expect(commits[0].shortId).toBe(commits[0].id.slice(0, 7))
  })

  it('новый коммит появляется в списке сверху с подписью HEAD -> ветка', () => {
    let s = createAppendixSection()
    s = editAppendixFile(s, 'app.js')
    s = runAppendixCommand(s, 'git commit -am "Правка"').state
    const commits = getCommits(s)
    expect(commits).toHaveLength(5)
    expect(commits[0]).toMatchObject({ subject: 'Правка', decorations: ['HEAD -> master'] })
    expect(commits[1].decorations).toEqual([])
  })

  it('теги: порядок байтов; лёгкий без сообщения, аннотированный с сообщением', () => {
    let s = createAppendixSection()
    s = runAppendixCommand(s, 'git tag v2').state
    s = runAppendixCommand(s, 'git tag -a v1 -m "Релиз" HEAD~1').state
    const tags = getTags(s)
    expect(tags.map((t) => t.name)).toEqual(['v1', 'v2'])
    expect(tags[0]).toMatchObject({ kind: 'annotated', message: 'Релиз' })
    expect(tags[1]).toMatchObject({ kind: 'light', message: null })
    expect(tags[0].shortCommit).toBe(tags[0].commit.slice(0, 7))
    expect(tags[0].commit).not.toBe(tags[1].commit)
  })
})

const play = (state: ReturnType<typeof createAppendixSection>, lines: readonly string[]) =>
  lines.reduce((acc, line) => (line.startsWith('edit ') ? editAppendixFile(acc, line.slice(5)) : (runAppendixCommand(acc, line).state)), state)

describe('отсоединённый HEAD в публичном API (шаг B)', () => {
  const abandoned = () => play(createAppendixSection(), ['git checkout --detach master', 'edit app.js', 'git commit -am "Опыт 1"', 'edit app.js', 'git commit -am "Опыт 2"'])

  it('getBranches: на ветке текущая одна, в отсоединённом HEAD ни одна', () => {
    expect(getBranches(createAppendixSection()).map((b) => b.current)).toEqual([false, true])
    const detached = play(createAppendixSection(), ['git checkout --detach master'])
    expect(getBranches(detached).map((b) => b.current)).toEqual([false, false])
    expect(getBranches(detached).map((b) => b.name)).toEqual(['feature', 'master'])
  })

  it('getCommits: подпись HEAD без стрелки, ветка на том же коммите в подписи есть; коммиты не бледные (О2)', () => {
    const detached = play(createAppendixSection(), ['git checkout --detach master'])
    const top = getCommits(detached)[0]
    expect(top.decorations).toEqual(['HEAD', 'master'])
    expect(getCommits(detached).every((c) => !c.faded)).toBe(true)
  })

  it('коммиты в отсоединённом HEAD держит HEAD: они на графе, но не бледные; с ухода HEAD бледнеют, граф их по-прежнему показывает', () => {
    const detached = abandoned()
    const commits = getCommits(detached)
    expect(commits).toHaveLength(6)
    expect(commits.slice(0, 2).map((c) => [c.subject, c.faded, c.decorations])).toEqual([['Опыт 2', false, ['HEAD']], ['Опыт 1', false, []]])
    const left = play(detached, ['git checkout master'])
    const after = getCommits(left)
    expect(after).toHaveLength(6)
    expect(after.slice(0, 2).map((c) => [c.subject, c.faded])).toEqual([['Опыт 2', true], ['Опыт 1', true]])
    expect(after.slice(2).every((c) => !c.faded)).toBe(true)
    expect(after[0].decorations).toEqual([])
  })

  it('брошенный коммит снова обычный, когда на него укажет ветка или тег (часть XII, «Как вернуть брошенные коммиты»)', () => {
    const left = play(abandoned(), ['git checkout master'])
    const tip = getCommits(left)[0]
    expect(tip.faded).toBe(true)
    const byBranch = play(left, [`git branch rescue ${tip.shortId}`])
    expect(getCommits(byBranch).map((c) => c.faded)).toEqual([false, false, false, false, false, false])
    expect(getCommits(byBranch)[0].decorations).toEqual(['rescue'])
    const byTag = play(left, [`git tag keep ${tip.shortId}`])
    expect(getCommits(byTag).every((c) => !c.faded)).toBe(true)
    const byLog = play(left, ['git branch rescue HEAD@{1}'])
    expect(getCommits(byLog).every((c) => !c.faded)).toBe(true)
  })

  it('удаление ветки бросает её коммиты, если их больше ничто не держит; порядок графа — по логическому моменту', () => {
    const s = play(createAppendixSection(), ['git branch -D feature'])
    const commits = getCommits(s)
    expect(commits.map((c) => [c.subject, c.faded])).toEqual([
      ['Добавить README', false],
      ['Добавить страницу «О проекте»', true],
      ['fix: опечатка в логе', true],
      ['Базовая версия приложения', false],
    ])
  })

  it('git log --all не показывает брошенные коммиты, а граф показывает бледными (О3)', () => {
    const left = play(abandoned(), ['git checkout master'])
    expect(runAppendixCommand(left, 'git log --oneline --all').result?.output).not.toContain('Опыт')
    expect(getCommits(left).filter((c) => c.faded)).toHaveLength(2)
  })

  it('команды шага B в публичном API: reflog, switch, reset, cherry-pick и rebase выполняются, merge — отказ области', () => {
    const s = createAppendixSection()
    expect(runAppendixCommand(s, 'git reflog').result?.exitCode).toBe(0)
    expect(runAppendixCommand(s, 'git switch feature').result?.exitCode).toBe(0)
    expect(runAppendixCommand(s, 'git reset --hard HEAD~1').result?.exitCode).toBe(0)
    expect(runAppendixCommand(s, 'git cherry-pick feature').result?.exitCode).toBe(0)
    expect(runAppendixCommand(s, 'git rebase feature~1').result?.exitCode).toBe(0)
    for (const command of ['git merge feature']) {
      const r = runAppendixCommand(s, command).result
      expect(r?.exitCode, command).toBeUndefined()
      expect(r?.output.startsWith('[тренажёр]'), command).toBe(true)
    }
  })
})

describe('миссии', () => {
  it('семь миссий (шаг A и шаг B), засчитываются по событию', () => {
    expect(APPENDIX_MISSION_IDS).toEqual(['lightTag', 'annotatedShow', 'stashSave', 'stashRestore', 'cherryPick', 'rescueCommit', 'rebase'])
    let s = createAppendixSection()
    expect(getAppendixMissions(s).map((m) => m.done)).toEqual([false, false, false, false, false, false, false])
    s = runAppendixCommand(s, 'git tag v1').state
    s = runAppendixCommand(s, 'git tag -a v2 -m "Релиз"').state
    s = runAppendixCommand(s, 'git show v2').state
    expect(getAppendixMissions(s).map((m) => m.done)).toEqual([true, true, false, false, false, false, false])
    s = runAppendixCommand(s, 'git cherry-pick feature~1').state
    s = runAppendixCommand(s, 'git reset --hard HEAD~1').state
    s = runAppendixCommand(s, 'git reset --hard HEAD@{1}').state
    expect(getAppendixMissions(s).map((m) => m.done)).toEqual([true, true, false, false, true, true, false])
    s = runAppendixCommand(s, 'git switch feature').state
    s = runAppendixCommand(s, 'git rebase master').state
    expect(getAppendixMissions(s).map((m) => m.done)).toEqual([true, true, false, false, true, true, true])
  })
})
