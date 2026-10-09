import photo440 from '../assets/about/about-440x550.webp'
import photo760 from '../assets/about/about-760x950.webp'
import { ABOUT_PATH } from '../data/aboutPaths'
import { useDictionary } from '../i18n'
import { LinkButton } from './LinkButton'
import { Window } from './Window'

/** Home page card: photo, name, one line about me and a link to the About page. */
export function AboutCard() {
  const t = useDictionary()
  const card = t.home.aboutCard

  return (
    <Window title={card.windowTitle} titleAs="p" small bodyClassName="p-4">
      <div className="flex items-start gap-4">
        <img
          src={photo440}
          srcSet={`${photo440} 440w, ${photo760} 760w`}
          sizes="112px"
          width={440}
          height={550}
          alt={t.about.photoAlt}
          decoding="async"
          className="h-auto w-28 shrink-0 rounded-window border border-border object-cover"
        />
        <div className="min-w-0">
          <h2 className="m-0 text-[17px] font-semibold text-ink">{card.name}</h2>
          <p className="mt-2 mb-4">{card.summary}</p>
          <LinkButton to={ABOUT_PATH} variant="secondary">
            {card.button}
          </LinkButton>
        </div>
      </div>
    </Window>
  )
}
