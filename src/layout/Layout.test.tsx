import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getEnabledSections } from '../data/sections'
import { dictionary as t } from '../i18n'
import { renderAt } from '../test/renderAt'

const enabled = getEnabledSections()
const menu = () => screen.getByRole('navigation', { name: t.nav.ariaLabel })
const dock = () => screen.getByRole('navigation', { name: t.dock.ariaLabel })

describe('Layout', () => {
  it('renders skip link, banner, two navigation landmarks, main and footer', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: t.skipLink })).toBeInTheDocument()
    expect(screen.getAllByRole('banner')).toHaveLength(1)
    expect(screen.getAllByRole('navigation')).toHaveLength(2)
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getByRole('contentinfo')).toHaveTextContent(t.footer.text)
  })

  it('has two navigation landmarks with different names', () => {
    renderAt('/')
    expect(t.nav.ariaLabel).toBe('Основная навигация')
    expect(t.dock.ariaLabel).toBe('Док')
    expect(menu()).not.toBe(dock())
  })

  it('logo links to the home path', () => {
    renderAt('/contacts')
    const logo = screen.getByRole('link', { name: t.logo.ariaLabel })
    expect(logo).toHaveAttribute('href', '/')
    expect(logo).toHaveTextContent('sky-os')
  })

  it('menu and dock are built from the same enabled sections', () => {
    renderAt('/')
    const menuLabels = within(menu()).getAllByRole('link').map((a) => a.textContent)
    const dockLabels = within(dock()).getAllByRole('link').map((a) => a.getAttribute('aria-label'))
    const expected = enabled.map((s) => t.nav.labels[s.id])
    expect(menuLabels).toEqual(expected)
    expect(dockLabels).toEqual(expected)
  })

  it('dock links have aria-label, title and an inline SVG icon without emoji', () => {
    renderAt('/')
    const links = within(dock()).getAllByRole('link')
    expect(links).toHaveLength(enabled.length)
    links.forEach((link, index) => {
      const label = t.nav.labels[enabled[index].id]
      expect(link).toHaveAttribute('aria-label', label)
      expect(link).toHaveAttribute('title', label)
      expect(link).toHaveAttribute('href', enabled[index].path)
      expect(link.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
      expect(link.textContent ?? '').not.toMatch(/\p{Extended_Pictographic}/u)
    })
  })

  it.each([
    ['/projects', 'projects'],
    ['/automation', 'automation'],
    ['/library', 'library'],
    ['/contacts', 'contacts'],
    ['/', 'home'],
  ] as const)('marks the current page with aria-current in menu and dock at %s', (path, id) => {
    renderAt(path)
    for (const nav of [menu(), dock()]) {
      const current = within(nav)
        .getAllByRole('link')
        .filter((a) => a.getAttribute('aria-current') === 'page')
      expect(current).toHaveLength(1)
      expect(current[0]).toHaveAttribute('href', enabled.find((s) => s.id === id)!.path)
    }
  })

  it('desk icons are hidden from assistive tech and from the Tab order', () => {
    const { container } = renderAt('/')
    const icons = container.querySelectorAll('a[data-desk-icon]')
    expect(icons).toHaveLength(enabled.length)
    icons.forEach((icon) => {
      expect(icon).toHaveAttribute('aria-hidden', 'true')
      expect(icon).toHaveAttribute('tabindex', '-1')
    })
    // Hidden icons are not in the accessibility tree: only the menu and dock links are found.
    expect(screen.getAllByRole('link', { name: t.nav.labels.library })).toHaveLength(2)
  })

  it('Tab skips the desk icons', async () => {
    const { container } = renderAt('/')
    const user = userEvent.setup()
    const visited = new Set<Element>()
    for (let i = 0; i < 40; i += 1) {
      await user.tab()
      visited.add(document.activeElement!)
    }
    container.querySelectorAll('a[data-desk-icon]').forEach((icon) => {
      expect(visited.has(icon)).toBe(false)
    })
    expect(visited.size).toBeGreaterThan(5)
  })

  it('system bar has a theme button and decorative language and user', () => {
    renderAt('/')
    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('button', { name: /^Тема:/ })).toBeInTheDocument()
    const user = within(banner).getByText(t.systemBar.user)
    expect(user).toHaveAttribute('aria-hidden', 'true')
    expect(within(banner).getByText(t.systemBar.language)).toHaveAttribute('aria-hidden', 'true')
  })
})
