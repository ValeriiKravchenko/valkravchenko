import { screen, within } from '@testing-library/react'
import { REPO_URL } from '../data/aboutPaths'
import { dictionary as t } from '../i18n'
import { renderAt } from '../test/renderAt'

const menu = () => screen.getByRole('navigation', { name: t.nav.ariaLabel })
const dock = () => screen.getByRole('navigation', { name: t.dock.ariaLabel })

describe('trainers showcase', () => {
  it('/trainers shows the window with an h1 and two cards', () => {
    renderAt('/trainers')
    const win = screen.getByRole('region', { name: t.trainers.windowTitle })
    expect(within(win).getByRole('heading', { level: 1 })).toHaveTextContent(t.trainers.heading)
    expect(within(win).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      t.trainers.git.title,
      t.trainers.english.title,
    ])
    expect(document.title).toBe('Тренажёры — Валерий Кравченко')
  })

  it('describes each trainer with its existing text', () => {
    renderAt('/trainers')
    expect(screen.getByText(t.trainers.git.description)).toBeInTheDocument()
    expect(screen.getByText(t.trainers.english.description)).toBeInTheDocument()
  })

  it('opens each trainer with a plain anchor to /trainers-app/ (no router link)', () => {
    renderAt('/trainers')
    for (const title of [t.trainers.git.title, t.trainers.english.title]) {
      const link = screen.getByRole('link', { name: t.trainers.ctaAriaLabel(title) })
      expect(link.tagName).toBe('A')
      expect(link).toHaveAttribute('href', '/trainers-app/')
      expect(link).toHaveTextContent(t.trainers.cta)
      expect(link).not.toHaveAttribute('target')
      expect(link).not.toHaveAttribute('data-discover')
    }
  })

  it('does not hijack the click: the browser handles the navigation', async () => {
    const { router } = renderAt('/trainers')
    const link = screen.getByRole('link', { name: t.trainers.ctaAriaLabel(t.trainers.git.title) })
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(router.state.location.pathname).toBe('/trainers')
  })

  it('says next to each link that launching is for the owner only and links the repository', () => {
    renderAt('/trainers')
    const notes = screen.getAllByText(t.trainers.showcase.note, { exact: false })
    expect(notes).toHaveLength(2)
    for (const note of notes) {
      const repo = within(note).getByRole('link')
      expect(repo).toHaveAttribute('href', REPO_URL)
      expect(repo).toHaveAttribute('href', 'https://github.com/ValeriiKravchenko/valkravchenko')
      expect(repo).toHaveAttribute('target', '_blank')
      expect(repo).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  it('does not mention Git sections 7 and 8 and shows no section list', () => {
    renderAt('/trainers')
    expect(screen.queryByRole('list', { name: t.trainers.gitSectionsLabel })).toBeNull()
    expect(screen.getByRole('region', { name: t.trainers.windowTitle }).textContent).not.toMatch(/[78]/)
  })

  it('keeps the heading order: one h1, then an h2 per card, no h3', () => {
    renderAt('/trainers')
    const levels = screen.getAllByRole('heading').map((h) => Number(h.tagName.slice(1)))
    expect(levels[0]).toBe(1)
    expect(levels.filter((l) => l === 2)).toHaveLength(2)
    expect(levels).not.toContain(3)
  })

  it('the trainers entry is in the menu and the dock with a name, a title and an icon', () => {
    renderAt('/')
    const link = within(dock()).getByRole('link', { name: t.nav.labels.trainers })
    expect(link).toHaveAttribute('title', t.nav.labels.trainers)
    expect(link).toHaveAttribute('href', '/trainers')
    expect(link.querySelector('svg')).not.toBeNull()
    expect(within(menu()).getByRole('link', { name: t.nav.labels.trainers })).toHaveAttribute('href', '/trainers')
    expect(link).toHaveTextContent(t.dock.shortLabels.trainers!)
  })

  it('marks the trainers entry current at /trainers and keeps home not current', () => {
    renderAt('/trainers')
    for (const nav of [menu(), dock()]) {
      const current = within(nav)
        .getAllByRole('link')
        .filter((a) => a.getAttribute('aria-current') === 'page')
      expect(current).toHaveLength(1)
      expect(current[0]).toHaveAttribute('href', '/trainers')
    }
    expect(within(menu()).getByRole('link', { name: t.nav.labels.home })).not.toHaveAttribute('aria-current')
  })
})
