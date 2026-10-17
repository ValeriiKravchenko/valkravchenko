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
  })

  it('сброс после игры возвращает чистое состояние, не связанное со старым', () => {
    const played = runAppendixCommand(createAppendixSection(), 'git tag v1').state
    expect(played.tags).not.toEqual({})
    expect(resetAppendixSection().tags).toEqual({})
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
    const scope = runAppendixCommand(s, 'git rebase master').result
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

describe('миссии', () => {
  it('две миссии шага A, засчитываются по событию', () => {
    expect(APPENDIX_MISSION_IDS).toEqual(['lightTag', 'annotatedShow'])
    let s = createAppendixSection()
    expect(getAppendixMissions(s).map((m) => m.done)).toEqual([false, false])
    s = runAppendixCommand(s, 'git tag v1').state
    s = runAppendixCommand(s, 'git tag -a v2 -m "Релиз"').state
    s = runAppendixCommand(s, 'git show v2').state
    expect(getAppendixMissions(s).map((m) => m.done)).toEqual([true, true])
  })
})
