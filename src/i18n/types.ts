import type { ProjectId, TagId } from '../data/projects'
import type { SectionId } from '../data/sections'
import type { Theme } from '../theme/resolveTheme'

/** Tab title, window title and short list name of a Git trainer screen. */
export interface GitScreenText {
  title: string
  windowTitle: string
  listName: string
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
  title: string
  description: string
}

/** Shape shared by every locale file (ru.ts now, en.ts later). */
export interface Dictionary {
  siteTitle: string
  skipLink: string
  logo: { text: string; ariaLabel: string }
  nav: { ariaLabel: string; labels: Record<SectionId, string> }
  systemBar: { language: string; user: string }
  theme: { labels: Record<Theme, string>; ariaLabels: Record<Theme, string> }
  dock: {
    ariaLabel: string
    /** Shorter captions for the narrow phone dock; the full label stays in aria-label and title. */
    shortLabels: Partial<Record<SectionId, string>>
  }
  /** Decorative window menu (aria-hidden). */
  windowMenu: string[]
  footer: { text: string }
  home: {
    windowTitle: string
    heading: string
    lead: string
    primaryCta: SectionLinkText
    secondaryCta: SectionLinkText
    chipLabels: { projects: string; books: string }
    terminal: {
      title: string
      host: string
      listCommand: string
      readCommand: string
      about: string
      note: string
    }
    beforeAfter: {
      title: string
      rows: { project: ProjectId; before: string; after: string }[]
    }
  }
  projects: {
    heading: string
    windowTitle: string
    linkLabel: string
    newTabNote: string
    tagsLabel: string
    texts: Record<ProjectId, ProjectText>
    tags: Record<TagId, string>
  }
  automation: {
    heading: string
    windowTitle: string
    intro: string
    workflowTitle: string
    projectsTitle: string
    tableHeaders: { stage: string; action: string }
    workflow: { stage: string; action: string }[]
    tools: string
  }
  library: {
    heading: string
    windowTitle: string
    intro: string
    searchLabel: string
    searchPlaceholder: string
    categoriesLabel: string
    reset: string
    shown: (shown: number, total: number) => string
    listLabel: string
    empty: string
  }
  trainers: {
    heading: string
    windowTitle: string
    intro: string
    /** Link back from a trainer window to the trainers page. */
    backLabel: string
    /** Shown while a trainer screen is loading. */
    loading: string
    cta: string
    ctaAriaLabel: (title: string) => string
    git: { title: string; windowTitle: string; description: string; listName: string }
    gitBranching: GitScreenText
    gitInspecting: GitScreenText
    gitUndoing: GitScreenText
    gitCollaborating: GitScreenText
    gitSearching: GitScreenText
    /** Accessible name of the list of Git sections on the trainers page. */
    gitSectionsLabel: string
    /** Visible link text for a Git section: its number and name. */
    gitSectionLink: (number: number, name: string) => string
    english: { title: string; windowTitle: string; description: string }
    /** Screen-reader prefix for a command that was refused or failed. */
    failedOutput: string
    /** Screen-reader state words for a mission in the list. */
    missionDone: string
    missionTodo: string
  }
  contacts: {
    heading: string
    windowTitle: string
    intro: string
    items: ContactText[]
  }
  notFound: { windowTitle: string; heading: string; body: string; homeLink: string }
}
