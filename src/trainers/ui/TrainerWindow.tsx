import type { ReactNode } from 'react'
import { LinkButton } from '../../components/LinkButton'
import { PageHeading } from '../../components/PageHeading'
import { Window } from '../../components/Window'
import { getSectionPath } from '../../data/sections'
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
 * Page shell of a trainer screen: window, back link to the trainers page,
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
      <LinkButton to={getSectionPath('trainers') ?? '/trainers'}>{t.trainers.backLabel}</LinkButton>
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
