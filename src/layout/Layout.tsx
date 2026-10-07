import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { getEnabledSections, getSectionPath, SECTIONS, type Section } from '../data/sections'
import { useDictionary } from '../i18n'

export interface LayoutProps {
  sections?: readonly Section[]
}

/** Root layout: skip link, header with menu, page outlet, footer. */
export function Layout({ sections = SECTIONS }: LayoutProps) {
  const t = useDictionary()
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const lastPath = useRef(pathname)

  // After a route change: scroll to the top and move focus to the page h1.
  useEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    window.scrollTo(0, 0)
    const heading = mainRef.current?.querySelector('h1')
    // Fallback: a page without h1 gets focus on main.
    const target = heading ?? mainRef.current
    target?.focus()
  }, [pathname])

  const items = getEnabledSections(sections).map((section) => ({
    to: section.path,
    label: t.nav.labels[section.navKey],
  }))

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-8">
      <a
        href="#main"
        onClick={() => mainRef.current?.focus()}
        className="sr-only focus:not-sr-only focus:inline-flex focus:min-h-11 focus:items-center focus:bg-window focus:px-3"
      >
        {t.skipLink}
      </a>
      <Header
        logo={{ ...t.logo, to: getSectionPath('home', sections) ?? '/' }}
        nav={{ ariaLabel: t.nav.ariaLabel, items }}
      />
      <main id="main" ref={mainRef} tabIndex={-1} className="mt-8 focus:outline-none">
        <Outlet />
      </main>
      <Footer text={t.footer.text} />
    </div>
  )
}
