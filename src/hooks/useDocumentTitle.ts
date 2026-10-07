import { useEffect } from 'react'

/** Sets `document.title` while the calling page is mounted. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title
  }, [title])
}
