import { useId, type ReactNode } from 'react'

export interface TrainerPanelProps {
  title: string
  children: ReactNode
  /** Heading level of the panel title. The page `h1` sits above, so panels use `h2`. */
  headingLevel?: 2 | 3
  className?: string
  /** Replaces the default body padding. */
  bodyClassName?: string
}

/** Light panel with a titled header strip, used inside a trainer window. Presentation only. */
export function TrainerPanel({
  title,
  children,
  headingLevel = 2,
  className = '',
  bodyClassName = 'px-4 py-3',
}: TrainerPanelProps) {
  const titleId = useId()
  const Heading = `h${headingLevel}` as const

  return (
    <section
      aria-labelledby={titleId}
      className={`min-w-0 overflow-hidden rounded-button border border-border bg-window ${className}`}
    >
      <Heading
        id={titleId}
        className="m-0 border-b border-divider bg-chip px-4 py-2 font-mono text-[13px] font-semibold text-muted [overflow-wrap:anywhere]"
      >
        {title}
      </Heading>
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
