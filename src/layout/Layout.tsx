import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router'
import { DeskIcons } from '../components/DeskIcons'
import { Dock, type DockItem } from '../components/Dock'
import { Footer } from '../components/Footer'
import { SystemBar } from '../components/SystemBar'
import { getEnabledSections, getSectionPath, SECTIONS, type Section } from '../data/sections'
import { useDictionary } from '../i18n'

export interface LayoutProps {
  sections?: readonly Section[]
}

/** Root layout: skip link, system bar, desk with icons, page outlet, footer, dock. */
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

  // Menu, dock and desk icons all come from the same registry.
  const items: DockItem[] = getEnabledSections(sections).map((section) => ({
    id: section.id,
    to: section.path,
    label: t.nav.labels[section.id],
  }))

  return (
    <div className="relative min-h-screen">
      <a
        href="#main"
        onClick={() => mainRef.current?.focus()}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-4 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-button focus:bg-window focus:px-3 focus:text-ink"
      >
        {t.skipLink}
      </a>
      <SystemBar logoTo={getSectionPath('home', sections) ?? '/'} items={items} />
      <DeskIcons items={items} />
      <div className="mx-auto w-full max-w-[1280px] px-4 pt-6 pb-24 sm:px-8 lg:pb-32 xl:pl-[132px]">
        <main id="main" ref={mainRef} tabIndex={-1} className="focus:outline-none">
          <Outlet />
        </main>
        <Footer text={t.footer.text} />
      </div>
      <Dock items={items} />
    </div>
  )
}
