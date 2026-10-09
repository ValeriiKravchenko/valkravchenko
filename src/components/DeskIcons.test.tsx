import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { DeskIcons } from './DeskIcons'

describe('DeskIcons', () => {
  it('renders link icons with captions, hidden from assistive tech and from Tab', () => {
    const { container } = render(
      <MemoryRouter>
        <DeskIcons
          items={[
            { id: 'home', to: '/', label: 'Главная' },
            { id: 'about', to: '/about', label: 'Обо мне' },
            { id: 'library', to: '/library', label: 'Библиотека' },
          ]}
        />
      </MemoryRouter>,
    )
    const icons = container.querySelectorAll('a')
    expect(icons).toHaveLength(3)
    icons.forEach((a) => {
      expect(a).toHaveAttribute('aria-hidden', 'true')
      expect(a).toHaveAttribute('tabindex', '-1')
      expect(a.querySelector('svg')).not.toBeNull()
    })
    expect(icons[1]).toHaveTextContent('Обо мне')
    expect(icons[1]).toHaveAttribute('href', '/about')
    expect(icons[2]).toHaveTextContent('Библиотека')
    expect(icons[2]).toHaveAttribute('href', '/library')
  })
})
