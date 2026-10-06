import { render, screen } from '@testing-library/react'
import { ContactsWindow } from './ContactsWindow'

describe('ContactsWindow', () => {
  it('shows the intro and each contact label with its value', () => {
    render(
      <ContactsWindow
        title="Контакты"
        intro="Intro"
        items={[
          { label: 'GITHUB', value: '[github]' },
          { label: 'EMAIL', value: '[email]' },
        ]}
      />,
    )
    expect(screen.getByRole('region', { name: 'Контакты' })).toBeInTheDocument()
    expect(screen.getByText('Intro')).toBeInTheDocument()
    expect(screen.getByText('GITHUB')).toBeInTheDocument()
    expect(screen.getByText('[email]')).toBeInTheDocument()
  })
})
