export const SECTION_IDS = [
  'home',
  'projects',
  'automation',
  'contacts',
  'java',
  'basics',
  'trainers',
  'library',
] as const

export type SectionId = (typeof SECTION_IDS)[number]

export interface Section {
  id: SectionId
  /** Absolute URL path, `/` for the home page. */
  path: string
  /** Key of the menu label in `dictionary.nav.labels`. */
  navKey: SectionId
  /** A section is published (menu, routes, home page) only when enabled. */
  enabled: boolean
}

/**
 * Section registry. To publish a section: add its page, add its texts to
 * the dictionary, and flip `enabled` to true. Menu and routes follow.
 */
export const SECTIONS: readonly Section[] = [
  { id: 'home', path: '/', navKey: 'home', enabled: true },
  { id: 'projects', path: '/projects', navKey: 'projects', enabled: true },
  { id: 'automation', path: '/automation', navKey: 'automation', enabled: true },
  { id: 'contacts', path: '/contacts', navKey: 'contacts', enabled: true },
  { id: 'java', path: '/java', navKey: 'java', enabled: false },
  { id: 'basics', path: '/basics', navKey: 'basics', enabled: false },
  { id: 'trainers', path: '/trainers', navKey: 'trainers', enabled: false },
  { id: 'library', path: '/library', navKey: 'library', enabled: false },
]

export function getEnabledSections(sections: readonly Section[] = SECTIONS): Section[] {
  return sections.filter((section) => section.enabled)
}

/** Path of an enabled section, or `undefined` when it is disabled or unknown. */
export function getSectionPath(
  id: SectionId,
  sections: readonly Section[] = SECTIONS,
): string | undefined {
  return getEnabledSections(sections).find((section) => section.id === id)?.path
}
