import type { SectionId } from '../data/sections'

export interface ChipText {
  label: string
  count: string
}

export interface LinkText {
  href: string
  label: string
}

/** Link to a section by registry id; hidden when the section is disabled. */
export interface SectionLinkText {
  section: SectionId
  label: string
}

export interface ContactText {
  label: string
  value: string
}

export interface ProjectText {
  id: string
  title: string
  description: string
  chip: ChipText
}

/** Shape shared by every locale file (ru.ts now, en.ts later). */
export interface Dictionary {
  lang: string
  siteTitle: string
  skipLink: string
  logo: { text: string; ariaLabel: string }
  nav: { ariaLabel: string; labels: Record<SectionId, string> }
  footer: { text: string }
  home: {
    documentTitle: string
    windowTitle: string
    heading: string
    lead: string
    primaryCta: SectionLinkText
    secondaryCta: SectionLinkText
    chips: ChipText[]
  }
  projects: {
    documentTitle: string
    heading: string
    windowTitle: string
    items: ProjectText[]
  }
  trainer: { windowTitle: string; heading: string; body: string; chip: ChipText }
  contacts: {
    documentTitle: string
    heading: string
    windowTitle: string
    intro: string
    items: ContactText[]
  }
  notFound: { windowTitle: string; documentTitle: string; heading: string; body: string; homeLink: string }
}
