import { render } from '@testing-library/react'
import { SECTION_IDS } from '../data/sections'
import { LogoIcon, SectionIcon, ThemeIcon } from './icons'

describe('icons', () => {
  it('every section has an inline SVG icon hidden from assistive tech', () => {
    for (const id of SECTION_IDS) {
      const { container } = render(<SectionIcon id={id} />)
      const svg = container.querySelector('svg')
      expect(svg).not.toBeNull()
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      expect(container.textContent).toBe('')
    }
  })

  it('theme and logo icons are decorative SVG', () => {
    const { container } = render(
      <>
        <ThemeIcon theme="day" />
        <ThemeIcon theme="night" />
        <LogoIcon />
      </>,
    )
    const svgs = container.querySelectorAll('svg')
    expect(svgs).toHaveLength(3)
    svgs.forEach((svg) => expect(svg).toHaveAttribute('aria-hidden', 'true'))
  })
})
