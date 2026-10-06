import { useId, type ReactNode } from 'react'

export type WindowVariant = 'default' | 'striped'
export type WindowTitleTag = 'h2' | 'h3' | 'p'

export interface WindowProps {
  title: string
  children: ReactNode
  /**
   * `striped` is the "special window". Use it at most once per page.
   */
  variant?: WindowVariant
  /** Element used for the title in the title bar. Use `p` when the body holds the page heading. */
  titleAs?: WindowTitleTag
  /** Silkscreen title (Latin text only). */
  pixelTitle?: boolean
  id?: string
  className?: string
}

export function Window({
  title,
  children,
  variant = 'default',
  titleAs: Title = 'h2',
  pixelTitle = false,
  id,
  className = '',
}: WindowProps) {
  const titleId = useId()
  const barClass = variant === 'striped' ? 'titlebar-striped' : 'bg-titlebar'
  const titleFont = pixelTitle
    ? 'font-pixel text-[13px] uppercase tracking-wider'
    : 'text-[15px] font-semibold'

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      data-variant={variant}
      className={`min-w-0 overflow-hidden rounded-window border border-border bg-window shadow-window ${className}`}
    >
      <div
        className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-divider px-4 py-3 ${barClass}`}
      >
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="size-3 rounded-full bg-dot-red" />
          <span className="size-3 rounded-full bg-dot-yellow" />
          <span className="size-3 rounded-full bg-dot-green" />
        </span>
        <Title
          id={titleId}
          className={`m-0 rounded bg-titlebar px-2 text-center text-ink ${titleFont}`}
        >
          {title}
        </Title>
        <span aria-hidden="true" />
      </div>
      <div className="p-5 sm:p-8">{children}</div>
    </section>
  )
}
