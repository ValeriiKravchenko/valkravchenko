import type { ReactNode } from 'react'
import { Label } from './Label'
import { Window } from './Window'

export interface ContactItem {
  label: string
  value: string
  /** Optional external link target; when set, the value is rendered as a link. */
  href?: string
}

export interface ContactsWindowProps {
  title: string
  intro: string
  items: ContactItem[]
  /** Page heading shown at the top of the window body. */
  heading?: ReactNode
  id?: string
}

export function ContactsWindow({ title, intro, items, heading, id }: ContactsWindowProps) {
  return (
    <Window title={title} titleAs="p" id={id}>
      {heading}
      <p className="m-0 mt-4 mb-4">{intro}</p>
      <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
        {items.map((item) => (
          <div key={item.label} className="contents">
            <dt>
              <Label>{item.label}</Label>
            </dt>
            <dd className="m-0 font-mono [overflow-wrap:anywhere]">{item.href ? (
                <a href={item.href} target="_blank" rel="noopener noreferrer" className="underline">
                  {item.value}
                </a>
              ) : (
                item.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Window>
  )
}
