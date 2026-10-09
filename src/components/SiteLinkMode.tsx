import { createContext, useContext, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { Link } from 'react-router'

const SiteLinkModeContext = createContext(false)

export interface SiteLinkModeProps {
  children: ReactNode
}

/**
 * Marks a subtree whose router does not own the site paths (the separate
 * trainers page). Inside it, links to site pages become plain anchors.
 */
export function SiteLinkMode({ children }: SiteLinkModeProps) {
  return <SiteLinkModeContext.Provider value={true}>{children}</SiteLinkModeContext.Provider>
}

export type SiteLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, 'to'> & { to: string }

/** Link to a page of the main site: router link normally, plain `<a>` in site-link mode. */
export function SiteLink({ to, children, ...rest }: SiteLinkProps) {
  const plain = useContext(SiteLinkModeContext)
  return plain ? (
    <a href={to} {...(rest as ComponentPropsWithoutRef<'a'>)}>
      {children}
    </a>
  ) : (
    <Link to={to} {...rest}>
      {children}
    </Link>
  )
}
