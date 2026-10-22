// ============================================================
// Раздел 8 git-тренажёра («Приложение: пять важных тем»), шаги A и B: разбор командной
// строки и диспетчер. Две стороны, как в остальных разделах: шелл (shell.ts: слова, кавычки, голая `*`) и
// git (appendix*.ts). Строки `fatal: …`, `error: …`, `hint: …` — буквальный вывод git 2.53.0 из
// docs/git-trainer/reports/ (section8-git-runs.txt, appendix-g18e-git-runs.txt, appendix-g18e2-git-runs.txt,
// appendix-g18g-git-runs.txt, appendix-g18g2-git-runs.txt, detached-head-git-runs.txt), не переводятся и в
// словарь не идут. Всё, что говорит сам тренажёр, лежит в ru.appendix и начинается с метки
// [тренажёр] (target.md, часть III, правило 2).
//
// Шаг C (target.md, часть XI): посреди cherry-pick и конфликта тайника `git switch` и `git diff` при неслитых
// путях получают отказ области до выполнения; посреди rebase `git switch <ветка>` — отказ git `cannot switch branch while rebasing` (О10),
// остальные формы `switch` — отказ области. Остальные команды раздела сверяются с таблицей «Что запрещено» в своих обработчиках
// через `refusal` из conflicts.ts (appendixConflicts.ts).
//
// Граница области (часть III, правило 1). Воспроизводятся только формы, сверенные прогонами; любая
// другая получает честный отказ области без кода возврата и без выдуманного сообщения git. Ошибки
// игрока, которые git воспроизводит сам, возвращаются результатом с кодом возврата, не исключением.
// ============================================================
import type { AppendixState, CommandResult } from './appendixTypes'
import { exited, refuse, type Outcome } from './appendixOutcome'
import { handleAdd, handleBranch, handleCommit, handleDiff, handleStatus } from './appendixLocal'
import { handleCheckout, handleSwitch } from './appendixSwitch'
import { handleReflog } from './appendixReflog'
import { handleReset } from './appendixReset'
import { handleCherryPick } from './appendixCherryPick'
import { handleRebase } from './appendixRebase'
import { handleLog } from './appendixLog'
import { handleShow } from './appendixShow'
import { handleStash } from './appendixStash'
import { conflictForm, hasUnmerged, inConflict, refusalOutcome } from './appendixConflicts'
import { handleTag } from './appendixTags'
import { globMatches } from './appendixRefs'
import { isHandledCommand, isRealGitCommand, type HandledCommand } from './appendixScope'
import { has } from './util'
import { gitNotACommand, isGlobalGitOption } from './branchScope'
import { findShellRefusal, shellRefusalText, shellTokenize, type ShellToken } from './shell'
import { ru } from '../locales/ru'

const ae = ru.appendix.errors

function appendCommand(state: AppendixState, rawInput: string, result: CommandResult): AppendixState {
  return {
    ...state,
    history: [...state.history, { kind: 'command', input: rawInput, ok: result.ok, output: result.output, explanation: result.explanation }],
  }
}

/**
 * Слово с незакавыченными `*`, `?` или `[…]`. Bash раскрыл бы его именами файлов; если файлов не
 * находится, команда получает слово как есть (`git tag -l v1.1*`, П8.2). Раскрытие по маске этот
 * шелл не умеет, поэтому слово, под которое подошёл бы файл рабочего каталога, — отказ.
 */
function unexpandableGlob(tokens: readonly ShellToken[], files: readonly string[]): string | null {
  for (const token of tokens) {
    if (!token.unsupportedGlob) continue
    const matches = files.some((file) => globMatches(token.text, file, { hiddenLiteral: true }) !== false)
    if (matches) return token.text
  }
  return null
}

function runHandled(state: AppendixState, sub: HandledCommand, args: readonly string[]): Outcome {
  // Посреди cherry-pick и конфликта тайника `git switch` (в том числе `-c`) и `git diff` при неслитых путях (`diff --cc`) в разделе не разбираются.
  if (sub === 'switch' && args.length === 1 && has(state.branches, args[0])) {
    const whileRebasing = refusalOutcome(state, { name: 'switch-branch' })
    if (whileRebasing !== null) return exited(state, whileRebasing.result.output, 128, ru.conflicts.switchWhileRebasing)
  }
  if ((sub === 'switch' && inConflict(state)) || (sub === 'diff' && hasUnmerged(state))) return conflictForm(state, [sub, ...args].join(' '))
  switch (sub) {
    case 'status':
      return handleStatus(state, args)
    case 'add':
      return handleAdd(state, args)
    case 'commit':
      return handleCommit(state, args)
    case 'branch':
      return handleBranch(state, args)
    case 'checkout':
      return handleCheckout(state, args)
    case 'switch':
      return handleSwitch(state, args)
    case 'diff':
      return handleDiff(state, args)
    case 'show':
      return handleShow(state, args)
    case 'log':
      return handleLog(state, args)
    case 'tag':
      return handleTag(state, args)
    case 'stash':
      return handleStash(state, args)
    case 'reflog':
      return handleReflog(state, args)
    case 'reset':
      return handleReset(state, args)
    case 'cherry-pick':
      return handleCherryPick(state, args)
    case 'rebase':
      return handleRebase(state, args)
  }
}

/**
 * Выполняет одну строку терминала раздела 8. Ничего не бросает: любой недопустимый ввод
 * превращается в предусмотренный результат (вывод git с кодом возврата либо отказ области).
 * Пустая строка не меняет состояние и возвращает `result === null`.
 */
export function executeAppendixCommand(state: AppendixState, rawInput: string): { state: AppendixState; result: CommandResult | null } {
  if (!rawInput.trim()) return { state, result: null }

  function respond(outcome: Outcome) {
    return { state: appendCommand(outcome.state, rawInput, outcome.result), result: outcome.result }
  }

  const refusal = findShellRefusal(rawInput)
  if (refusal) return respond(refuse(state, shellRefusalText(refusal)))

  const files = Object.keys(state.working)
  const tokens = shellTokenize(rawInput, files)
  const words = tokens.map((t) => t.text)
  if (words[0] !== 'git') return respond(refuse(state, ru.errors.bashCommandNotFound(words[0] ?? '')))

  const badGlob = unexpandableGlob(tokens.slice(1), files)
  if (badGlob !== null) return respond(refuse(state, ru.errors.shellGlobUnsupported(badGlob)))

  const sub = words[1]
  if (sub === undefined) return respond(refuse(state, ae.gitUsageNoArgs))
  if (isGlobalGitOption(sub)) return respond(refuse(state, ae.commandOutOfScope(sub)))
  const args = words.slice(2)

  if (isHandledCommand(sub)) return respond(runHandled(state, sub, args))
  // merge и pull в отсоединённом HEAD вне области, но их исход сверен прогоном (О6): речь называет его.
  if (state.head.kind === 'detached' && (sub === 'merge' || sub === 'pull')) return respond(refuse(state, ae.detachedCommandOutOfScope(sub)))
  if (isRealGitCommand(sub)) return respond(refuse(state, ae.commandOutOfScope(sub)))
  return respond(exited(state, gitNotACommand(sub), 1))
}
