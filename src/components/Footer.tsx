export interface FooterProps {
  text: string
}

export function Footer({ text }: FooterProps) {
  return (
    <footer className="mt-11 border-t border-bar-line py-6 text-[15px] text-bar-ink">
      <p className="m-0">{text}</p>
    </footer>
  )
}
