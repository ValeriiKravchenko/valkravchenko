import { useDictionary } from '../../i18n'
import { TrainerPanel } from './TrainerPanel'

export interface TrainerMission {
  id: string
  text: string
  hint: string
  done: boolean
}

/**
 * List of missions with a visible mark and a hidden "done / not done" word for
 * screen readers, so the state does not rest on colour or a symbol alone.
 * Presentation only.
 */
export function TrainerMissions({ title, missions }: { title: string; missions: readonly TrainerMission[] }) {
  const t = useDictionary()

  return (
    <TrainerPanel title={title}>
      <ul className="m-0 list-none space-y-3 p-0">
        {missions.map((m) => (
          <li key={m.id} data-done={m.done} className={`flex items-start gap-3 ${m.done ? 'text-muted' : ''}`}>
            <span aria-hidden="true" className="font-mono text-accent">
              {m.done ? '✓' : '—'}
            </span>
            <span className={m.done ? 'line-through' : ''}>
              <span className="sr-only">{m.done ? t.trainers.missionDone : t.trainers.missionTodo} </span>
              {m.text}
              <span className="mt-1 block font-mono text-[13px] text-muted">{m.hint}</span>
            </span>
          </li>
        ))}
      </ul>
    </TrainerPanel>
  )
}
