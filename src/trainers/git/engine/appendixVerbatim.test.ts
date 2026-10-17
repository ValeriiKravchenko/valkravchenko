// Дословный вывод из блоков П8.1, П8.2, П8.13, П8.15, П8.16 протокола section8-git-runs.txt: тот же
// набор команд на движке раздела 8 даёт тот же вывод и те же коды возврата (id тренажёра свои,
// см. appendixProtocolKit.ts).
import { describe, expect, it } from 'vitest'
import { compareOutputs, normalizeGitOutput, protocolBlock, protocolEntry, replayBlock, run, runAll, translateCommand, type IdMap } from './appendixProtocolKit'
import { createAppendixSection, getBranches, getCommits } from './appendixSection'
import type { AppendixState } from './appendixSection'

/** Сверяет одну команду протокола с ответом движка на том же состоянии. */
function expectSame(state: AppendixState, block: string, command: string, ids: IdMap, nth = 0, asCommand = command): AppendixState {
  const entry = protocolEntry(block, command, nth)
  const next = run(state, asCommand)
  expect(next.result.exitCode, `${entry.file}:${entry.line} код возврата`).toBe(entry.exitCode)
  expect(compareOutputs(normalizeGitOutput(command, entry.output), normalizeGitOutput(command, next.result.output), ids), `${entry.file}:${entry.line} ${command}`).toBeNull()
  return next.state
}

describe('П8.1: исходное состояние', () => {
  const ids: IdMap = new Map()
  const start = createAppendixSection()

  it('git log --oneline (section8-git-runs.txt:14–16): README и базовый коммит, подпись только у верхушки', () => {
    expectSame(start, 'П8.1', 'git log --oneline', ids)
  })

  it('git log --oneline --all (:19–23): README, «О проекте», fix, базовый; подписи master и feature', () => {
    expectSame(start, 'П8.1', 'git log --oneline --all', ids)
  })

  it('git log --oneline feature (:34–37)', () => {
    expectSame(start, 'П8.1', 'git log --oneline feature', ids)
  })

  it('git status (:40–42): чисто', () => {
    expectSame(start, 'П8.1', 'git status', ids)
  })

  it('git log (:45–56): полный вид без строк Author и Date', () => {
    expectSame(start, 'П8.1', 'git log', ids)
  })

  it('журнал HEAD совпадает с git reflog (:59–65): те же записи в том же порядке', () => {
    const lines = protocolEntry('П8.1', 'git reflog').output.split('\n')
    const expected = lines.map((l) => l.slice(l.indexOf('}: ') + 3))
    expect(start.reflog.map((e) => e.message)).toEqual(expected)
    // id7 каждой записи совпадают с коммитами, на которых стоял HEAD: README, базовый, «О проекте», fix, базовый, базовый.
    const subjects = start.reflog.map((e) => start.commits[e.id].message)
    expect(subjects).toEqual(['Добавить README', 'Базовая версия приложения', 'Добавить страницу «О проекте»', 'fix: опечатка в логе', 'Базовая версия приложения', 'Базовая версия приложения'])
    expect(lines[0]).toContain('(HEAD -> master)')
  })

  it('id: 40 знаков, показ 7; коммиты создаются в порядке базовый, fix, «О проекте», README', () => {
    const all = Object.values(start.commits)
    for (const c of all) expect(c.id).toMatch(/^[0-9a-f]{40}$/)
    expect(all.map((c) => c.clock)).toEqual([0, 1, 2, 3])
    expect(all.map((c) => c.message)).toEqual(['Базовая версия приложения', 'fix: опечатка в логе', 'Добавить страницу «О проекте»', 'Добавить README'])
    expect(getCommits(start).map((c) => c.shortId)).toEqual(all.slice().reverse().map((c) => c.id.slice(0, 7)))
  })
})

