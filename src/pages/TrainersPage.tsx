import { LinkButton } from '../components/LinkButton'
import { PageHeading } from '../components/PageHeading'
import { Window } from '../components/Window'
import { TRAINER_PATHS } from '../data/trainerPaths'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useDictionary } from '../i18n'
import { pageTitle } from '../i18n/pageTitle'

export function TrainersPage() {
  const t = useDictionary()
  useDocumentTitle(pageTitle(t, t.trainers.heading))
  const cards = [
    { id: 'git', text: t.trainers.git, to: TRAINER_PATHS.git },
    { id: 'english', text: t.trainers.english, to: TRAINER_PATHS.english },
  ] as const

  return (
    <Window title={t.trainers.windowTitle} titleAs="p" className="mx-auto max-w-[960px]">
      <PageHeading>{t.trainers.heading}</PageHeading>
      <p className="mt-4 max-w-[60ch]">{t.trainers.intro}</p>
      <ul className="m-0 mt-8 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2">
        {cards.map((card) => (
          <li
            key={card.id}
            className="flex flex-col items-start gap-3 rounded-button border border-border bg-window p-5"
          >
            <h2 className="m-0 text-xl font-semibold [overflow-wrap:anywhere]">{card.text.title}</h2>
            <p className="m-0 flex-1 text-[15px] text-muted">{card.text.description}</p>
            <LinkButton to={card.to} variant="primary" aria-label={t.trainers.ctaAriaLabel(card.text.title)}>
              {t.trainers.cta}
            </LinkButton>
          </li>
        ))}
      </ul>
    </Window>
  )
}
