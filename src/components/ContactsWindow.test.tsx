import { render, screen } from '@testing-library/react'
import { ContactsWindow } from './ContactsWindow'

describe('ContactsWindow', () => {
  it('shows the intro and each contact label with its value', () => {
    render(
      <ContactsWindow
        title="Контакты"
        intro="Intro"
        items={[
          { label: 'GITHUB', value: 'gh.example/user', href: 'https://gh.example/user' },
          { label: 'PLAIN', value: 'plain value' },
        ]}
      />,
    )
    expect(screen.getByRole('region', { name: 'Контакты' })).toBeInTheDocument()
    expect(screen.getByText('Intro')).toBeInTheDocument()
    expect(screen.getByText('GITHUB')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'gh.example/user' })
    expect(link).toHaveAttribute('href', 'https://gh.example/user')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText('plain value')).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('shows the page heading inside the window', () => {
    render(<ContactsWindow title="Контакты" heading={<h1>Head</h1>} intro="Intro" items={[]} />)
    const region = screen.getByRole('region', { name: 'Контакты' })
    expect(region).toContainElement(screen.getByRole('heading', { level: 1, name: 'Head' }))
  })
})
