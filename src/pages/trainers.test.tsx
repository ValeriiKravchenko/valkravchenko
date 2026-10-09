import { screen, within } from '@testing-library/react'
import { TRAINER_PATHS } from '../data/trainerPaths'
import { dictionary as t } from '../i18n'
import { renderAt } from '../test/renderAt'

const menu = () => screen.getByRole('navigation', { name: t.nav.ariaLabel })
const dock = () => screen.getByRole('navigation', { name: t.dock.ariaLabel })

describe('trainers pages', () => {
  it('/trainers shows the window with two entry cards and no placeholders', () => {
    renderAt('/trainers')
    const win = screen.getByRole('region', { name: t.trainers.windowTitle })
    expect(within(win).getByRole('heading', { level: 1 })).toHaveTextContent(t.trainers.heading)
    const cards = within(win).getAllByRole('listitem')
    expect(cards).toHaveLength(2)
    expect(within(win).getByRole('link', { name: t.trainers.ctaAriaLabel(t.trainers.git.title) })).toHaveAttribute(
      'href',
      '/trainers/git/basics',
    )
    expect(within(win).getByRole('link', { name: t.trainers.ctaAriaLabel(t.trainers.english.title) })).toHaveAttribute(
      'href',
      '/trainers/english',
    )
    expect(win.textContent ?? '').not.toMatch(/скоро/i)
  })

  it.each([
    [TRAINER_PATHS.git, t.trainers.git.windowTitle],
    [TRAINER_PATHS.english, t.trainers.english.windowTitle],
  ])('%s opens through the router in the window "%s" with one h1', async (path, windowTitle) => {
    renderAt(path)
    const h1 = await screen.findByRole('heading', { level: 1 })
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('region', { name: windowTitle })).toContainElement(h1)
    expect(windowTitle).toMatch(/^sky-os — /)
    expect(screen.getByRole('link', { name: t.trainers.backLabel })).toHaveAttribute('href', '/trainers')
  })

  it('the trainers entry is in the menu and the dock with a name, a title and an icon', () => {
    renderAt('/')
    const link = within(dock()).getByRole('link', { name: t.nav.labels.trainers })
    expect(link).toHaveAttribute('title', t.nav.labels.trainers)
    expect(link).toHaveAttribute('href', '/trainers')
    expect(link.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(within(menu()).getByRole('link', { name: t.nav.labels.trainers })).toHaveAttribute('href', '/trainers')
  })

  it.each(['/trainers', TRAINER_PATHS.git, TRAINER_PATHS.english])(
    'marks the trainers entry current in the menu and the dock at %s',
    async (path) => {
      renderAt(path)
      await screen.findByRole('heading', { level: 1 })
      for (const nav of [menu(), dock()]) {
        const current = within(nav)
          .getAllByRole('link')
          .filter((a) => a.getAttribute('aria-current') === 'page')
        expect(current).toHaveLength(1)
        expect(current[0]).toHaveAttribute('href', '/trainers')
      }
    },
  )

  it('keeps home current only on the home page', () => {
    renderAt('/trainers')
    expect(within(menu()).getByRole('link', { name: t.nav.labels.home })).not.toHaveAttribute('aria-current')
  })

  it('has a short dock caption for the trainers entry', () => {
    renderAt('/')
    const link = within(dock()).getByRole('link', { name: t.nav.labels.trainers })
    expect(link).toHaveTextContent(t.dock.shortLabels.trainers!)
  })
})
