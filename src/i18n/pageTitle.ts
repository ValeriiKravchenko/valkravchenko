import type { Dictionary } from './types'

/** Tab title: the page name plus the site title, written once here. */
export function pageTitle(t: Dictionary, pageName?: string): string {
  return pageName ? `${pageName} — ${t.siteTitle}` : t.siteTitle
}
