import { Button } from '../components/Button'
import { PageHeading } from '../components/PageHeading'
import { Window } from '../components/Window'
import { REPO_URL } from '../data/aboutPaths'
import { TRAINERS_APP_PATH } from '../data/trainerPaths'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useDictionary } from '../i18n'
import { pageTitle } from '../i18n/pageTitle'

/**
 * Public showcase of the trainers. The trainers themselves live on a separate
 * page, so "open" is a plain anchor: the browser asks the server for it.
 */
export function TrainersPage() {
  const t = useDictionary()
  useDocumentTitle(pageTitle(t, t.trainers.heading))
  const cards = [t.trainers.git, t.trainers.english]
  const cardClass = 'flex flex-col items-start gap-3 rounded-button border border-border bg-window p-5'

  return (
    <Window title={t.trainers.windowTitle} titleAs="p" className="mx-auto max-w-[960px]">
      <PageHeading>{t.trainers.heading}</PageHeading>
      <p className="mt-4 max-w-[60ch]">{t.trainers.showcase.intro}</p>
      <ul className="m-0 mt-8 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2">
        {cards.map((card) => (
          <li key={card.title} className={cardClass}>
            <h2 className="m-0 text-xl font-semibold [overflow-wrap:anywhere]">{card.title}</h2>
            <p className="m-0 flex-1 text-[15px] text-muted">{card.description}</p>
            <Button href={TRAINERS_APP_PATH} variant="primary" aria-label={t.trainers.ctaAriaLabel(card.title)}>
              {t.trainers.cta}
            </Button>
            <p className="m-0 text-[15px] text-muted">
              {t.trainers.showcase.note}{' '}
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${t.trainers.showcase.repoLabel} ${t.projects.newTabNote}`}
                className="text-accent underline decoration-teal-deco underline-offset-4 hover:text-accent-hover"
              >
                {t.trainers.showcase.repoLabel}
              </a>
            </p>
          </li>
        ))}
      </ul>
    </Window>
  )
}
