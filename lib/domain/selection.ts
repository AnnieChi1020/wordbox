import { shuffle, type Rng } from "./random"

/** Maximum number of questions per session (R5.1). */
export const SESSION_SIZE = 8

export type WordState = { id: string; box: number; nextDueOn: string }

/**
 * R5.1: the candidate sequence for a review session (design §7.4).
 * Due words first, by next_due_on oldest to newest with random order within a date; then words that are not due, by box low to high and next_due_on near to far.
 * Returns the full sequence: the caller takes the first SESSION_SIZE in order and continues down the list when a word cannot get a question (R6.6).
 */
export function orderSessionCandidates<T extends WordState>(
  words: readonly T[],
  today: string,
  rng: Rng,
): T[] {
  // Shuffle first, then stable sort, so the order within a date is random
  const due = shuffle(
    words.filter((w) => w.nextDueOn <= today),
    rng,
  ).sort((a, b) => compare(a.nextDueOn, b.nextDueOn))
  const notDue = words
    .filter((w) => w.nextDueOn > today)
    .sort((a, b) => a.box - b.box || compare(a.nextDueOn, b.nextDueOn))
  return [...due, ...notDue]
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