describe('П8.2: теги и подписи', () => {
  // Все команды блока до перехода на тег; `git cat-file`, редактор и `git tag -n` вне области раздела.
  const stopAt = protocolBlock('П8.2').findIndex((e) => e.command === 'git checkout v1.1.0')
  const replay = replayBlock('П8.2', {
    until: stopAt,
    skip: (e) => e.command.startsWith('GIT_EDITOR=') || e.command.startsWith('git cat-file'),
    refused: (e) => e.command === 'git tag -n' || e.command === 'git show v1.1.0 --stat',
  })

  it('блок проигрывается до git checkout v1.1.0: вывод и коды возврата совпадают с git', () => {
    expect(stopAt).toBeGreaterThan(30)
    const problems = replay.steps.filter((s) => s.mismatch !== null).map((s) => `:${s.entry.line} ${s.entry.command} — ${s.mismatch}`)
    expect(problems).toEqual([])
  })

  it('в проигранном блоке есть создание, список, show, -f, -d, ошибки и подписи', () => {
    const commands = replay.steps.map((s) => s.entry.command)
    for (const expected of ['git tag v1.0.0', 'git tag -a v1.1.0 -m "Релиз"', 'git show v1.1.0', 'git tag -f v1.0.0 HEAD~1', 'git tag -d nosuch v1.4.0', 'git tag -z', 'git log --oneline --all']) {
      expect(commands).toContain(expected)
    }
  })

  it('git tag -n и git show --stat получили отказ области, а не вывод git (:135, :197)', () => {
    const refused = replay.steps.filter((s) => s.entry.command === 'git tag -n' || s.entry.command === 'git show v1.1.0 --stat')
    expect(refused).toHaveLength(2)
    for (const s of refused) expect(s.result?.output.startsWith('[тренажёр]')).toBe(true)
  })

  it('git show v1.1.0 (:157–178): у аннотированного тега перед коммитом tag, пустая строка и сообщение', () => {
    const shown = replay.steps.find((s) => s.entry.command === 'git show v1.1.0')
    expect(shown?.result?.output.split('\n').slice(0, 5)).toEqual(['tag v1.1.0', '', 'Релиз', '', expect.stringMatching(/^commit [0-9a-f]{40} \(HEAD -> master, tag: v1\.4\.0, tag: v1\.3\.0, tag: v1\.2\.0-rc, tag: v1\.1\.0, tag: v1\.0\.0\)$/)])
  })

  it('git show v1.0.0 (:180–195): у лёгкого тега вывод начинается с commit', () => {
    const shown = replay.steps.find((s) => s.entry.command === 'git show v1.0.0')
    expect(shown?.result?.output.startsWith('commit ')).toBe(true)
  })

  it('порядок подписей: теги в обратном порядке байтов (:164, :215, :408, :487)', () => {
    let state = createAppendixSection()
    state = runAll(state, ['git tag v1.0.0 HEAD~1', 'git tag v1.1.0 HEAD~1', 'git tag v-detached HEAD~1', 'git tag v2 feature'])
    const base = getCommits(state).find((c) => c.subject === 'Базовая версия приложения')
    expect(base?.decorations).toEqual(['tag: v1.1.0', 'tag: v1.0.0', 'tag: v-detached'])
    const about = getCommits(state).find((c) => c.subject === 'Добавить страницу «О проекте»')
    expect(about?.decorations).toEqual(['tag: v2', 'feature'])
    expect(entryLineStarts('П8.2', '4523efd (tag: v1.1.0, tag: v1.0.0) Базовая версия приложения')).toBe(true)
    expect(entryLineStarts('П8.2', '4523efd (tag: v1.1.0, tag: v1.0.0, tag: v-detached) Базовая версия приложения')).toBe(true)
    expect(entryLineStarts('П8.2', '13d43ea (tag: v2, feature) Добавить страницу «О проекте»')).toBe(true)
  })
})

/** Строка вывода встречается в блоке протокола дословно. */
function entryLineStarts(block: string, line: string): boolean {
  return protocolBlock(block).some((e) => e.output.split('\n').includes(line))
}

describe('П8.13: подписи в терминале', () => {
  it('git -c log.decorate=short log --oneline (:1518–1521): подпись HEAD и тега на верхушке', () => {
    const ids: IdMap = new Map()
    const state = run(createAppendixSection(), 'git tag v1.0.0').state
    // Исходная история раздела 8 длиннее, чем в П8.13: сверяется первая строка.
    const entry = protocolEntry('П8.13', 'git -c log.decorate=short log --oneline')
    const out = run(state, 'git log --oneline').result.output.split('\n')
    expect(out[0].replace(/^[0-9a-f]{7}/, '<id7>')).toBe(entry.output.split('\n')[0].replace(/^[0-9a-f]{7}/, '<id7>'))
    expect(ids.size).toBe(0)
  })
})

