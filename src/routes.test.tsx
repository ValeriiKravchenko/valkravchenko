import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SECTIONS } from './data/sections'
import { dictionary as t } from './i18n'
import { pageTitle } from './i18n/pageTitle'
import { HomePage } from './pages/HomePage'
import { buildRoutes } from './routes'
import { renderAt } from './test/renderAt'

const h1 = () => screen.getByRole('heading', { level: 1 })
const navLink = (name: string) =>
  within(screen.getByRole('navigation', { name: t.nav.ariaLabel })).getByRole('link', { name })

describe('routes', () => {
  it.each([
    ['/', t.home.heading],
    ['/projects', t.projects.heading],
    ['/automation', t.automation.heading],
    ['/contacts', t.contacts.heading],
  ])('opens %s with its own h1', (path, heading) => {
    renderAt(path)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(h1()).toHaveTextContent(heading)
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('shows 404 with a link home for an unknown path', () => {
    renderAt('/nope')
    expect(h1()).toHaveTextContent(t.notFound.heading)
    expect(screen.getByRole('link', { name: t.notFound.homeLink })).toHaveAttribute('href', '/')
  })

  it('does not route disabled sections: they open 404', () => {
    renderAt('/java')
    expect(h1()).toHaveTextContent(t.notFound.heading)
  })

  it('throws when an enabled section has no page', () => {
    const sections = [...SECTIONS, { id: 'java', path: '/java', enabled: true } as const]
    expect(() => buildRoutes(sections)).toThrow(/java/)
  })

  it.each([
    ['/', 0],
    ['/projects', 0],
    ['/automation', 0],
    ['/contacts', 0],
    ['/nope', 0],
  ])('has the expected number of striped windows at %s', (path, count) => {
    const { container } = renderAt(path)
    expect(container.querySelectorAll('[data-variant="striped"]')).toHaveLength(count)
  })

  it('shows contact placeholders only', () => {
    renderAt('/contacts')
    expect(screen.getByText('[email]')).toBeInTheDocument()
    expect(screen.getByText('[github]')).toBeInTheDocument()
  })
})

describe('menu and registry', () => {
  it('lists enabled sections only, in registry order', () => {
    renderAt('/')
    const nav = screen.getByRole('navigation', { name: t.nav.ariaLabel })
    const labels = within(nav)
      .getAllByRole('link')
      .map((a) => a.textContent)
    expect(labels).toEqual([
      t.nav.labels.home,
      t.nav.labels.projects,
      t.nav.labels.automation,
      t.nav.labels.contacts,
    ])
    for (const id of ['java', 'basics', 'trainers', 'library'] as const) {
      expect(within(nav).queryByText(t.nav.labels[id])).toBeNull()
    }
  })

  it('marks the active item with aria-current="page"', () => {
    renderAt('/projects')
    expect(navLink(t.nav.labels.projects)).toHaveAttribute('aria-current', 'page')
    expect(navLink(t.nav.labels.home)).not.toHaveAttribute('aria-current')
  })

  it('has «Автоматизация» in the menu, marked current on its page', () => {
    renderAt('/automation')
    expect(navLink('Автоматизация')).toHaveAttribute('aria-current', 'page')
    expect(navLink(t.nav.labels.projects)).not.toHaveAttribute('aria-current')
  })

  it('shows a newly enabled section in the menu and routes (registry drives both)', () => {
    const sections = SECTIONS.map((s) => (s.id === 'java' ? { ...s, enabled: true } : s))
    const Java = () => <h1>Java page</h1>
    const routes = buildRoutes(sections, {
      home: () => <h1>Home</h1>,
      projects: () => <h1>P</h1>,
      automation: () => <h1>A</h1>,
      contacts: () => <h1>C</h1>,
      java: Java,
    })
    renderAt('/java', routes)
    expect(h1()).toHaveTextContent('Java page')
    expect(navLink(t.nav.labels.java)).toHaveAttribute('aria-current', 'page')
  })

  it('does not link a disabled section from the home page', () => {
    const sections = SECTIONS.map((s) => (s.id === 'projects' ? { ...s, enabled: false } : s))
    const routes = buildRoutes(sections, {
      home: HomePage,
      automation: () => <h1>A</h1>,
      contacts: () => <h1>C</h1>,
    })
    renderAt('/', routes)
    const main = screen.getByRole('main')
    expect(within(main).queryByRole('link', { name: t.home.primaryCta.label })).toBeNull()
    expect(within(main).getByRole('link', { name: t.home.secondaryCta.label })).toHaveAttribute('href', '/contacts')
  })
})

describe('navigation behaviour', () => {
  it('links home page CTAs to the sections', () => {
    renderAt('/')
    const main = screen.getByRole('main')
    expect(within(main).getByRole('link', { name: t.home.primaryCta.label })).toHaveAttribute('href', '/projects')
    expect(within(main).getByRole('link', { name: t.home.secondaryCta.label })).toHaveAttribute('href', '/contacts')
  })

  it('moves focus to the h1 and scrolls to top after a transition', async () => {
    renderAt('/')
    const user = userEvent.setup()
    await user.click(navLink(t.nav.labels.contacts))
    expect(h1()).toHaveTextContent(t.contacts.heading)
    expect(h1()).toHaveFocus()
    expect(window.scrollTo).toHaveBeenCalledTimes(1)
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
    await user.click(navLink(t.nav.labels.projects))
    expect(window.scrollTo).toHaveBeenCalledTimes(2)
  })

  it('moves focus to main when the page has no h1', async () => {
    const routes = buildRoutes(SECTIONS, {
      home: HomePage,
      projects: () => <p>No heading here</p>,
      automation: () => <h1>A</h1>,
      contacts: () => <h1>C</h1>,
    })
    renderAt('/', routes)
    await userEvent.setup().click(navLink(t.nav.labels.projects))
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('does not steal focus on the first render', () => {
    renderAt('/')
    expect(h1()).not.toHaveFocus()
  })

  it('has the skip link first in the tab order', async () => {
    renderAt('/projects')
    await userEvent.setup().tab()
    const skip = screen.getByRole('link', { name: t.skipLink })
    expect(skip).toHaveFocus()
    expect(skip).toHaveAttribute('href', '#main')
    expect(document.getElementById('main')).not.toBeNull()
  })

  it('moves focus to main when the skip link is activated', async () => {
    renderAt('/projects')
    const user = userEvent.setup()
    await user.tab()
    expect(screen.getByRole('link', { name: t.skipLink })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('updates document.title per page', async () => {
    renderAt('/')
    expect(document.title).toBe(pageTitle(t))
    const user = userEvent.setup()
    await user.click(navLink(t.nav.labels.projects))
    expect(document.title).toBe(pageTitle(t, t.projects.heading))
    await user.click(navLink(t.nav.labels.contacts))
    expect(document.title).toBe(pageTitle(t, t.contacts.heading))
  })

  it('sets the 404 title', () => {
    renderAt('/missing')
    expect(document.title).toBe(pageTitle(t, t.notFound.heading))
  })
})
