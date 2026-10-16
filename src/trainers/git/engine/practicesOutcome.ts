// ============================================================
// Раздел 7 git-тренажёра: два вида исхода команды, общие для всех обработчиков (practices*.ts).
// «Ответ git с кодом возврата» и «честный отказ области» (target.md, часть III, правило 1).
// ============================================================
import type { CommandResult, PracticesState } from './practicesTypes'

export type Outcome = { state: PracticesState; result: CommandResult }

/** Результат с кодом возврата git: `ok` — это код 0. */
export function exited(state: PracticesState, output: string, exitCode: number, explanation: string | null = null): Outcome {
  return { state, result: { ok: exitCode === 0, output, explanation, exitCode } }
}

/** Честный отказ области: код возврата не задаётся, потому что git здесь ничего не печатал. */
export function refuse(state: PracticesState, output: string): Outcome {
  return { state, result: { ok: false, output, explanation: null } }
}
