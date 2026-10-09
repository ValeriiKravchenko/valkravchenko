import { Link } from 'react-router'
import { SectionIcon } from './icons'
import type { DockItem } from './Dock'

export interface DeskIconsProps {
  items: DockItem[]
}

/**
 * Desktop icons for the mouse (>= 1280 px). A duplicate of the navigation, so
 * they are hidden from assistive tech and skipped by Tab.
 */
export function DeskIcons({ items }: DeskIconsProps) {
  return (
    <div className="absolute top-20 left-6 hidden flex-col gap-5 xl:flex">
      {items.map((item) => (
        <Link
          key={item.id}
          to={item.to}
          aria-hidden="true"
          tabIndex={-1}
          data-desk-icon={item.id}
          className="flex w-[84px] flex-col items-center gap-1.5 no-underline"
        >
          <span className="grid size-[60px] place-items-center rounded-tile border border-tile-line bg-tile text-accent">
            <SectionIcon id={item.id} width={28} height={28} />
          </span>
          <span className="rounded-md bg-label-bg px-1.5 text-center text-[12px] leading-snug font-semibold text-label-ink">
            {item.label}
          </span>
        </Link>
      ))}
    </div>
  )
}
