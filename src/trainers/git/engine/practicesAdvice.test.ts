import { computeCommitAdvice, GIT_EMPTY_MESSAGE_LINE } from './practicesSection'
import type { AdviceItem, CommitAdvice } from './practicesSection'
import { ru } from '../locales/ru'

const adv = ru.practices.advice

/** Advice for a non-empty message; fails the test if the engine says "empty". */
function full(message: string): Extract<CommitAdvice, { empty: false }> {
  const result = computeCommitAdvice(message)
  if (result.empty) throw new Error('expected a non-empty advice')
  return result
}
const kinds = (items: AdviceItem[], kind: AdviceItem['kind']) => items.filter((i) => i.kind === kind)
const texts = (message: string, kind: AdviceItem['kind']) => kinds(full(message).items, kind).map((i) => i.text)

describe('computeCommitAdvice', () => {
  it('S7-23: "fix" gives one "too general" warning and no "too short" one', () => {
    expect(texts('fix', 'warn')).toEqual([adv.generic])
    expect(texts('fix', 'info')).toEqual([])
  })

  it('S7-24: "Fix #42" has no warnings and an ok line; "Fix typo" has no warnings', () => {
    const a = full('Fix #42')
    expect(kinds(a.items, 'warn')).toEqual([])
    expect(kinds(a.items, 'ok')).toHaveLength(1)
    expect(texts('Fix typo', 'warn')).toEqual([])
  })

  it.each(['fix bug', 'Правки', 'WIP.', '...'])('S7-25: "%s" is too general', (message) => {
    expect(texts(message, 'warn')).toContain(adv.generic)
  })

  it('S7-26: a single unusual word gives the "one word" warning', () => {
    expect(texts('Опечатка', 'warn')).toEqual([adv.oneWord])
  })

  it('S7-27: a good title has an ok line and no info or warning', () => {
    const a = full('Добавить валидацию email')
    expect(a.items.map((i) => i.kind)).toEqual(['ok'])
  })

  it('S7-28: past tense with a trailing dot has two info notes, no warning, and an ok line', () => {
    const a = full('Добавил валидацию email.')
    expect(kinds(a.items, 'warn')).toEqual([])
    expect(texts('Добавил валидацию email.', 'info')).toEqual([adv.trailingDot, adv.imperative])
    expect(kinds(a.items, 'ok')).toHaveLength(1)
  })

  it('S7-29 and place 11: a title over 72 characters warns, and the text says git does not truncate it', () => {
    const message = 'Добавить валидацию адреса электронной почты пользователя при регистрации в системе'
    expect([...message].length).toBeGreaterThan(72)
    const warns = texts(message, 'warn')
    expect(warns).toEqual([adv.tooLong([...message].length)])
    expect(warns[0]).toContain('72')
    expect(warns[0]).toContain('Git его не обрежет')
    expect(warns[0]).toContain('git log --oneline')
    expect(warns[0]).not.toContain('обрежется')
  })

  it('S7-29 boundary: exactly 72 characters is not a warning, 73 is', () => {
    const title = (n: number) => `Добавить ${'а'.repeat(n - 'Добавить '.length - 3)} ок`
    expect([...title(72)]).toHaveLength(72)
    expect([...title(73)]).toHaveLength(73)
    expect(texts(title(72), 'warn')).toEqual([])
    expect(texts(title(73), 'warn')).toHaveLength(1)
  })

  it('S7-30 and place 11: a title with the next line right after it warns about the blank line', () => {
    const warns = texts('Исправить расчёт скидки\nвторая строка без пустой', 'warn')
    expect(warns).toEqual([adv.noBlankLine])
    expect(warns[0]).toContain('пустая строка')
    expect(warns[0]).toContain('склеит')
  })

  it('S7-31: leading blank lines are not the title, and the counter says 23 / 50', () => {
    const a = full('\n\nИсправить расчёт скидки')
    expect(kinds(a.items, 'warn')).toEqual([])
    expect(a.subjectLength).toBe(23)
    expect(a.counter).toContain('23 / 50')
    expect(a.bodyLines).toBeNull()
  })

  it('S7-32: a body line over 72 characters gives an info note that mentions 72', () => {
    const body = 'б'.repeat(80)
    const info = texts(`Исправить расчёт скидки\n\n${body}`, 'info')
    expect(info).toEqual([adv.longBody(1)])
    expect(info[0]).toContain('72')
  })

  it('S7-33: an all-caps title gives the caps note', () => {
    expect(texts('ИСПРАВИТЬ РАСЧЁТ СКИДКИ', 'info')).toContain(adv.upperCase)
  })

  it('S7-34: a conventional prefix is not "too general" and gives the Conventional Commits note', () => {
    expect(texts('fix: исправить расчёт скидки', 'warn')).toEqual([])
    expect(texts('fix: исправить расчёт скидки', 'info')).toEqual([adv.conventional])
  })

  it.each(['', '   ', '\n\n', ' \t \n  '])('S7-35 and place 11: %j is empty and the hint names the git answer', (message) => {
    const a = computeCommitAdvice(message)
    expect(a.empty).toBe(true)
    if (a.empty) {
      expect(a.hint).toContain(GIT_EMPTY_MESSAGE_LINE)
      expect(a.hint).toContain('коммит не создаст')
      expect(a.hint).toContain('Напиши сообщение')
    }
  })

  it('S7-36: the sample with a body has no warning and reports a 2-line body', () => {
    const a = full(adv.examples.body)
    expect(kinds(a.items, 'warn')).toEqual([])
    expect(a.counter).toContain('тело: 2 строки')
  })

  it('S7-37: the bad example warns and the good example is ok', () => {
    expect(kinds(full(adv.examples.bad).items, 'warn').length).toBeGreaterThan(0)
    const good = full(adv.examples.good)
    expect(kinds(good.items, 'warn')).toEqual([])
    expect(kinds(good.items, 'ok')).toHaveLength(1)
  })

  it('S7-38: 60 identical capital letters warn "one word" and add the 60-character and caps notes', () => {
    const message = 'А'.repeat(60)
    const a = full(message)
    expect(a.counter).toContain('60 / 50 символов')
    expect(texts(message, 'warn')).toEqual([adv.oneWord])
    expect(texts(message, 'info')).toEqual([adv.aboveFifty(60), adv.upperCase])
    expect(kinds(a.items, 'ok')).toEqual([])
  })

  it('S7-38a: a multi-word title of 59 characters has no warning, the ok line and one 59-character note', () => {
    const message = 'Добавить валидацию адреса электронной почты пользователя ок'
    expect([...message]).toHaveLength(59)
    const a = full(message)
    expect(kinds(a.items, 'warn')).toEqual([])
    expect(kinds(a.items, 'ok').map((i) => i.text)).toEqual([adv.allClear])
    expect(texts(message, 'info')).toEqual([adv.aboveFifty(59)])
  })

  it('place 11: "#" is an ordinary character, the message is parsed as if passed to -m', () => {
    const a = full('# не комментарий при -m')
    expect(a.subjectLength).toBe([...'# не комментарий при -m'].length)
    expect(kinds(a.items, 'warn')).toEqual([])
  })

  it('place 11: a body hint is not given when the blank line is missing', () => {
    const a = full(`Исправить расчёт скидки\n${'б'.repeat(80)}`)
    expect(a.bodyLines).toBe(0)
    expect(texts(`Исправить расчёт скидки\n${'б'.repeat(80)}`, 'info')).toEqual([])
  })

  it('does not throw on odd input', () => {
    for (const message of ['\u0000', '😀'.repeat(100), '\r\n\r\nfix\r\n', '.', '!!!']) {
      expect(() => computeCommitAdvice(message)).not.toThrow()
    }
  })
})
