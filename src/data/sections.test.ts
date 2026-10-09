import { SECTIONS, getEnabledSections, getSectionPath } from './sections'
import { ABOUT_PATH } from './aboutPaths'
import { dictionary } from '../i18n'

describe('section registry', () => {
  it('enables home, about, projects, automation, library, trainers and contacts only, in menu order', () => {
    expect(getEnabledSections().map((s) => s.id)).toEqual(['home', 'about', 'projects', 'automation', 'library', 'trainers', 'contacts'])
  })

  it('keeps java and basics disabled', () => {
    for (const id of ['java', 'basics']) {
      expect(SECTIONS.find((s) => s.id === id)?.enabled).toBe(false)
      expect(getSectionPath(id as 'java')).toBeUndefined()
    }
  })

  it('publishes about at the About path as the second section', () => {
    expect(getSectionPath('about')).toBe(ABOUT_PATH)
    expect(getEnabledSections()[1].id).toBe('about')
  })

  it('publishes trainers at /trainers', () => {
    expect(getSectionPath('trainers')).toBe('/trainers')
  })

  it('has unique ids and paths, and a dictionary label for every section', () => {
    expect(new Set(SECTIONS.map((s) => s.id)).size).toBe(SECTIONS.length)
    expect(new Set(SECTIONS.map((s) => s.path)).size).toBe(SECTIONS.length)
    for (const s of SECTIONS) expect(dictionary.nav.labels[s.id]).toBeTruthy()
  })
})
