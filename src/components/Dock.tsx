import { NavLink } from 'react-router'
import type { SectionId } from '../data/sections'
import { useDictionary } from '../i18n'
import { SectionIcon } from './icons'

export interface DockItem {
  id: SectionId
  to: string
  label: string
  /** Caption under the icon on the phone layout; defaults to `label`. */
  shortLabel?: string
}

export interface DockProps {
  items: DockItem[]
}

/**
 * Dock: bottom-centre tiles on desktop (icons only), full-width bottom menu
 * with short captions below 1024 px. Same links, one element.
 */
export function Dock({ items }: DockProps) {
  const t = useDictionary()

  return (
    <nav
      aria-label={t.dock.ariaLabel}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-bar-line bg-bar backdrop-blur lg:inset-x-auto lg:bottom-4 lg:left-1/2 lg:-translate-x-1/2 lg:rounded-[22px] lg:border lg:border-dock-line lg:bg-dock lg:px-3 lg:py-2"
    >
      <ul className="m-0 flex list-none items-stretch justify-around gap-0 p-0 lg:gap-3">
        {items.map((item) => (
          <li key={item.id} className="min-w-0 flex-1 lg:flex-none">
            <NavLink
              to={item.to}
              end={item.to === '/'}
              aria-label={item.label}
              title={item.label}
              className="group flex min-h-14 min-w-11 flex-col items-center justify-center gap-1 px-0 text-[12px] max-[359px]:text-[11px] leading-tight font-semibold text-bar-ink no-underline lg:min-h-0 lg:gap-1.5"
            >
              <span className="grid size-9 place-items-center rounded-button border border-tile-line bg-tile text-accent group-aria-[current=page]:border-accent group-aria-[current=page]:bg-accent group-aria-[current=page]:text-on-accent lg:size-12 lg:rounded-tile">
                <SectionIcon id={item.id} />
              </span>
              <span className="max-w-full truncate group-aria-[current=page]:underline lg:hidden">
                {item.shortLabel ?? item.label}
              </span>
              <span
                aria-hidden="true"
                className="hidden size-1.5 rounded-full bg-transparent group-aria-[current=page]:bg-logo lg:block"
              />
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
