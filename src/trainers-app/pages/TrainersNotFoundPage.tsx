import { LinkButton } from '../../components/LinkButton'
import { PageHeading } from '../../components/PageHeading'
import { Window } from '../../components/Window'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useDictionary } from '../../i18n'
import { pageTitle } from '../../i18n/pageTitle'
import { TRAINERS_HOME_PATH } from '../paths'

/** Unknown hash route inside the trainers page. */
export function TrainersNotFoundPage() {
  const t = useDictionary()
  useDocumentTitle(pageTitle(t, t.notFound.heading))

  return (
    <Window title={t.notFound.windowTitle} titleAs="p" className="mx-auto max-w-[960px]">
      <PageHeading>{t.notFound.heading}</PageHeading>
      <p className="mt-4 mb-6 max-w-[60ch]">{t.notFound.body}</p>
      <LinkButton to={TRAINERS_HOME_PATH} variant="primary">
        {t.trainers.backLabel}
      </LinkButton>
    </Window>
  )
}
