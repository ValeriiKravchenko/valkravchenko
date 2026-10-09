import { useDictionary } from '../i18n'
import { Window } from './Window'

/** Home page window: automation results as "project: before to after" rows. */
export function BeforeAfterWindow() {
  const t = useDictionary()
  const { beforeAfter } = t.home

  return (
    <Window title={beforeAfter.title} titleAs="p" small bodyClassName="p-5">
      <ul className="m-0 flex list-none flex-col gap-4 p-0 font-mono text-[13.5px] leading-[1.7]">
        {beforeAfter.rows.map((row) => (
          <li key={row.project} className="[overflow-wrap:anywhere]">
            <span className="block font-semibold text-teal">{row.project}</span>
            <span className="text-muted">{row.before}</span>
            <span className="text-accent">{' → '}</span>
            <span className="font-semibold text-ink">{row.after}</span>
          </li>
        ))}
      </ul>
    </Window>
  )
}
