import { Label } from './Label'
import { Window } from './Window'

export interface ContactItem {
  label: string
  value: string
}

export interface ContactsWindowProps {
  title: string
  intro: string
  items: ContactItem[]
  id?: string
}

export function ContactsWindow({ title, intro, items, id }: ContactsWindowProps) {
  return (
    <Window title={title} id={id}>
      <p className="m-0 mb-4">{intro}</p>
      <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
        {items.map((item) => (
          <div key={item.label} className="contents">
            <dt>
              <Label font="pixel">{item.label}</Label>
            </dt>
            <dd className="m-0 font-mono">{item.value}</dd>
          </div>
        ))}
      </dl>
    </Window>
  )
}
