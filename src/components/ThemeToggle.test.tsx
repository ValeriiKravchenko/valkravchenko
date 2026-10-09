import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { dictionary as t } from '../i18n'
import { ThemeToggle } from './ThemeToggle'

type Listener = (event: { matches: boolean }) => void

/** Fake matchMedia whose result can be changed from the test. */
function mockSystemTheme(dark: boolean) {
  const listeners = new Set<Listener>()
  const media = {
    matches: dark,
    addEventListener: (_type: string, fn: Listener) => listeners.add(fn),
    removeEventListener: (_type: string, fn: Listener) => listeners.delete(fn),
  }
  window.matchMedia = vi.fn(() => media) as unknown as typeof window.matchMedia
  return {
    set(next: boolean) {
      media.matches = next
      act(() => listeners.forEach((fn) => fn({ matches: next })))
    },
    listenerCount: () => listeners.size,
  }
}

const root = () => document.documentElement
const button = (name: string) => screen.getByRole('button', { name })

afterEach(() => {
  localStorage.clear()
  root().removeAttribute('data-theme')
  // @ts-expect-error jsdom has no matchMedia: restore that state
  delete window.matchMedia
  vi.restoreAllMocks()
})

describe('ThemeToggle', () => {
  it('is a real button with a label and an aria-label for the current theme', () => {
    mockSystemTheme(false)
    render(<ThemeToggle />)
    const el = button(t.theme.ariaLabels.day)
    expect(el).toHaveAttribute('type', 'button')
    expect(el).toHaveTextContent(t.theme.labels.day)
    expect(t.theme.ariaLabels.day).toBe('Тема: день. Переключить на «Ночь»')
    expect(t.theme.ariaLabels.night).toBe('Тема: ночь. Переключить на «День»')
    expect(root()).toHaveAttribute('data-theme', 'day')
  })

  it('starts in the night theme when the system is dark', () => {
    mockSystemTheme(true)
    render(<ThemeToggle />)
    expect(button(t.theme.ariaLabels.night)).toHaveTextContent(t.theme.labels.night)
    expect(root()).toHaveAttribute('data-theme', 'night')
  })

  it('a click switches data-theme, label and aria-label and stores the choice', async () => {
    mockSystemTheme(false)
    render(<ThemeToggle />)
    await userEvent.click(button(t.theme.ariaLabels.day))
    expect(root()).toHaveAttribute('data-theme', 'night')
    expect(button(t.theme.ariaLabels.night)).toHaveTextContent(t.theme.labels.night)
    expect(localStorage.getItem('sky-os.theme')).toBe('night')
    await userEvent.click(button(t.theme.ariaLabels.night))
    expect(root()).toHaveAttribute('data-theme', 'day')
    expect(localStorage.getItem('sky-os.theme')).toBe('day')
  })

  it('uses the saved theme over the system one', () => {
    mockSystemTheme(true)
    localStorage.setItem('sky-os.theme', 'day')
    render(<ThemeToggle />)
    expect(root()).toHaveAttribute('data-theme', 'day')
  })

  it('ignores garbage in storage', () => {
    mockSystemTheme(true)
    localStorage.setItem('sky-os.theme', 'purple')
    render(<ThemeToggle />)
    expect(root()).toHaveAttribute('data-theme', 'night')
  })

  it('works when the storage throws', async () => {
    mockSystemTheme(false)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    render(<ThemeToggle />)
    await userEvent.click(button(t.theme.ariaLabels.day))
    expect(root()).toHaveAttribute('data-theme', 'night')
    expect(button(t.theme.ariaLabels.night)).toBeInTheDocument()
  })

  it('works without matchMedia', async () => {
    render(<ThemeToggle />)
    expect(root()).toHaveAttribute('data-theme', 'day')
    await userEvent.click(button(t.theme.ariaLabels.day))
    expect(root()).toHaveAttribute('data-theme', 'night')
  })

  it('falls back to day when matchMedia throws', async () => {
    window.matchMedia = vi.fn(() => {
      throw new Error('matchMedia is blocked')
    }) as unknown as typeof window.matchMedia
    render(<ThemeToggle />)
    expect(root()).toHaveAttribute('data-theme', 'day')
    await userEvent.click(button(t.theme.ariaLabels.day))
    expect(root()).toHaveAttribute('data-theme', 'night')
  })

  it('follows the system theme until the visitor chooses', async () => {
    const system = mockSystemTheme(false)
    render(<ThemeToggle />)
    system.set(true)
    expect(root()).toHaveAttribute('data-theme', 'night')
    system.set(false)
    expect(root()).toHaveAttribute('data-theme', 'day')
    await userEvent.click(button(t.theme.ariaLabels.day))
    expect(root()).toHaveAttribute('data-theme', 'night')
    system.set(false)
    expect(root()).toHaveAttribute('data-theme', 'night')
  })

  it('does not follow the system when a theme was saved earlier', () => {
    const system = mockSystemTheme(false)
    localStorage.setItem('sky-os.theme', 'day')
    render(<ThemeToggle />)
    system.set(true)
    expect(root()).toHaveAttribute('data-theme', 'day')
  })

  it('stops listening to the system on unmount', () => {
    const system = mockSystemTheme(false)
    const { unmount } = render(<ThemeToggle />)
    expect(system.listenerCount()).toBe(1)
    unmount()
    expect(system.listenerCount()).toBe(0)
  })
})

describe('ThemeToggle shares one theme with other components', () => {
  it('two toggles stay in sync', async () => {
    mockSystemTheme(false)
    render(
      <>
        <ThemeToggle />
        <ThemeToggle />
      </>,
    )
    await userEvent.click(screen.getAllByRole('button', { name: t.theme.ariaLabels.day })[0])
    expect(screen.getAllByRole('button', { name: t.theme.ariaLabels.night })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: t.theme.ariaLabels.day })).not.toBeInTheDocument()
  })
})
