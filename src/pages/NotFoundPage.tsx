import { LinkButton } from '../components/LinkButton'
import { PageHeading } from '../components/PageHeading'
import { Window } from '../components/Window'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useDictionary } from '../i18n'

export function NotFoundPage() {
  const t = useDictionary()
  useDocumentTitle(t.notFound.documentTitle)

  return (
    <Window title={t.notFound.windowTitle} titleAs="p" pixelTitle>
      <PageHeading>{t.notFound.heading}</PageHeading>
      <p className="mt-4 mb-6 max-w-[60ch]">{t.notFound.body}</p>
      <LinkButton to="/" variant="primary">
        {t.notFound.homeLink}
      </LinkButton>
    </Window>
  )
}
