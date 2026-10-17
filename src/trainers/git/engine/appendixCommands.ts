// ============================================================
// Раздел 8 git-тренажёра («Приложение: пять важных тем»), шаг A: разбор командной строки и
// диспетчер. Две стороны, как в остальных разделах: шелл (shell.ts: слова, кавычки, голая `*`) и
// git (appendix*.ts). Строки `fatal: …`, `error: …`, `hint: …` — буквальный вывод git 2.53.0 из
// docs/git-trainer/reports/ (section8-git-runs.txt, appendix-g18e-git-runs.txt), не переводятся и в
// словарь не идут. Всё, что говорит сам тренажёр, лежит в ru.appendix и начинается с метки
// [тренажёр] (target.md, часть III, правило 2).
//
// Граница области (часть III, правило 1). Воспроизводятся только формы, сверенные прогонами; любая
// другая получает честный отказ области без кода возврата и без выдуманного сообщения git. Ошибки
// игрока, которые git воспроизводит сам, возвращаются результатом с кодом возврата, не исключением.
// ============================================================
import type { AppendixState, CommandResult } from './appendixTypes'
import { exited, refuse, type Outcome } from './appendixOutcome'
import { handleAdd, handleBranch, handleCheckout, handleCommit, handleDiff, handleStatus } from './appendixLocal'
import { handleLog } from './appendixLog'
import { handleShow } from './appendixShow'
import { handleTag } from './appendixTags'
import { globMatches } from './appendixRefs'
import { isHandledCommand, isRealGitCommand, type HandledCommand } from './appendixScope'
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
    case 'diff':
      return handleDiff(state, args)
    case 'show':
      return handleShow(state, args)
    case 'log':
      return handleLog(state, args)
    case 'tag':
      return handleTag(state, args)
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
  if (sub === 'stash') return respond(refuse(state, ae.stash))
  if (isRealGitCommand(sub)) return respond(refuse(state, ae.commandOutOfScope(sub)))
  return respond(exited(state, gitNotACommand(sub), 1))
}
