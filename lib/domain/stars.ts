export const MAX_STARS = 5

/** Familiarity stars = Leitner box (0–5). */
export function starsFromBox(box: number): { filled: number; empty: number } {
  if (!Number.isInteger(box) || box < 0 || box > MAX_STARS) {
    throw new RangeError(`box must be an integer between 0 and ${MAX_STARS}`)
  }
  return { filled: box, empty: MAX_STARS - box }
}

/** NFR5: the text alternative for stars. */
export function starsLabel(box: number): string {
  return `熟悉度 ${starsFromBox(box).filled} / ${MAX_STARS}`
}
