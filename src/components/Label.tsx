import type { ReactNode } from 'react'

export type LabelFont = 'mono' | 'pixel'

export interface LabelProps {
  children: ReactNode
  /** `pixel` uses Silkscreen: Latin text only (WELCOME, GITHUB, EMAIL). */
  font?: LabelFont
  className?: string
}

const fontClasses: Record<LabelFont, string> = {
  mono: 'font-mono text-[15px]',
  pixel: 'font-pixel text-[13px] uppercase tracking-wider',
}

export function Label({ children, font = 'mono', className = '' }: LabelProps) {
  return (
    <span className={`inline-block text-muted ${fontClasses[font]} ${className}`}>
      {children}
    </span>
  )
}
