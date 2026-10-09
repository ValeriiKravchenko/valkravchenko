import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router'
import { SECTIONS, getEnabledSections, type SectionId, type Section } from './data/sections'
import { Layout } from './layout/Layout'
import { AboutPage } from './pages/AboutPage'
import { AutomationPage } from './pages/AutomationPage'
import { ContactsPage } from './pages/ContactsPage'
import { HomePage } from './pages/HomePage'
import { LibraryPage } from './pages/LibraryPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { TrainersPage } from './pages/TrainersPage'

export type PageProps = { sections?: readonly Section[] }
export type PageMap = Partial<Record<SectionId, ComponentType<PageProps>>>

/** Page component per section id. Only sections that have a page are listed. */
export const PAGES: PageMap = {
  home: HomePage,
  about: AboutPage,
  projects: ProjectsPage,
  automation: AutomationPage,
  library: LibraryPage,
  trainers: TrainersPage,
  contacts: ContactsPage,
}

/**
 * Builds the route tree from the registry: one layout route, one child per
 * enabled section, and a catch-all 404. Disabled sections get no route.
 */
export function buildRoutes(
  sections: readonly Section[] = SECTIONS,
  pages: PageMap = PAGES,
): RouteObject[] {
  const children: RouteObject[] = getEnabledSections(sections).map((section) => {
    const Page = pages[section.id]
    if (!Page) {
      throw new Error(`Section "${section.id}" is enabled but has no page`)
    }
    return section.path === '/'
      ? { index: true, element: <Page sections={sections} /> }
      : { path: section.path.replace(/^\//, ''), element: <Page sections={sections} /> }
  })
  children.push({ path: '*', element: <NotFoundPage /> })

  return [{ path: '/', element: <Layout sections={sections} />, children }]
}
