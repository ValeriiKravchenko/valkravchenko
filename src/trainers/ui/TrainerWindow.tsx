import type { ReactNode } from 'react'
import { Button } from '../../components/Button'
import { LinkButton } from '../../components/LinkButton'
import { PageHeading } from '../../components/PageHeading'
import { Window } from '../../components/Window'
import { TRAINERS_HOME_PATH } from '../../trainers-app/paths'
import { useDictionary } from '../../i18n'

export interface TrainerWindowProps {
  /** Window title, "sky-os — <name>". */
  windowTitle: string
  /** Page `h1`. */
  heading: string
  /** Short line under the heading (section name). */
  subheading?: string
  intro?: string
  /** Buttons next to the heading, for example "start over". */
  actions?: ReactNode
  children: ReactNode
}

/**
 * Page shell of a trainer screen: window, back link to the list of trainers, link to the main site,
 * `h1`, intro and the screen body. Presentation only.
 */
export function TrainerWindow({
  windowTitle,
  heading,
  subheading,
  intro,
  actions,
  children,
}: TrainerWindowProps) {
  const t = useDictionary()

  return (
    <Window title={windowTitle} titleAs="p" className="mx-auto max-w-[1100px]">
      <div className="flex flex-wrap gap-3">
        <LinkButton to={TRAINERS_HOME_PATH}>{t.trainers.backLabel}</LinkButton>
        {/* Plain anchor: leaves the trainers page for the main site with a full load. */}
        <Button href="/">{t.trainers.siteLink}</Button>
      </div>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <PageHeading>{heading}</PageHeading>
          {subheading && <p className="m-0 mt-2 font-mono text-[15px] text-muted">{subheading}</p>}
        </div>
        {actions}
      </div>
      {intro && <p className="m-0 mt-4 max-w-[65ch]">{intro}</p>}
      <div className="mt-8 flex flex-col gap-6">{children}</div>
    </Window>
  )
}
