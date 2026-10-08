import { dictionary as t } from '.'
import { pageTitle } from './pageTitle'

describe('pageTitle', () => {
  it('returns the site title alone without a page name', () => {
    expect(pageTitle(t)).toBe(t.siteTitle)
  })

  it('joins page name and site title with an em dash', () => {
    expect(pageTitle(t, 'Проекты')).toBe(`Проекты — ${t.siteTitle}`)
  })
})
