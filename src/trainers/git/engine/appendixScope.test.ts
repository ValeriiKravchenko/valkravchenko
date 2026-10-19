import { describe, expect, it } from 'vitest'
import { HANDLED_COMMANDS, isHandledCommand, isRealGitCommand } from './appendixScope'

describe('область раздела 8, шаги A и B', () => {
  it('команды, которые раздел выполняет', () => {
    expect([...HANDLED_COMMANDS]).toEqual(['status', 'add', 'commit', 'branch', 'checkout', 'switch', 'diff', 'show', 'log', 'tag', 'stash', 'reflog', 'reset', 'cherry-pick', 'rebase'])
    for (const name of HANDLED_COMMANDS) expect(isHandledCommand(name), name).toBe(true)
  })

  it('merge и конфликты в список выполняемых не входят, а reset, cherry-pick и rebase входят', () => {
    for (const name of ['restore', 'merge', 'bisect', 'push', 'init']) expect(isHandledCommand(name), name).toBe(false)
    for (const name of ['reset', 'cherry-pick', 'rebase']) expect(isHandledCommand(name), name).toBe(true)
  })

  it('настоящие команды git: выполняемые, из общего списка и собственный набор (git help -a, 2.53.0)', () => {
    for (const name of ['status', 'stash', 'cherry-pick', 'rebase', 'reflog', 'show-ref', 'for-each-ref', 'verify-tag', 'mktag', 'rev-list', 'ls-files', 'check-ignore', 'merge-base', 'name-rev', 'symbolic-ref', 'update-ref', 'ls-tree', 'ls-remote']) {
      expect(isRealGitCommand(name), name).toBe(true)
    }
  })

  it('выдуманные команды настоящими не считаются', () => {
    for (const name of ['nosuch', 'statuss', 'tags', '']) expect(isRealGitCommand(name), name).toBe(false)
  })
})
