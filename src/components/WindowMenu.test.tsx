import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { getSectionPath } from '../data/sections'
import { dictionary } from '../i18n'
import { ThemeToggle } from './ThemeToggle'
import { Window } from './Window'

const t = dictionary.windowMenu
const root = () => document.documentElement

function renderPage(ui = <Window title="One">x</Window>) {
  const router = createMemoryRouter([{ path: '*', element: ui }], { initialEntries: ['/projects'] })
  return { router, ...render(<RouterProvider router={router} />) }
}

function twoWindows() {
  return renderPage(
    <>
      <ThemeToggle />
      <Window title="One">a</Window>
      <Window title="Two">b</Window>
    </>,
  )
}

const viewButtons = () => screen.getAllByRole('button', { name: t.view.button })
const helpButtons = () => screen.getAllByRole('button', { name: t.help.button })

afterEach(() => {
  localStorage.clear()
  root().removeAttribute('data-theme')
  vi.restoreAllMocks()
})

describe('WindowMenu', () => {
  it('has only view and help, no file or edit', () => {
    renderPage()
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['view', 'help'])
    expect(screen.queryByText('file')).not.toBeInTheDocument()
    expect(screen.queryByText('edit')).not.toBeInTheDocument()
  })

  it('is hidden on narrow screens (hidden sm:flex)', () => {
    renderPage()
    const group = viewButtons()[0].parentElement!.parentElement!
    expect(group).toHaveClass('hidden', 'sm:flex')
  })

  it('is closed by default', () => {
    renderPage()
    for (const button of [...viewButtons(), ...helpButtons()]) {
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(button).toHaveAttribute('aria-controls')
    }
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('the button opens and closes the list and keeps aria-controls pointing at it', async () => {
    renderPage()
    const [button] = viewButtons()
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    const list = screen.getByRole('list', { name: t.view.listLabel })
    expect(list).toHaveAttribute('id', button.getAttribute('aria-controls'))
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('the list is fixed so the window overflow-hidden does not clip it, and sits above the dock', async () => {
    renderPage()
    await userEvent.click(viewButtons()[0])
    const list = screen.getByRole('list', { name: t.view.listLabel })
    expect(list).toHaveClass('fixed', 'z-40')
    expect(screen.getByRole('region', { name: 'One' })).toHaveClass('overflow-hidden')
  })

  it('does not use role=menu (disclosure pattern)', async () => {
    renderPage()
    await userEvent.click(viewButtons()[0])
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('Escape closes the list and returns focus to the button', async () => {
    renderPage()
    const [button] = viewButtons()
    await userEvent.click(button)
    await userEvent.tab()
    expect(screen.getByRole('button', { name: t.view.themeDay })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('a click outside closes the list', async () => {
    renderPage(
      <>
        <p>outside</p>
        <Window title="One">a</Window>
      </>,
    )
    await userEvent.click(viewButtons()[0])
    expect(screen.getByRole('list')).toBeInTheDocument()
    await userEvent.click(screen.getByText('outside'))
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('opening a second menu closes the first, also in another window', async () => {
    renderPage(
      <>
        <Window title="One">a</Window>
        <Window title="Two">b</Window>
      </>,
    )
    await userEvent.click(viewButtons()[0])
    await userEvent.click(helpButtons()[0])
    expect(viewButtons()[0]).toHaveAttribute('aria-expanded', 'false')
    expect(helpButtons()[0]).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(viewButtons()[1])
    expect(helpButtons()[0]).toHaveAttribute('aria-expanded', 'false')
    expect(viewButtons()[1]).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('list')).toHaveLength(1)
  })

  it('Tab leaves the menu without a trap and closes it', async () => {
    renderPage(
      <>
        <Window title="One">a</Window>
        <button type="button">after</button>
      </>,
    )
    await userEvent.click(viewButtons()[0])
    await userEvent.tab() // day
    await userEvent.tab() // night
    await userEvent.tab() // help button
    expect(helpButtons()[0]).toHaveFocus()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus()
  })

  describe('view: theme', () => {
    it('marks the current theme with aria-pressed', async () => {
      renderPage()
      await userEvent.click(viewButtons()[0])
      const day = screen.getByRole('button', { name: t.view.themeDay })
      const night = screen.getByRole('button', { name: t.view.themeNight })
      expect(day).toHaveAttribute('aria-pressed', 'true')
      expect(night).toHaveAttribute('aria-pressed', 'false')
    })

    it('choosing night sets data-theme, aria-pressed, stores it and closes the list', async () => {
      renderPage()
      await userEvent.click(viewButtons()[0])
      await userEvent.click(screen.getByRole('button', { name: t.view.themeNight }))
      expect(root()).toHaveAttribute('data-theme', 'night')
      expect(localStorage.getItem('sky-os.theme')).toBe('night')
      expect(screen.queryByRole('list')).not.toBeInTheDocument()
      expect(viewButtons()[0]).toHaveFocus()
      await userEvent.click(viewButtons()[0])
      expect(screen.getByRole('button', { name: t.view.themeNight })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: t.view.themeDay })).toHaveAttribute('aria-pressed', 'false')
    })

    it('choosing the current theme again does not flip it', async () => {
      renderPage()
      await userEvent.click(viewButtons()[0])
      await userEvent.click(screen.getByRole('button', { name: t.view.themeDay }))
      expect(root()).toHaveAttribute('data-theme', 'day')
    })

    it('stays in sync with the ThemeToggle and with the menu of another window', async () => {
      twoWindows()
      await userEvent.click(viewButtons()[0])
      await userEvent.click(screen.getByRole('button', { name: t.view.themeNight }))
      expect(screen.getByRole('button', { name: dictionary.theme.ariaLabels.night })).toBeInTheDocument()
      await userEvent.click(viewButtons()[1])
      expect(screen.getByRole('button', { name: t.view.themeNight })).toHaveAttribute('aria-pressed', 'true')
      // And back: the toggle in the bar changes what the menu shows.
      await userEvent.click(screen.getByRole('button', { name: dictionary.theme.ariaLabels.night }))
      expect(root()).toHaveAttribute('data-theme', 'day')
      await userEvent.click(viewButtons()[1])
      expect(screen.getByRole('button', { name: t.view.themeDay })).toHaveAttribute('aria-pressed', 'true')
    })

    it('works when the storage throws', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked')
      })
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked')
      })
      renderPage()
      await userEvent.click(viewButtons()[0])
      await userEvent.click(screen.getByRole('button', { name: t.view.themeNight }))
      expect(root()).toHaveAttribute('data-theme', 'night')
      await userEvent.click(viewButtons()[0])
      expect(screen.getByRole('button', { name: t.view.themeNight })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('help', () => {
    it('"About me" is a link to the home section path from the registry', async () => {
      const { router } = renderPage()
      await userEvent.click(helpButtons()[0])
      const list = screen.getByRole('list', { name: t.help.listLabel })
      const link = within(list).getByRole('link', { name: t.help.about })
      expect(link).toHaveAttribute('href', getSectionPath('home'))
      await userEvent.click(link)
      expect(router.state.location.pathname).toBe(getSectionPath('home'))
      expect(screen.queryByRole('list')).not.toBeInTheDocument()
    })
  })

  it('closing state is reset when a window unmounts while open', async () => {
    const { unmount } = renderPage()
    await userEvent.click(viewButtons()[0])
    unmount()
    renderPage()
    expect(viewButtons()[0]).toHaveAttribute('aria-expanded', 'false')
    await act(async () => {})
  })
})