describe('П8.15 и П8.16: подписи веток и записи журнала HEAD', () => {
  it('checkout -b hotfix: запись «checkout: moving from master to hotfix», подпись (HEAD -> hotfix, master) (:1636–1641)', () => {
    const state = runAll(createAppendixSection(), ['git checkout -b hotfix'])
    const line = protocolEntry('П8.15', 'git reflog -1', 3).output
    expect(state.reflog[0].message).toBe(line.slice(line.indexOf('}: ') + 3))
    expect(line).toContain('(HEAD -> hotfix, master)')
    const top = getCommits(state)[0]
    expect(top.decorations).toEqual(['HEAD -> hotfix', 'master'])
  })

  it('git branch не пишет в журнал HEAD; при переходе на master подпись (HEAD -> master, hotfix) (:1648–1656)', () => {
    let state = runAll(createAppendixSection(), ['git checkout -b hotfix', 'git checkout master'])
    const before = state.reflog.length
    state = run(state, 'git branch topic master~1').state
    expect(state.reflog).toHaveLength(before)
    expect(getCommits(state)[0].decorations).toEqual(['HEAD -> master', 'hotfix'])
    expect(entryLineStarts('П8.15', 'd1cb1bd (HEAD -> master, hotfix) HEAD@{0}: checkout: moving from hotfix to master')).toBe(true)
  })

  it('тег стоит перед веткой: (tag: v1.0.0, topic); на topic — (HEAD -> topic, tag: v1.0.0) (:1660, :1668)', () => {
    let state = runAll(createAppendixSection(), ['git tag v1.0.0 HEAD~1', 'git branch topic master~1'])
    const base = getCommits(state).find((c) => c.subject === 'Базовая версия приложения')
    expect(base?.decorations).toEqual(['tag: v1.0.0', 'topic'])
    state = run(state, 'git checkout topic').state
    expect(state.reflog[0].message).toBe('checkout: moving from master to topic')
    expect(getCommits(state).find((c) => c.subject === 'Базовая версия приложения')?.decorations).toEqual(['HEAD -> topic', 'tag: v1.0.0'])
  })

  it('ветки, кроме текущей, в обратном порядке байтов: (HEAD -> topic, master, hotfix) (П8.16, section8-git-runs.txt:1687 и далее)', () => {
    const state = runAll(createAppendixSection(), ['git branch hotfix', 'git checkout -b topic'])
    expect(getCommits(state)[0].decorations).toEqual(['HEAD -> topic', 'master', 'hotfix'])
    expect(entryLineStarts('П8.16', 'd1cb1bd (HEAD -> topic, master, hotfix) HEAD@{0}: rebase (finish): returning to refs/heads/topic')).toBe(true)
    expect(getBranches(state).map((b) => b.name)).toEqual(['feature', 'hotfix', 'master', 'topic'])
  })
})

describe('помощники протокола', () => {
  it('расхождение скелета обнаруживается', () => {
    expect(compareOutputs('a <x>', 'a <y>', new Map())).toContain('скелеты различаются')
  })

  it('один настоящий id не может получить два разных id тренажёра', () => {
    const map: IdMap = new Map()
    expect(compareOutputs('1234567 m', 'aaaaaaa m', map)).toBeNull()
    expect(compareOutputs('1234567 m', 'bbbbbbb m', map)).toContain('уже соответствовал')
  })

  it('два настоящих id не могут получить один id тренажёра', () => {
    const map: IdMap = new Map()
    expect(compareOutputs('1234567 m', 'aaaaaaa m', map)).toBeNull()
    expect(compareOutputs('7654321 m', 'aaaaaaa m', map)).toContain('уже соответствует')
  })

  it('нормализация убирает Author, Date, Tagger, диффстат коммита и маркер конца файла', () => {
    expect(normalizeGitOutput('git log', 'commit x\nAuthor: a\nDate:   d\n\n    m')).toBe('commit x\n\n    m')
    expect(normalizeGitOutput('git commit -m "m"', '[master 1234567] m\n 1 file changed')).toBe('[master 1234567] m')
    expect(normalizeGitOutput('git show', 'index abcdef0..1234567 100644\n\\ No newline at end of file')).toBe('index <blob>..<blob> 100644')
  })

  it('слово команды, похожее на id, заменяется id тренажёра', () => {
    const map: IdMap = new Map([['691d063', 'aaaaaaa']])
    expect(translateCommand('git show 691d063', map, ['aaaaaaa' + '0'.repeat(33)])).toBe('git show aaaaaaa')
    expect(translateCommand('git tag v9 691d', map, ['aaaaaaa' + '0'.repeat(33)])).toBe('git tag v9 aaaa')
    expect(translateCommand('git show 1234567', map, [])).toBe('git show 1234567')
  })
})
