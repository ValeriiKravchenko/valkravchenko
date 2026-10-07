import { screen } from '@testing-library/react'
import { dictionary as t } from '../i18n'
import { renderAt } from '../test/renderAt'

describe('Layout', () => {
  it('renders skip link, banner, navigation, main and footer once', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: t.skipLink })).toBeInTheDocument()
    expect(screen.getAllByRole('banner')).toHaveLength(1)
    expect(screen.getAllByRole('navigation')).toHaveLength(1)
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getByRole('contentinfo')).toHaveTextContent(t.footer.text)
  })

  it('logo links to the home path', () => {
    renderAt('/contacts')
    expect(screen.getByRole('link', { name: t.logo.ariaLabel })).toHaveAttribute('href', '/')
  })
})
