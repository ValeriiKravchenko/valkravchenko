import { Link } from 'react-router'
import { Menu, type MenuItem } from './Menu'

export interface HeaderProps {
  logo: { text: string; ariaLabel: string; to: string }
  nav: { ariaLabel: string; items: MenuItem[] }
}

export function Header({ logo, nav }: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <Link
        to={logo.to}
        aria-label={logo.ariaLabel}
        className="inline-flex min-h-11 min-w-11 items-center rounded-button px-1 font-pixel text-2xl font-bold text-ink no-underline"
      >
        {logo.text}
      </Link>
      <Menu items={nav.items} ariaLabel={nav.ariaLabel} />
    </header>
  )
}
