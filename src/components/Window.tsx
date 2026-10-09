import { useId, type ReactNode } from 'react'
import { WindowMenu } from './WindowMenu'

export type WindowTitleTag = 'h2' | 'h3' | 'p'

export interface WindowProps {
  title: string
  children: ReactNode
  /** Element used for the title in the title bar. Use `p` when the body holds the page heading. */
  titleAs?: WindowTitleTag
  /** Small window: 14 px title instead of 17 px. */
  small?: boolean
  /** Replaces the default body padding. */
  bodyClassName?: string
  id?: string
  className?: string
}

export function Window({
  title,
  children,
  titleAs: Title = 'h2',
  small = false,
  bodyClassName = 'p-5 sm:p-11',
  id,
  className = '',
}: WindowProps) {
  const titleId = useId()

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={`window min-w-0 overflow-hidden rounded-window border border-border bg-window shadow-window ${className}`}
    >
      <div className="flex items-center gap-3 border-b border-divider bg-linear-to-b from-title-from to-title-to px-4 py-3">
        <span aria-hidden="true" className="flex shrink-0 gap-1.5">
          <span className="size-3 rounded-full bg-dot-red" />
          <span className="size-3 rounded-full bg-dot-yellow" />
          <span className="size-3 rounded-full bg-dot-green" />
        </span>
        <Title
          id={titleId}
          className={`m-0 min-w-0 font-semibold text-title-ink [overflow-wrap:anywhere] ${
            small ? 'text-[14px]' : 'text-[17px]'
          }`}
        >
          {title}
        </Title>
        <WindowMenu />
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
