export interface ChipText {
  label: string
  count: string
}

export interface LinkText {
  href: string
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
  logo: { text: string; ariaLabel: string; href: string }
  nav: { ariaLabel: string; items: LinkText[] }
  home: {
    windowTitle: string
    heading: string
    lead: string
    primaryCta: LinkText
    secondaryCta: LinkText
    chips: ChipText[]
  }
  projects: { windowTitle: string; items: ProjectText[] }
  trainer: { windowTitle: string; heading: string; body: string; chip: ChipText }
  contacts: { windowTitle: string; intro: string; items: ContactText[] }
}
