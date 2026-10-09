import { SECTIONS, getEnabledSections, getSectionPath } from './sections'
import { dictionary } from '../i18n'

describe('section registry', () => {
  it('enables home, projects, automation, library and contacts only, in menu order', () => {
    expect(getEnabledSections().map((s) => s.id)).toEqual(['home', 'projects', 'automation', 'library', 'contacts'])
  })

  it('keeps java, basics and trainers disabled', () => {
    for (const id of ['java', 'basics', 'trainers']) {
      expect(SECTIONS.find((s) => s.id === id)?.enabled).toBe(false)
      expect(getSectionPath(id as 'java')).toBeUndefined()
    }
  })

  it('has unique ids and paths, and a dictionary label for every section', () => {
    expect(new Set(SECTIONS.map((s) => s.id)).size).toBe(SECTIONS.length)
    expect(new Set(SECTIONS.map((s) => s.path)).size).toBe(SECTIONS.length)
    for (const s of SECTIONS) expect(dictionary.nav.labels[s.id]).toBeTruthy()
  })
})
