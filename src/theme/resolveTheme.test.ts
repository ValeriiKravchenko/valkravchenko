import { resolveTheme } from './resolveTheme'

describe('resolveTheme', () => {
  it.each([
    ['day', true, 'day'],
    ['day', false, 'day'],
    ['night', true, 'night'],
    ['night', false, 'night'],
  ] as const)('saved %s wins over the system (dark: %s)', (stored, dark, expected) => {
    expect(resolveTheme(stored, dark)).toBe(expected)
  })

  it.each(['purple', '', 'Day', 'NIGHT', '1', 'null'])('ignores garbage %j in storage', (stored) => {
    expect(resolveTheme(stored, false)).toBe('day')
    expect(resolveTheme(stored, true)).toBe('night')
  })

  it('follows the system when nothing is saved', () => {
    expect(resolveTheme(null, false)).toBe('day')
    expect(resolveTheme(null, true)).toBe('night')
    expect(resolveTheme(undefined, false)).toBe('day')
    expect(resolveTheme(undefined, true)).toBe('night')
  })
})
