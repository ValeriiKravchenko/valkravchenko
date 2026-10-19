// ============================================================
// Раздел 8 git-тренажёра, шаги A и B: какие команды раздел выполняет и какие настоящие команды git
// знает. Список настоящих команд — данные про git, а не про раздел 1 (см. branchScope.ts).
// Формы внутри выполняемых команд, которые раздел не разбирает, получают отказ области в
// обработчиках (appendix*.ts) с меткой тренажёра (часть III, правило 1).
// ============================================================
import { REAL_GIT_COMMANDS } from './branchScope'

/** Команды, которые раздел выполняет. */
export const HANDLED_COMMANDS = ['status', 'add', 'commit', 'branch', 'checkout', 'switch', 'diff', 'show', 'log', 'tag', 'stash', 'reflog', 'reset', 'cherry-pick', 'rebase'] as const
export type HandledCommand = (typeof HANDLED_COMMANDS)[number]

export function isHandledCommand(name: string): name is HandledCommand {
  return (HANDLED_COMMANDS as readonly string[]).includes(name)
}

/**
 * Настоящие команды git вне `REAL_GIT_COMMANDS` раздела 1, которые встречаются рядом с тегами и
 * историей (все есть в `git help -a` версии 2.53.0, сверено 17.10.2026).
 */
const EXTRA_REAL_COMMANDS: ReadonlySet<string> = new Set([
  'check-ignore',
  'for-each-ref',
  'ls-files',
  'ls-remote',
  'ls-tree',
  'merge-base',
  'mktag',
  'name-rev',
  'rev-list',
  'show-ref',
  'symbolic-ref',
  'update-ref',
  'verify-tag',
])

/** Настоящая команда git (в том числе та, которую раздел 8 не разбирает). */
export function isRealGitCommand(name: string): boolean {
  return REAL_GIT_COMMANDS.has(name) || EXTRA_REAL_COMMANDS.has(name)
}
