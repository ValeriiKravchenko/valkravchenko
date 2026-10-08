import { PageHeading } from '../components/PageHeading'
import { ProjectList } from '../components/ProjectList'
import { Window } from '../components/Window'
import { buildProjectItems } from '../data/projectItems'
import { getProjectsByDirection } from '../data/projects'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { pageTitle } from '../i18n/pageTitle'
import { useDictionary } from '../i18n'

export function AutomationPage() {
  const t = useDictionary()
  useDocumentTitle(pageTitle(t, t.automation.heading))
  const { tableHeaders } = t.automation

  return (
    <>
      <PageHeading>{t.automation.heading}</PageHeading>
      <p className="mt-4 max-w-[60ch]">{t.automation.intro}</p>
      <div className="mt-8 flex flex-col gap-11">
        <Window title={t.automation.workflowTitle}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[15px]">
              <thead className="max-sm:sr-only">
                <tr>
                  <th scope="col" className="border-b border-border px-3 py-2 font-semibold">
                    {tableHeaders.stage}
                  </th>
                  <th scope="col" className="border-b border-border px-3 py-2 font-semibold">
                    {tableHeaders.action}
                  </th>
                </tr>
              </thead>
              <tbody>
                {t.automation.workflow.map((row) => (
                  <tr key={row.stage} className="max-sm:block max-sm:border-b max-sm:border-divider max-sm:py-2">
                    <th
                      scope="row"
                      className="border-b border-divider px-3 py-3 align-top font-semibold max-sm:block max-sm:border-0 max-sm:pb-1"
                    >
                      {row.stage}
                    </th>
                    <td className="border-b border-divider px-3 py-3 align-top text-muted max-sm:block max-sm:border-0 max-sm:pt-0">
                      {row.action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="m-0 mt-5 text-[15px]">{t.automation.tools}</p>
        </Window>
        <Window title={t.projects.windowTitle}>
          <ProjectList items={buildProjectItems(getProjectsByDirection('automation'), t)} />
        </Window>
      </div>
    </>
  )
}
