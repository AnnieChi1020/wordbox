import { addDays } from "./dates"
import { MAX_STARS } from "./stars"

/** Review interval (days) for each box, index = box (R7.4). */
const BASE_INTERVAL = [0, 1, 2, 4, 8, 16] as const

/** R7.4: important intervals are halved and rounded up, at least 1 day. */
export function intervalDays(box: number, important: boolean): number {
  const days = BASE_INTERVAL[box]
  if (days === undefined) throw new RangeError(`invalid box: ${box}`)
  return important ? Math.max(1, Math.ceil(days / 2)) : days
}

export type ReviewState = {
  box: number
  nextDueOn: string
  isImportant: boolean
}

export type ReviewOutcome = { box: number; nextDueOn: string; wasDue: boolean }

/**
 * R7.4: update familiarity from an answer. today is the user's local today.
 * A wrong answer always resets to zero and is reviewed tomorrow (D16); a correct answer on a word that is not due (a filler word) changes nothing (D3).
 */
export function applyAnswer(
  state: ReviewState,
  isCorrect: boolean,
  today: string,
): ReviewOutcome {
  const wasDue = state.nextDueOn <= today
  if (!isCorrect) return { box: 0, nextDueOn: addDays(today, 1), wasDue }
  if (!wasDue) return { box: state.box, nextDueOn: state.nextDueOn, wasDue }
  const box = Math.min(state.box + 1, MAX_STARS)
  return {
    box,
    nextDueOn: addDays(today, intervalDays(box, state.isImportant)),
    wasDue,
  }
}
