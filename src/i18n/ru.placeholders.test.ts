import { ru } from './ru'

const PLACEHOLDERS = ['[github]', '[email]', '[до]', '[после]', 'появится позже']

describe('ru dictionary placeholders', () => {
  it.each(PLACEHOLDERS)('has no "%s" left in any string', (placeholder) => {
    expect(JSON.stringify(ru)).not.toContain(placeholder)
  })
})
