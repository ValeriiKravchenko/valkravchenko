import { Button } from '../../components/Button'
import { LinkButton } from '../../components/LinkButton'
import { PageHeading } from '../../components/PageHeading'
import { Window } from '../../components/Window'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useDictionary } from '../../i18n'
import { pageTitle } from '../../i18n/pageTitle'
import { TRAINER_PATHS } from '../paths'

/** First screen of the trainers page: the two trainers and the six Git sections. */
export function TrainersIndexPage() {
  const t = useDictionary()
  useDocumentTitle(pageTitle(t, t.trainers.heading))
  // The six Git sections in order: name (from the dictionary) and path.
  const gitSections = [
    { name: t.trainers.git.listName, to: TRAINER_PATHS.git },
    { name: t.trainers.gitBranching.listName, to: TRAINER_PATHS.branching },
    { name: t.trainers.gitInspecting.listName, to: TRAINER_PATHS.inspecting },
    { name: t.trainers.gitUndoing.listName, to: TRAINER_PATHS.undoing },
    { name: t.trainers.gitCollaborating.listName, to: TRAINER_PATHS.collaborating },
    { name: t.trainers.gitSearching.listName, to: TRAINER_PATHS.searching },
  ]
  const cardClass = 'flex flex-col items-start gap-3 rounded-button border border-border bg-window p-5'

  return (
    <Window title={t.trainers.windowTitle} titleAs="p" className="mx-auto max-w-[960px]">
      {/* Plain anchor: leaves the trainers page for the main site with a full load. */}
      <div className="mb-6">
        <Button href="/">{t.trainers.siteLink}</Button>
      </div>
      <PageHeading>{t.trainers.heading}</PageHeading>
      <p className="mt-4 max-w-[60ch]">{t.trainers.intro}</p>
      <ul className="m-0 mt-8 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2">
        <li className={cardClass}>
          <h2 className="m-0 text-xl font-semibold [overflow-wrap:anywhere]">{t.trainers.git.title}</h2>
          <p className="m-0 text-[15px] text-muted">{t.trainers.git.description}</p>
          <ul
            aria-label={t.trainers.gitSectionsLabel}
            className="m-0 grid w-full list-none grid-cols-1 gap-2 p-0"
          >
            {gitSections.map((section, i) => (
              <li key={section.to} className="grid">
                <LinkButton to={section.to}>{t.trainers.gitSectionLink(i + 1, section.name)}</LinkButton>
              </li>
            ))}
          </ul>
        </li>
        <li className={cardClass}>
          <h2 className="m-0 text-xl font-semibold [overflow-wrap:anywhere]">{t.trainers.english.title}</h2>
          <p className="m-0 flex-1 text-[15px] text-muted">{t.trainers.english.description}</p>
          <LinkButton
            to={TRAINER_PATHS.english}
            variant="primary"
            aria-label={t.trainers.ctaAriaLabel(t.trainers.english.title)}
          >
            {t.trainers.cta}
          </LinkButton>
        </li>
      </ul>
    </Window>
  )
}
