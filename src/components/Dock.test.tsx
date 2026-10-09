import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { dictionary as t } from '../i18n'
import { Dock, type DockItem } from './Dock'

const items: DockItem[] = [
  { id: 'home', to: '/', label: 'Главная' },
  { id: 'projects', to: '/projects', label: 'Проекты' },
]

function renderDock(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Dock items={items} />
    </MemoryRouter>,
  )
}

describe('Dock', () => {
  it('is a landmark named "Док" with an icon link per item', () => {
    renderDock()
    const nav = screen.getByRole('navigation', { name: t.dock.ariaLabel })
    const links = within(nav).getAllByRole('link')
    expect(links.map((a) => a.getAttribute('aria-label'))).toEqual(['Главная', 'Проекты'])
    expect(links.map((a) => a.getAttribute('title'))).toEqual(['Главная', 'Проекты'])
    links.forEach((a) => expect(a.querySelector('svg')).not.toBeNull())
  })

  it('shows a short caption on the phone but keeps the full name in aria-label and title', () => {
    render(
      <MemoryRouter>
        <Dock items={[{ id: 'automation', to: '/automation', label: 'Автоматизация', shortLabel: 'Автомат.' }]} />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: 'Автоматизация' })
    expect(link).toHaveAttribute('title', 'Автоматизация')
    expect(link).toHaveTextContent('Автомат.')
    expect(link).not.toHaveTextContent('Автоматизация')
  })

  it('marks only the current page', () => {
    renderDock('/projects')
    expect(screen.getByRole('link', { name: 'Проекты' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Главная' })).not.toHaveAttribute('aria-current')
  })

  it('is fixed, with 44px+ targets on the phone layout', () => {
    renderDock()
    expect(screen.getByRole('navigation')).toHaveClass('fixed')
    expect(screen.getByRole('link', { name: 'Главная' })).toHaveClass('min-h-14', 'min-w-11')
  })
})
