import { render, screen } from '@testing-library/react'
import { ProjectList } from './ProjectList'

const items = [
  { id: 'a', title: 'Alpha', description: 'First', chip: { label: 'Tests', count: '[число]' } },
  {
    id: 'b',
    title: 'Beta',
    description: 'Second',
    chip: { label: 'Tests', count: '[число]' },
    href: '#beta',
  },
]

describe('ProjectList', () => {
  it('renders one list item per project', () => {
    render(<ProjectList items={items} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('heading', { level: 3, name: 'Alpha' })).toBeInTheDocument()
  })

  it('makes only projects with href into links', () => {
    render(<ProjectList items={items} />)
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Beta' })).toHaveAttribute('href', '#beta')
  })
})
