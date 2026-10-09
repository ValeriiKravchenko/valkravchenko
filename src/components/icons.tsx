import type { ReactNode, SVGProps } from 'react'
import type { SectionId } from '../data/sections'
import type { Theme } from '../theme/resolveTheme'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>

/** Shared 24x24 outline icon frame. Always decorative: the link or button carries the name. */
function Icon({ children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const FolderIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Icon>
)

export const TableIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18M3 15h18M9 4v16" />
  </Icon>
)

export const BookIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" />
    <path d="M8 7h8M20 17v4H6.5A2.5 2.5 0 0 1 4 18.5" />
  </Icon>
)

export const EnvelopeIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </Icon>
)

export const HouseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 11 12 3l9 8" />
    <path d="M5 10v10h14V10M10 20v-6h4v6" />
  </Icon>
)

export const WindowIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18" />
  </Icon>
)

export const SunIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
)

export const MoonIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </Icon>
)

/** Logo mark: a sun behind a cloud. */
export const LogoIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="16" cy="8" r="3.5" />
    <path d="M7 20a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17 13.5 3.3 3.3 0 0 1 16.5 20z" />
  </Icon>
)

const sectionIcons: Record<SectionId, (props: IconProps) => ReactNode> = {
  home: HouseIcon,
  projects: FolderIcon,
  automation: TableIcon,
  library: BookIcon,
  contacts: EnvelopeIcon,
  java: WindowIcon,
  basics: WindowIcon,
  trainers: WindowIcon,
}

export function SectionIcon({ id, ...rest }: IconProps & { id: SectionId }) {
  const Component = sectionIcons[id]
  return <>{Component(rest)}</>
}

export function ThemeIcon({ theme, ...rest }: IconProps & { theme: Theme }) {
  return theme === 'day' ? <SunIcon {...rest} /> : <MoonIcon {...rest} />
}
