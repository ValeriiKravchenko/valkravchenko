import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { dictionary as t } from '../i18n'
import { ContactsPage } from './ContactsPage'
import { HomePage } from './HomePage'
import { NotFoundPage } from './NotFoundPage'
import { ProjectsPage } from './ProjectsPage'

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('pages', () => {
  it('HomePage has a focusable h1 and links to projects and contacts', () => {
    wrap(<HomePage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('link', { name: t.home.primaryCta.label })).toHaveAttribute('href', '/projects')
    expect(screen.getByRole('link', { name: t.home.secondaryCta.label })).toHaveAttribute('href', '/contacts')
    expect(document.title).toBe(t.home.documentTitle)
  })

  it('ProjectsPage lists projects and one striped window', () => {
    const { container } = wrap(<ProjectsPage />)
    expect(screen.getAllByRole('listitem')).toHaveLength(t.projects.items.length)
    expect(container.querySelectorAll('[data-variant="striped"]')).toHaveLength(1)
    expect(document.title).toBe(t.projects.documentTitle)
  })

  it('ContactsPage shows placeholder contacts only', () => {
    wrap(<ContactsPage />)
    expect(screen.getByText('[email]')).toBeInTheDocument()
    expect(document.title).toBe(t.contacts.documentTitle)
  })

  it('NotFoundPage links home', () => {
    wrap(<NotFoundPage />)
    expect(screen.getByRole('link', { name: t.notFound.homeLink })).toHaveAttribute('href', '/')
    expect(document.title).toBe(t.notFound.documentTitle)
  })
})
