import { screen } from '@testing-library/react'
import { renderAt } from './test/renderAt'

/** Heading levels in document order. */
function headingLevels(): number[] {
  return screen.getAllByRole('heading').map((h) => Number(h.tagName.slice(1)))
}

describe('heading order', () => {
  it.each(['/', '/projects', '/automation', '/library', '/trainers', '/contacts', '/nope'])(
    'at %s: one h1 first, and no level is skipped',
    (path) => {
      renderAt(path)
      const levels = headingLevels()
      expect(levels[0]).toBe(1)
      expect(levels.filter((level) => level === 1)).toHaveLength(1)
      levels.slice(1).forEach((level, index) => {
        // A heading may go at most one level deeper than the previous one.
        expect(level, `heading #${index + 2} follows level ${levels[index]}`).toBeLessThanOrEqual(levels[index] + 1)
      })
    },
  )
})
