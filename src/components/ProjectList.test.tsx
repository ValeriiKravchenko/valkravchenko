import { render, screen, within } from '@testing-library/react'
import { ProjectList, type ProjectItem } from './ProjectList'

const make = (id: string, title: string): ProjectItem => ({
  id,
  title,
  description: `About ${title}`,
  tags: ['X', 'Y'],
  tagsLabel: 'Stack',
  link: { href: `https://example.test/${id}`, label: 'Code', ariaLabel: `Code ${title} (new tab)` },
})

const items = [make('a', 'Alpha'), make('b', 'Beta')]

describe('ProjectList', () => {
  it('renders title, description and tags for each project', () => {
    render(<ProjectList items={items} />)
    expect(screen.getByRole('heading', { level: 3, name: 'Alpha' })).toBeInTheDocument()
    expect(screen.getByText('About Beta')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Stack: Alpha' })).toBeInTheDocument()
  })

  it('renders an external link with safe attributes and a full accessible name', () => {
    render(<ProjectList items={items} />)
    const link = screen.getByRole('link', { name: 'Code Beta (new tab)' })
    expect(link).toHaveAttribute('href', 'https://example.test/b')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveClass('min-h-11')
  })

  it('keeps the visible link label', () => {
    render(<ProjectList items={[items[0]]} />)
    const item = screen.getAllByRole('listitem')[0]
    expect(within(item).getByText('Code')).toBeInTheDocument()
  })
})
