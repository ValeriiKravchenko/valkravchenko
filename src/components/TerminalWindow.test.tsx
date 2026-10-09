import { render, screen, within } from '@testing-library/react'
import { PROJECTS } from '../data/projects'
import { dictionary as t } from '../i18n'
import { TerminalWindow } from './TerminalWindow'

describe('TerminalWindow', () => {
  it('lists all projects from the data and the session commands', () => {
    render(<TerminalWindow />)
    const win = screen.getByRole('region', { name: 'terminal — ~/projects' })
    const items = within(win).getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toEqual(PROJECTS.map((p) => p.id))
    expect(win).toHaveTextContent('valerii@sky-os:~$ ls projects')
    expect(win).toHaveTextContent('valerii@sky-os:~$ cat studynotes/about')
    expect(win).toHaveTextContent('# интерактивный терминал — скоро')
    expect(win).toHaveTextContent(t.home.terminal.about)
  })

  it('has a decorative block cursor and wraps long lines', () => {
    const { container } = render(<TerminalWindow />)
    const cursor = container.querySelector('.term-cursor')
    expect(cursor).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.whitespace-pre-wrap')).toHaveClass('[overflow-wrap:anywhere]')
  })
})
