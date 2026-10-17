// ============================================================
// Section 7 of the git trainer: the trainer's advice on a commit message (target.md, part IX,
// dangerous place 11; spec.md S7-23...S7-38a). This is the trainer's own speech, not git output:
// git does not judge a message, it accepts any non-empty one. The function is pure (no React,
// no state) and the screen only shows its result.
//
// The text is parsed as if it were passed to `-m` (run P7.24): `#` is an ordinary character,
// leading blank lines and trailing spaces are dropped, an empty or blank message is empty.
// Thresholds: more than 72 characters is a warning (git does not truncate, the long line is only
// hard to read); 51..72 is an info note; the body hint starts at 72.
// ============================================================
import { parseCommitMessage } from './practicesCommit'
import { ru } from '../locales/ru'

const adv = ru.practices.advice

/** The exact answer git gives to an empty message (P7.24). Git output stays English, here in the logic module. */
export const GIT_EMPTY_MESSAGE_LINE = 'Aborting commit due to empty commit message.'

export type AdviceKind = 'warn' | 'info' | 'ok'

export interface AdviceItem {
  kind: AdviceKind
  text: string
}

export type CommitAdvice =
  | { empty: true; hint: string }
  | {
      empty: false
      /** Characters in the first line (code points, not UTF-16 units). */
      subjectLength: number
      /** Lines after the title when a blank line follows it; null for a one-line message. */
      bodyLines: number | null
      /** "Title: N / 50 characters" plus the body line count. */
      counter: string
      /** Warnings first (or one "ok" line when there are none), then info notes. */
      items: AdviceItem[]
    }

/** Words that say nothing about the change (lower case, trailing punctuation stripped). */
const GENERIC_MESSAGE =
  /^(fix(e[sd])?|bugfix|update[sd]?|change[sd]?|edit(ed)?|wip|misc|stuff|commit|test|tmp|temp|asdf+|qwerty|фикс|правк[аи]|исправлени[яе]|изменени[яе]|обновлени[яе]|тест|стафф|коммит|доработки?)( (bugs?|stuff|things|code|files?|it|issues?|changes|баги?|код|файлы?|всё|все|мелочи))?$/
const PAST_TENSE_START =
  /^(added|fixed|updated|removed|changed|adds|fixes|updates|добавлен[оыа]?|исправлен[оыа]?|обновлен[оыа]?|удалён|удален[оыа]?|изменен[оыа]?|добавил[аи]?|исправил[аи]?|обновил[аи]?|удалил[аи]?|изменил[аи]?)(\s|$)/i
const CONVENTIONAL_PREFIX = /^(feat|fix|docs|style|refactor|test|chore|perf|build|ci)(\([\w-]+\))?!?: \S/

const lengthOf = (text: string): number => [...text].length

/** Normalises the text the way `parseCommitMessage` does: no trailing spaces, no leading blank lines. */
function messageLines(message: string): string[] {
  return message
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '')
    .split('\n')
}

/** Advice for one commit message. Never throws, any text is allowed. */
export function computeCommitAdvice(message: string): CommitAdvice {
  if (parseCommitMessage([message]).empty) return { empty: true, hint: adv.emptyHint(GIT_EMPTY_MESSAGE_LINE) }

  const lines = messageLines(message)
  const subject = lines[0].trim()
  const subjectLength = lengthOf(subject)
  const words = subject.split(/\s+/).filter(Boolean)
  const bare = subject
    .toLowerCase()
    .replace(/[.!?…:;,\s]+$/, '')
    .trim()
  const blankAfterSubject = lines.length > 1 && lines[1].trim() === ''
  const bodyLines = lines.length > 1 ? (blankAfterSubject ? Math.max(0, lines.length - 2) : 0) : null

  const warns: string[] = []
  const infos: string[] = []

  if (bare === '' || GENERIC_MESSAGE.test(bare)) warns.push(adv.generic)
  else if (words.length === 1) warns.push(adv.oneWord)

  if (subjectLength > 72) warns.push(adv.tooLong(subjectLength))
  else if (subjectLength > 50) infos.push(adv.aboveFifty(subjectLength))

  if (lines.length > 1 && !blankAfterSubject) warns.push(adv.noBlankLine)

  if (subject.endsWith('.') && !/^\.+$/.test(subject)) infos.push(adv.trailingDot)
  if (PAST_TENSE_START.test(subject)) infos.push(adv.imperative)
  if (subjectLength > 8 && subject === subject.toUpperCase() && /[A-Za-zА-Яа-я]/.test(subject)) infos.push(adv.upperCase)
  if (CONVENTIONAL_PREFIX.test(subject)) infos.push(adv.conventional)

  if (blankAfterSubject) {
    const longBody = lines.slice(2).filter((line) => lengthOf(line) > 72).length
    if (longBody > 0) infos.push(adv.longBody(longBody))
  }

  const items: AdviceItem[] = [
    ...(warns.length > 0
      ? warns.map((text): AdviceItem => ({ kind: 'warn', text }))
      : [{ kind: 'ok', text: adv.allClear } as AdviceItem]),
    ...infos.map((text): AdviceItem => ({ kind: 'info', text })),
  ]
  return { empty: false, subjectLength, bodyLines, counter: adv.counter(subjectLength, bodyLines), items }
}
