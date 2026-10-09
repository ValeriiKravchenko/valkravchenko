import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const file = resolve(process.cwd(), 'public/third-party-notices.txt')

describe('third-party notices', () => {
  it('exists', () => {
    expect(existsSync(file)).toBe(true)
  })

  it.each(['Browne', 'CC BY-SA 4.0', 'SIL OPEN FONT LICENSE', 'IBM Corp.'])(
    'contains "%s"',
    (text) => {
      expect(readFileSync(file, 'utf8')).toContain(text)
    },
  )
})
