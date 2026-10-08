import { ContactsWindow } from '../components/ContactsWindow'
import { PageHeading } from '../components/PageHeading'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { pageTitle } from '../i18n/pageTitle'
import { useDictionary } from '../i18n'

export function ContactsPage() {
  const t = useDictionary()
  useDocumentTitle(pageTitle(t, t.contacts.heading))

  return (
    <>
      <PageHeading>{t.contacts.heading}</PageHeading>
      <div className="mt-8">
        <ContactsWindow
          title={t.contacts.windowTitle}
          intro={t.contacts.intro}
          items={t.contacts.items}
        />
      </div>
    </>
  )
}
