import { PageHeading } from '../components/PageHeading'
import { ProjectList } from '../components/ProjectList'
import { Window } from '../components/Window'
import { buildProjectItems } from '../data/projectItems'
import { PROJECTS } from '../data/projects'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { pageTitle } from '../i18n/pageTitle'
import { useDictionary } from '../i18n'

export function ProjectsPage() {
  const t = useDictionary()
  useDocumentTitle(pageTitle(t, t.projects.heading))

  return (
    <Window title={t.projects.windowTitle} titleAs="p" className="mx-auto max-w-[960px]">
      <PageHeading>{t.projects.heading}</PageHeading>
      <div className="mt-8">
        <ProjectList headingLevel={2} items={buildProjectItems(PROJECTS, t)} />
      </div>
    </Window>
  )
}
