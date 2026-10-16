// ============================================================
// Раздел 7 git-тренажёра: какие команды раздел выполняет и какие настоящие команды git знает.
// Список настоящих команд — данные про git, а не про раздел 1 (см. branchScope.ts).
// ============================================================
import { REAL_GIT_COMMANDS } from './branchScope'

/** Команды, которые раздел 7 выполняет. */
export const HANDLED_COMMANDS = ['status', 'check-ignore', 'add', 'config', 'help', 'log', 'commit'] as const
export type HandledCommand = (typeof HANDLED_COMMANDS)[number]

export function isHandledCommand(name: string): name is HandledCommand {
  return (HANDLED_COMMANDS as readonly string[]).includes(name)
}

/** Настоящие команды git вне `REAL_GIT_COMMANDS` раздела 1, которые встречаются в разделе 7 (`check-ignore` из прогонов П7.23). */
const EXTRA_REAL_COMMANDS: ReadonlySet<string> = new Set(['check-ignore'])

/** Настоящая команда git: у неё приоритет над одноимённым алиасом (П7.25: `alias.status log`, `git status --short` печатает статус). */
export function isRealGitCommand(name: string): boolean {
  return REAL_GIT_COMMANDS.has(name) || EXTRA_REAL_COMMANDS.has(name)
}
