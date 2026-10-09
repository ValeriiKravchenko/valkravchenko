import type { ReactNode } from 'react'

export interface LabelProps {
  children: ReactNode
  className?: string
}

export function Label({ children, className = '' }: LabelProps) {
  return (
    <span className={`inline-block font-mono text-[15px] text-muted ${className}`}>
      {children}
    </span>
  )
}
