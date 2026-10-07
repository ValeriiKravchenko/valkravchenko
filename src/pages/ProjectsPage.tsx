import { Chip } from '../components/Chip'
import { PageHeading } from '../components/PageHeading'
import { ProjectList } from '../components/ProjectList'
import { Window } from '../components/Window'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useDictionary } from '../i18n'

export function ProjectsPage() {
  const t = useDictionary()
  useDocumentTitle(t.projects.documentTitle)

  return (
    <>
      <PageHeading>{t.projects.heading}</PageHeading>
      <div className="mt-8 grid gap-11 lg:grid-cols-[2fr_1fr]">
        <Window title={t.projects.windowTitle}>
          <ProjectList items={t.projects.items} />
        </Window>
        <Window title={t.trainer.windowTitle} variant="striped" titleAs="h2">
          <h3 className="m-0 mb-2 text-xl font-semibold">{t.trainer.heading}</h3>
          <p className="m-0 mb-4 text-[15px] text-muted">{t.trainer.body}</p>
          <Chip {...t.trainer.chip} />
        </Window>
      </div>
    </>
  )
}
