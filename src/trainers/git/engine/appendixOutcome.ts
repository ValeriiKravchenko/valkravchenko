// ============================================================
// Раздел 8 git-тренажёра: два вида исхода команды, общие для всех обработчиков (appendix*.ts).
// «Ответ git с кодом возврата» и «честный отказ области» (target.md, часть III, правило 1).
// Отказ git — предусмотренный результат с кодом возврата, а не исключение.
// ============================================================
import type { AppendixState, CommandResult } from './appendixTypes'

export type Outcome = { state: AppendixState; result: CommandResult }

/** Ответ git с кодом возврата: `ok` — это код 0. */
export function exited(state: AppendixState, output: string, exitCode: number, explanation: string | null = null): Outcome {
  return { state, result: { ok: exitCode === 0, output, explanation, exitCode } }
}

/** Честный отказ области: git здесь ничего не печатал, поэтому кода возврата нет. */
export function refuse(state: AppendixState, output: string): Outcome {
  return { state, result: { ok: false, output, explanation: null } }
}
