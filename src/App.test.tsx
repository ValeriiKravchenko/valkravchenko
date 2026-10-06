import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('has a single h1 and a main landmark', () => {
    render(<App />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('has at most one striped window', () => {
    const { container } = render(<App />)
    expect(container.querySelectorAll('[data-variant="striped"]')).toHaveLength(1)
  })

  it('shows contact placeholders only, in brackets', () => {
    render(<App />)
    expect(screen.getByText('[email]')).toBeInTheDocument()
    expect(screen.getByText('[github]')).toBeInTheDocument()
  })

  it('has a skip link and anchor targets for every menu link', () => {
    const { container } = render(<App />)
    expect(screen.getByRole('link', { name: 'К содержимому' })).toHaveAttribute('href', '#main')
    for (const id of ['home', 'projects', 'contacts']) {
      expect(container.querySelector(`#${id}`)).not.toBeNull()
    }
  })
})
