import { LinkButton } from '../components/LinkButton'
import { PageHeading } from '../components/PageHeading'
import { Window } from '../components/Window'
import { GITHUB_PROFILE_URL } from '../data/aboutPaths'
import { getSectionPath, SECTIONS, type Section } from '../data/sections'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { pageTitle } from '../i18n/pageTitle'
import { useDictionary } from '../i18n'
import photo440 from '../assets/about/about-440x550.webp'
import photo760 from '../assets/about/about-760x950.webp'
import { buttonClasses } from '../components/buttonClasses'

export function AboutPage({ sections = SECTIONS }: { sections?: readonly Section[] }) {
  const t = useDictionary()
  useDocumentTitle(pageTitle(t, t.about.heading))

  const projectsPath = getSectionPath('projects', sections)
  const contactsPath = getSectionPath('contacts', sections)

  return (
    <div className="mx-auto max-w-[960px]">
      <Window title={t.about.windowTitle} titleAs="p">
        <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-[280px_minmax(0,1fr)] sm:gap-8">
          <img
            src={photo440}
            srcSet={`${photo440} 440w, ${photo760} 760w`}
            sizes="(min-width: 640px) 280px, min(440px, 100vw)"
            width={440}
            height={550}
            alt={t.about.photoAlt}
            decoding="async"
            className="mx-auto h-auto w-full max-w-[440px] rounded-window border border-border object-cover sm:mx-0"
          />
          <div>
            <PageHeading>{t.about.heading}</PageHeading>
            {t.about.paragraphs.map((text) => (
              <p key={text} className="mt-4 max-w-[60ch]">
                {text}
              </p>
            ))}
            <div className="mt-6 flex flex-wrap items-center gap-4">
              {projectsPath && (
                <LinkButton to={projectsPath} variant="primary">
                  {t.about.buttons.projects}
                </LinkButton>
              )}
              <a
                href={GITHUB_PROFILE_URL}
                rel="noopener noreferrer"
                className={buttonClasses('secondary')}
              >
                {t.about.buttons.github}
              </a>
              {contactsPath && (
                <LinkButton to={contactsPath} variant="secondary">
                  {t.about.buttons.contacts}
                </LinkButton>
              )}
            </div>
          </div>
        </div>
      </Window>
    </div>
  )
}
