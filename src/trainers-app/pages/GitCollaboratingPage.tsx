import { lazy, Suspense } from 'react'
import { Window } from '../../components/Window'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useDictionary } from '../../i18n'
import { pageTitle } from '../../i18n/pageTitle'

// Loaded on demand: keeps the trainer code and data out of the main chunk.
const RemoteTrainer = lazy(() => import('../../trainers/git/RemoteTrainer'))

export function GitCollaboratingPage() {
  const t = useDictionary()
  useDocumentTitle(pageTitle(t, t.trainers.gitCollaborating.title))

  return (
    <Suspense
      fallback={
        <Window title={t.trainers.gitCollaborating.windowTitle} titleAs="p" className="mx-auto max-w-[1100px]">
          <output className="m-0 block">
            {t.trainers.loading}
          </output>
        </Window>
      }
    >
      <RemoteTrainer />
    </Suspense>
  )
}
