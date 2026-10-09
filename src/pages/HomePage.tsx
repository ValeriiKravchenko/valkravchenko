import { BeforeAfterWindow } from '../components/BeforeAfterWindow'
import { Chip } from '../components/Chip'
import { LinkButton } from '../components/LinkButton'
import { PageHeading } from '../components/PageHeading'
import { TerminalWindow } from '../components/TerminalWindow'
import { Window } from '../components/Window'
import { books } from '../data/library'
import { PROJECTS } from '../data/projects'
import { getSectionPath, SECTIONS, type Section } from '../data/sections'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { pageTitle } from '../i18n/pageTitle'
import { useDictionary } from '../i18n'

export function HomePage({ sections = SECTIONS }: { sections?: readonly Section[] }) {
  const t = useDictionary()
  useDocumentTitle(pageTitle(t))

  const ctas = [
    { cta: t.home.primaryCta, variant: 'primary' as const },
    { cta: t.home.secondaryCta, variant: 'secondary' as const },
  ].flatMap(({ cta, variant }) => {
    const to = getSectionPath(cta.section, sections)
    return to ? [{ to, label: cta.label, variant }] : []
  })

  const chips = [
    { label: t.home.chipLabels.projects, count: String(PROJECTS.length) },
    { label: t.home.chipLabels.books, count: String(books.length) },
  ]

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[2fr_1fr]">
      <Window title={t.home.windowTitle} titleAs="p">
        <PageHeading>{t.home.heading}</PageHeading>
        <p className="mt-4 mb-6 max-w-[60ch]">{t.home.lead}</p>
        <div className="flex flex-wrap items-center gap-4">
          {ctas.map((item) => (
            <LinkButton key={item.to} to={item.to} variant={item.variant}>
              {item.label}
            </LinkButton>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Chip key={chip.label} {...chip} />
          ))}
        </div>
      </Window>
      <div className="flex min-w-0 flex-col gap-6">
        <TerminalWindow />
        <BeforeAfterWindow />
      </div>
    </div>
  )
}
