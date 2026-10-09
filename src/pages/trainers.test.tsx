import { screen, within } from '@testing-library/react'
import { TRAINER_PATHS } from '../data/trainerPaths'
import { dictionary as t } from '../i18n'
import { renderAt } from '../test/renderAt'

const GIT_PATHS = [
  TRAINER_PATHS.git,
  TRAINER_PATHS.branching,
  TRAINER_PATHS.inspecting,
  TRAINER_PATHS.undoing,
  TRAINER_PATHS.collaborating,
  TRAINER_PATHS.searching,
]

const menu = () => screen.getByRole('navigation', { name: t.nav.ariaLabel })
const dock = () => screen.getByRole('navigation', { name: t.dock.ariaLabel })

describe('trainers pages', () => {
  it('/trainers shows the window with two cards and no placeholders', () => {
    renderAt('/trainers')
    const win = screen.getByRole('region', { name: t.trainers.windowTitle })
    expect(within(win).getByRole('heading', { level: 1 })).toHaveTextContent(t.trainers.heading)
    const cardList = within(win).getAllByRole('list')[0]
    expect(within(cardList).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      t.trainers.git.title,
      t.trainers.english.title,
    ])
    expect(within(win).getByRole('link', { name: t.trainers.ctaAriaLabel(t.trainers.english.title) })).toHaveAttribute(
      'href',
      '/trainers/english',
    )
    expect(win.textContent ?? '').not.toMatch(/скоро/i)
  })

  it('the Git card lists all six sections as links with their number and name, in order', () => {
    renderAt('/trainers')
    const list = screen.getByRole('list', { name: t.trainers.gitSectionsLabel })
    const links = within(list).getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual(GIT_PATHS)
    expect(links.map((a) => a.textContent)).toEqual([
      t.trainers.gitSectionLink(1, t.trainers.git.listName),
      t.trainers.gitSectionLink(2, t.trainers.gitBranching.listName),
      t.trainers.gitSectionLink(3, t.trainers.gitInspecting.listName),
      t.trainers.gitSectionLink(4, t.trainers.gitUndoing.listName),
      t.trainers.gitSectionLink(5, t.trainers.gitCollaborating.listName),
      t.trainers.gitSectionLink(6, t.trainers.gitSearching.listName),
    ])
    links.forEach((a) => expect(a.className).toContain('min-h-12'))
  })

  it('keeps the heading order on /trainers: one h1, then an h2 per card, no h3', () => {
    renderAt('/trainers')
    const levels = screen.getAllByRole('heading').map((h) => Number(h.tagName.slice(1)))
    expect(levels.filter((l) => l === 1)).toHaveLength(1)
    expect(levels.filter((l) => l === 2)).toHaveLength(2)
    expect(levels).not.toContain(3)
  })

  it.each([
    [TRAINER_PATHS.git, t.trainers.git.windowTitle],
    [TRAINER_PATHS.branching, t.trainers.gitBranching.windowTitle],
    [TRAINER_PATHS.inspecting, t.trainers.gitInspecting.windowTitle],
    [TRAINER_PATHS.undoing, t.trainers.gitUndoing.windowTitle],
    [TRAINER_PATHS.collaborating, t.trainers.gitCollaborating.windowTitle],
    [TRAINER_PATHS.searching, t.trainers.gitSearching.windowTitle],
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

  it.each(['/trainers', ...GIT_PATHS, TRAINER_PATHS.english])(
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
