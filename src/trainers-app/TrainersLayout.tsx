import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Footer } from '../components/Footer'
import { SiteLinkMode } from '../components/SiteLinkMode'
import { SystemBar } from '../components/SystemBar'
import { useDictionary } from '../i18n'
import { TRAINERS_HOME_PATH } from './paths'

/** Shell of the trainers page: skip link, system bar, page outlet and footer. */
export function TrainersLayout() {
  const t = useDictionary()
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const lastPath = useRef(pathname)

  // After a route change: scroll to the top and move focus to the page h1.
  useEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    window.scrollTo(0, 0)
    const target = mainRef.current?.querySelector('h1') ?? mainRef.current
    target?.focus()
  }, [pathname])

  return (
    // Links to the main site (logo, avatar, help menu) are plain anchors here.
    <SiteLinkMode>
      <div className="relative min-h-screen">
        <a
          href="#main"
          onClick={(event) => {
            // The hash is the router state here: only move focus, do not navigate.
            event.preventDefault()
            mainRef.current?.focus()
          }}
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-4 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-button focus:bg-window focus:px-3 focus:text-ink"
        >
          {t.skipLink}
        </a>
        <SystemBar logoTo="/" items={[{ to: TRAINERS_HOME_PATH, label: t.nav.labels.trainers }]} />
        <div className="mx-auto w-full max-w-[1280px] px-4 pt-6 pb-24 sm:px-8 lg:pb-32">
          <main id="main" ref={mainRef} tabIndex={-1} className="focus:outline-none">
            <Outlet />
          </main>
          <Footer text={t.footer.text} />
        </div>
      </div>
    </SiteLinkMode>
  )
}
