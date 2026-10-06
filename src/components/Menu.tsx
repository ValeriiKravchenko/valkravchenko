export interface MenuItem {
  href: string
  label: string
}

export interface MenuProps {
  items: MenuItem[]
  ariaLabel: string
}

export function Menu({ items, ariaLabel }: MenuProps) {
  return (
    <nav aria-label={ariaLabel}>
      <ul className="m-0 flex list-none flex-wrap items-center gap-1 p-0">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className="flex min-h-11 min-w-11 items-center rounded-button px-3 text-[15px] font-semibold text-ink no-underline hover:bg-titlebar hover:underline"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
