import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { dictionary as site } from '../../i18n'
import EnglishTrainer from './EnglishTrainer'
import { parseProgress } from './engine'
import { ru } from './locales/ru'
import { PROGRESS_STORAGE_KEY } from './progressStorage'
import { SESSION_STORAGE_KEY } from './sessionStorage'
import { englishWordIds, getWordById } from './words'

const renderScreen = () =>
  render(
    <MemoryRouter>
      <EnglishTrainer />
    </MemoryRouter>,
  )

/** Value shown next to a statistics label. */
const stat = (label: string) => Number(screen.getByText(label).nextElementSibling?.textContent)
// The word card comes first in the document, before the statistics panels.
const currentWordText = () => screen.getAllByRole('heading', { level: 2 })[0].textContent ?? ''

beforeEach(() => {
  localStorage.clear()
  // Fixed date and shuffle: the session does not depend on the clock or on chance.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0))
  vi.spyOn(Math, 'random').mockReturnValue(0)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('EnglishTrainer', () => {
  it('renders inside a sky-os window with the first card and the statistics', () => {
    renderScreen()
    const win = screen.getByRole('region', { name: site.trainers.english.windowTitle })
    expect(within(win).getByRole('heading', { level: 1 })).toHaveTextContent(ru.ui.heading)
    expect(within(win).getByRole('link', { name: site.trainers.backLabel })).toHaveAttribute('href', '/trainers')
    const word = englishWordIds.map(getWordById).find((w) => w?.word === currentWordText())
    expect(word).toBeDefined()
    expect(screen.getByRole('button', { name: new RegExp(ru.ui.card.revealButton) })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: ru.ui.stats.title })).toBeInTheDocument()
  })

  it('starts with a clean slate: nothing learned yet', () => {
    renderScreen()
    expect(stat(ru.ui.stats.learned)).toBe(0)
    expect(stat(ru.ui.stats.learning)).toBe(0)
    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull()
  })

  it('reveals the translation, takes a grade and updates the statistics', async () => {
    const user = userEvent.setup()
    renderScreen()
    const newBefore = stat(ru.ui.stats.newCount)
    const first = currentWordText()
    const word = englishWordIds.map(getWordById).find((w) => w?.word === first)!

    await user.click(screen.getByRole('button', { name: new RegExp(ru.ui.card.revealButton) }))
    expect(screen.getByText(word.translation)).toBeInTheDocument()
    expect(screen.getByText(word.example)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: new RegExp(`^${ru.ui.card.knowButton}`) }))
    expect(stat(ru.ui.stats.newCount)).toBe(newBefore - 1)
    expect(stat(ru.ui.stats.learning) + stat(ru.ui.stats.learned)).toBe(1)
  })

  it('saves progress to localStorage under the public storage key', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('button', { name: new RegExp(ru.ui.card.revealButton) }))
    await user.click(screen.getByRole('button', { name: new RegExp(`^${ru.ui.card.knowButton}`) }))

    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = parseProgress(raw!)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(Object.keys(parsed.store)).toHaveLength(1)
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull()
  })

  it('works from the keyboard: space reveals, 2 means "know"', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.keyboard(' ')
    expect(screen.getByText(ru.ui.card.translationLabel)).toBeInTheDocument()
    await user.keyboard('2')
    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).not.toBeNull()
  })

  it('does not crash and shows no listen button when speechSynthesis is missing', () => {
    expect('speechSynthesis' in window).toBe(false)
    expect(() => renderScreen()).not.toThrow()
    expect(screen.queryByRole('button', { name: ru.ui.card.listenAriaLabel })).toBeNull()
  })

  it('shows a message and a download button when the saved progress is broken', () => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, '{not json')
    renderScreen()
    expect(screen.getByRole('alert')).toHaveTextContent(ru.parseErrorText['invalid-json'])
    expect(screen.getByRole('button', { name: ru.ui.progress.downloadBrokenButton })).toBeInTheDocument()
  })
})
