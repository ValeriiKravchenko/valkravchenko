import { PROJECTS } from '../data/projects'
import { useDictionary } from '../i18n'
import { Window } from './Window'

function Prompt() {
  const t = useDictionary()
  return (
    <>
      <span className="text-term-prompt">{t.home.terminal.host}</span>
      <span className="text-term-dim">:~$</span>{' '}
    </>
  )
}

/** Terminal window for the home page: a static `ls projects` session. */
export function TerminalWindow() {
  const t = useDictionary()
  const { terminal } = t.home

  return (
    <Window
      title={terminal.title}
      titleAs="p"
      small
      bodyClassName="bg-term p-5"
      className="border-term-line!"
    >
      <div className="font-mono text-[13.5px] leading-[1.7] text-term-ink [overflow-wrap:anywhere] whitespace-pre-wrap">
        <div>
          <Prompt />
          {terminal.listCommand}
        </div>
        <ul aria-label={terminal.listCommand} className="m-0 list-none p-0">
          {PROJECTS.map((project) => (
            <li key={project.id}>{project.id}</li>
          ))}
        </ul>
        <div>
          <Prompt />
          {terminal.readCommand}
        </div>
        <div>{terminal.about}</div>
        <div className="text-term-dim">{terminal.note}</div>
        <div>
          <Prompt />
          <span aria-hidden="true" className="term-cursor" />
        </div>
      </div>
    </Window>
  )
}
