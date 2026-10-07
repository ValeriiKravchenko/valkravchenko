import type { ReactNode } from 'react'

export interface PageHeadingProps {
  children: ReactNode
  className?: string
}

/**
 * The page `h1`. It has `tabIndex={-1}` so the layout can move focus to it
 * after a route change.
 */
export function PageHeading({ children, className = '' }: PageHeadingProps) {
  return (
    <h1
      tabIndex={-1}
      className={`m-0 text-[2.25rem] leading-[1.08] font-semibold tracking-[-0.02em] [overflow-wrap:anywhere] focus:outline-none sm:text-[3.5rem] ${className}`}
    >
      {children}
    </h1>
  )
}
