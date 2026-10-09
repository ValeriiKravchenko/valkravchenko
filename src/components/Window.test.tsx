import { render, screen } from '@testing-library/react'
import { dictionary as t } from '../i18n'
import { Window } from './Window'

describe('Window', () => {
  it('is a named region with the title as heading', () => {
    render(<Window title="Проекты">Content</Window>)
    expect(screen.getByRole('region', { name: 'Проекты' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Проекты' })).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('hides the decorative dots and the window menu from assistive tech', () => {
    const { container } = render(<Window title="T">x</Window>)
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(1)
    const menu = screen.getByText(t.windowMenu[0]).parentElement!
    expect(menu).toHaveAttribute('aria-hidden', 'true')
    expect(menu).toHaveTextContent(t.windowMenu.join(''))
    expect(t.windowMenu).toEqual(['file', 'edit', 'view', 'help'])
  })

  it('supports a non-heading title', () => {
    render(<Window title="sky-os — главная" titleAs="p">x</Window>)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'sky-os — главная' })).toBeInTheDocument()
  })

  it('has no striped variant and no pixel title', () => {
    const { container } = render(<Window title="T">x</Window>)
    expect(container.querySelector('.titlebar-striped')).toBeNull()
    expect(container.querySelector('[data-variant]')).toBeNull()
    expect(container.querySelector('.font-pixel')).toBeNull()
  })

  it('uses a 17 px title by default and 14 px for small windows', () => {
    const { rerender } = render(<Window title="T">x</Window>)
    expect(screen.getByText('T')).toHaveClass('text-[17px]')
    rerender(<Window title="T" small>x</Window>)
    expect(screen.getByText('T')).toHaveClass('text-[14px]')
  })
})
