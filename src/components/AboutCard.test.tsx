import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { dictionary as t } from '../i18n'
import { AboutCard } from './AboutCard'

function renderCard() {
  return render(
    <MemoryRouter>
      <AboutCard />
    </MemoryRouter>,
  )
}

describe('AboutCard', () => {
  it('is a window named from the dictionary, with the title as a paragraph', () => {
    renderCard()
    const card = screen.getByRole('region', { name: 'about — me' })
    expect(card).toBeInTheDocument()
    expect(within(card).getByText('about — me').tagName).toBe('P')
  })

  it('shows the photo with srcset, exact size and alt', () => {
    renderCard()
    const img = screen.getByRole('img', { name: t.about.photoAlt })
    expect(img).toHaveAttribute('srcset', expect.stringMatching(/ 440w, .* 760w$/))
    expect(img).toHaveAttribute('sizes', '112px')
    expect(img).toHaveAttribute('width', '440')
    expect(img).toHaveAttribute('height', '550')
    expect(img).toHaveAttribute('decoding', 'async')
  })

  it('shows the name as h2, the summary and a button to /about', () => {
    renderCard()
    expect(screen.getByRole('heading', { level: 2, name: 'Валерий Кравченко' })).toBeInTheDocument()
    expect(screen.getByText(t.home.aboutCard.summary)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Подробнее' })).toHaveAttribute('href', '/about')
  })
})
