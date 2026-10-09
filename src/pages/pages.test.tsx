import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { books } from '../data/library'
import { PROJECTS } from '../data/projects'
import { SECTIONS } from '../data/sections'
import { dictionary as t } from '../i18n'
import { pageTitle } from '../i18n/pageTitle'
import { AutomationPage } from './AutomationPage'
import { ContactsPage } from './ContactsPage'
import { HomePage } from './HomePage'
import { NotFoundPage } from './NotFoundPage'
import { ProjectsPage } from './ProjectsPage'

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('pages', () => {
  it('HomePage has a focusable h1 and links to projects and contacts', () => {
    wrap(<HomePage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('link', { name: t.home.primaryCta.label })).toHaveAttribute('href', '/projects')
    expect(screen.getByRole('link', { name: t.home.secondaryCta.label })).toHaveAttribute('href', '/contacts')
    expect(document.title).toBe(pageTitle(t))
  })

  it('ProjectsPage lists five projects: repository links open a new tab, the trainer link stays on site', () => {
    const { container } = wrap(<ProjectsPage />)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(PROJECTS.length)
    expect(PROJECTS).toHaveLength(5)
    for (const project of PROJECTS.filter((p) => p.url)) {
      const title = t.projects.texts[project.id].title
      const link = screen.getByRole('link', {
        name: `${t.projects.linkLabel}: ${title} ${t.projects.newTabNote}`,
      })
      expect(link).toHaveAttribute('href', project.url)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      expect(link.getAttribute('aria-label')).toContain('(откроется в новой вкладке)')
    }
    expect(container.querySelectorAll('[data-variant="striped"]')).toHaveLength(0)
    expect(document.title).toBe(pageTitle(t, t.projects.heading))
  })

  it('ProjectsPage has the Git trainer card with an in-site link and no English card', () => {
    wrap(<ProjectsPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.projects.heading)
    const card = PROJECTS.find((p) => p.id === 'git-trainer')!
    const title = t.projects.texts['git-trainer'].title
    expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: `${t.projects.pathLinkLabel}: ${title}` })
    expect(link).toHaveAttribute('href', SECTIONS.find((s) => s.id === 'trainers')!.path)
    expect(link).toHaveAttribute('href', card.path)
    expect(link).not.toHaveAttribute('target')
    expect(screen.getByRole('list', { name: `${t.projects.tagsLabel}: ${title}` })).toBeInTheDocument()
    const description = t.projects.texts['git-trainer'].description
    expect(description).not.toMatch(/скоро|раздел\S* [78]/i)
    expect(description).not.toMatch(/[78]/)
    expect(screen.queryByRole('heading', { name: /англий|english/i })).toBeNull()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(
      PROJECTS.map((p) => t.projects.texts[p.id].title),
    )
  })

  it('AutomationPage has a table with headers and only automation projects', () => {
    wrap(<AutomationPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Автоматизация')
    expect(screen.getByText(t.automation.intro)).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      t.automation.tableHeaders.stage,
      t.automation.tableHeaders.action,
    ])
    expect(within(table).getAllByRole('row')).toHaveLength(t.automation.workflow.length + 1)
    expect(screen.getByText(t.automation.tools)).toBeInTheDocument()
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titles).toEqual(['bank-statement-automation', 'payment-registry-automation'])
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(document.title).toBe('Автоматизация — Валерий Кравченко')
  })

  it('HomePage chips count projects and books from the data', () => {
    wrap(<HomePage />)
    const projects = screen.getByText(t.home.chipLabels.projects).parentElement!
    const booksChip = screen.getByText(t.home.chipLabels.books).parentElement!
    expect(within(projects).getByText(String(PROJECTS.length))).toBeInTheDocument()
    expect(within(booksChip).getByText(String(books.length))).toBeInTheDocument()
    expect(screen.queryByText('[число]')).toBeNull()
  })

  it('HomePage has the welcome, terminal and before/after windows', () => {
    wrap(<HomePage />)
    expect(screen.getByRole('region', { name: 'sky-os — главная' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: t.home.terminal.title })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'автоматизация — до / после' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('HomePage terminal lists every project from PROJECTS', () => {
    wrap(<HomePage />)
    const terminal = screen.getByRole('region', { name: t.home.terminal.title })
    const list = within(terminal).getByRole('list', { name: t.home.terminal.listCommand })
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      PROJECTS.map((project) => project.id),
    )
    expect(terminal).toHaveTextContent(`${t.home.terminal.host}:~$ ${t.home.terminal.listCommand}`)
    expect(terminal).toHaveTextContent(`${t.home.terminal.host}:~$ ${t.home.terminal.readCommand}`)
    expect(within(terminal).getByText(t.home.terminal.note)).toBeInTheDocument()
  })

  it('HomePage before/after window shows the automation results', () => {
    wrap(<HomePage />)
    const win = screen.getByRole('region', { name: t.home.beforeAfter.title })
    expect(win).toHaveTextContent('bank-statement-automation')
    expect(win).toHaveTextContent('несколько часов')
    expect(win).toHaveTextContent('20–30 секунд')
    expect(win).toHaveTextContent('payment-registry-automation')
    expect(win).toHaveTextContent('[до]')
    expect(win).toHaveTextContent('[после]')
  })

  it('every page window is titled "sky-os — <section>"', () => {
    expect(t.home.windowTitle).toBe('sky-os — главная')
    expect(t.projects.windowTitle).toBe('sky-os — проекты')
    expect(t.automation.windowTitle).toBe('sky-os — автоматизация')
    expect(t.library.windowTitle).toBe('sky-os — библиотека')
    expect(t.contacts.windowTitle).toBe('sky-os — контакты')
  })

  it('ContactsPage shows placeholder contacts only', () => {
    wrap(<ContactsPage />)
    expect(screen.getByText('[email]')).toBeInTheDocument()
    expect(document.title).toBe(pageTitle(t, t.contacts.heading))
  })

  it('NotFoundPage links home', () => {
    wrap(<NotFoundPage />)
    expect(screen.getByRole('link', { name: t.notFound.homeLink })).toHaveAttribute('href', '/')
    expect(document.title).toBe(pageTitle(t, t.notFound.heading))
  })
})
