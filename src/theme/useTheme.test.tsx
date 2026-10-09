import { act, render, renderHook, screen } from '@testing-library/react'
import { useTheme } from './useTheme'

const root = () => document.documentElement

function Probe({ name }: { name: string }) {
  const { theme } = useTheme()
  return <p data-testid={name}>{theme}</p>
}

afterEach(() => {
  localStorage.clear()
  root().removeAttribute('data-theme')
  vi.restoreAllMocks()
})

describe('useTheme', () => {
  it('starts in the day theme without matchMedia and a saved choice', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('day')
    expect(root()).toHaveAttribute('data-theme', 'day')
  })

  it('setTheme sets an explicit theme, not a toggle, and stores it', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('night'))
    act(() => result.current.setTheme('night'))
    expect(result.current.theme).toBe('night')
    expect(root()).toHaveAttribute('data-theme', 'night')
    expect(localStorage.getItem('sky-os.theme')).toBe('night')
    act(() => result.current.setTheme('day'))
    expect(result.current.theme).toBe('day')
  })

  it('toggle flips the theme', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.toggle())
    expect(result.current.theme).toBe('night')
    act(() => result.current.toggle())
    expect(result.current.theme).toBe('day')
  })

  it('all callers share one state', () => {
    const a = renderHook(() => useTheme())
    const b = renderHook(() => useTheme())
    act(() => a.result.current.setTheme('night'))
    expect(b.result.current.theme).toBe('night')
    act(() => b.result.current.toggle())
    expect(a.result.current.theme).toBe('day')
  })

  it('components rendered separately see the same theme', () => {
    render(
      <>
        <Probe name="one" />
        <Probe name="two" />
      </>,
    )
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('night'))
    expect(screen.getByTestId('one')).toHaveTextContent('night')
    expect(screen.getByTestId('two')).toHaveTextContent('night')
  })

  it('does not carry state over after every caller unmounted', () => {
    const first = renderHook(() => useTheme())
    act(() => first.result.current.setTheme('night'))
    first.unmount()
    localStorage.clear()
    const second = renderHook(() => useTheme())
    expect(second.result.current.theme).toBe('day')
  })

  it('keeps the choice in memory when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('night'))
    expect(result.current.theme).toBe('night')
  })
})
