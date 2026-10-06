import { Button } from './components/Button'
import { Chip } from './components/Chip'
import { ContactsWindow } from './components/ContactsWindow'
import { Header } from './components/Header'
import { ProjectList } from './components/ProjectList'
import { Window } from './components/Window'
import { dictionary as t } from './i18n'

// Single page, three sections with anchors (no router).
function App() {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-8">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:inline-flex focus:min-h-11 focus:items-center focus:bg-window focus:px-3"
      >
        {t.skipLink}
      </a>
      <Header logo={t.logo} nav={t.nav} />
      <main id="main" className="mt-8 flex flex-col gap-11">
        <Window id="home" title={t.home.windowTitle} titleAs="p" pixelTitle className="scroll-mt-6">
          <h1 className="m-0 text-[2.25rem] leading-[1.08] font-semibold tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-[3.5rem]">
            {t.home.heading}
          </h1>
          <p className="mt-4 mb-6 max-w-[60ch]">{t.home.lead}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" href={t.home.primaryCta.href}>
              {t.home.primaryCta.label}
            </Button>
            <Button href={t.home.secondaryCta.href}>{t.home.secondaryCta.label}</Button>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {t.home.chips.map((chip) => (
              <Chip key={chip.label} {...chip} />
            ))}
          </div>
        </Window>

        <div id="projects" className="grid scroll-mt-6 gap-11 lg:grid-cols-[2fr_1fr]">
          <Window title={t.projects.windowTitle}>
            <ProjectList items={t.projects.items} />
          </Window>
          <Window title={t.trainer.windowTitle} variant="striped" titleAs="h2">
            <h3 className="m-0 mb-2 text-xl font-semibold">{t.trainer.heading}</h3>
            <p className="m-0 mb-4 text-[15px] text-muted">{t.trainer.body}</p>
            <Chip {...t.trainer.chip} />
          </Window>
        </div>

        <ContactsWindow
          id="contacts"
          title={t.contacts.windowTitle}
          intro={t.contacts.intro}
          items={t.contacts.items}
        />
      </main>
    </div>
  )
}

export default App
