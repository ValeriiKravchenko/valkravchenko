import { ru } from './ru'
import type { Dictionary } from './types'

// Add `en.ts` and pick the locale here when English arrives.
export const dictionary: Dictionary = ru
export type { Dictionary } from './types'

/** Access to the active dictionary. A language switch would plug in here. */
export function useDictionary(): Dictionary {
  return dictionary
}
