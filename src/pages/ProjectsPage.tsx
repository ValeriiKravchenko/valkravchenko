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
    <>
      <PageHeading>{t.projects.heading}</PageHeading>
      <div className="mt-8">
        <Window title={t.projects.windowTitle}>
          <ProjectList items={buildProjectItems(PROJECTS, t)} />
        </Window>
      </div>
    </>
  )
}
