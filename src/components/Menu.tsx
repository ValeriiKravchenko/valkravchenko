import { NavLink } from 'react-router'

export interface MenuItem {
  to: string
  label: string
}

export interface MenuProps {
  items: MenuItem[]
  ariaLabel: string
}

/** Flat menu bar. The active link gets `aria-current="page"` from the router. */
export function Menu({ items, ariaLabel }: MenuProps) {
  return (
    <nav aria-label={ariaLabel}>
      <ul className="m-0 flex list-none flex-wrap items-center gap-1 p-0">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end
              className="flex min-h-11 min-w-11 items-center rounded-button px-3 text-[15px] font-semibold text-ink no-underline underline-offset-4 hover:bg-titlebar hover:underline aria-[current=page]:bg-titlebar aria-[current=page]:underline aria-[current=page]:decoration-accent aria-[current=page]:decoration-2"
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
