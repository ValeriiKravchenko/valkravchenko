import { dictionary as t } from '../i18n'
import { PROJECT_IDS, PROJECTS, TAG_IDS, getProjectsByDirection } from './projects'

describe('projects data', () => {
  it('has unique ids and a GitHub URL for each project', () => {
    expect(PROJECTS.map((p) => p.id)).toEqual([...PROJECT_IDS])
    for (const p of PROJECTS) {
      expect(p.url).toMatch(/^https:\/\/github\.com\/ValeriiKravchenko\//)
    }
  })

  it('has a title and description in the dictionary for every project id', () => {
    for (const p of PROJECTS) {
      const text = t.projects.texts[p.id]
      expect(text?.title, `title of ${p.id}`).toBeTruthy()
      expect(text?.description, `description of ${p.id}`).toBeTruthy()
    }
  })

  it('has a dictionary label for every tag used', () => {
    for (const p of PROJECTS) {
      expect(p.tags.length).toBeGreaterThan(0)
      for (const tag of p.tags) expect(t.projects.tags[tag], tag).toBeTruthy()
    }
    for (const tag of TAG_IDS) expect(t.projects.tags[tag]).toBeTruthy()
  })

  it('filters by direction', () => {
    expect(getProjectsByDirection('automation').map((p) => p.id)).toEqual([
      'bank-statement-automation',
      'payment-registry-automation',
    ])
    expect(getProjectsByDirection('java')).toHaveLength(1)
    expect(getProjectsByDirection('web')).toHaveLength(1)
  })
})
