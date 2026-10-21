import { addDays } from "./dates"
import { MAX_STARS } from "./stars"

/** 各 box 的複習間隔（天），index = box（R7.4）。 */
const BASE_INTERVAL = [0, 1, 2, 4, 8, 16] as const

/** R7.4：important 的間隔減半並無條件進位，至少 1 天。 */
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
 * R7.4：依作答結果更新熟悉度。today 為使用者當地的今天。
 * 答錯一律歸零、明天複習（D16）；答對但未到期（補位字）不變（D3）。
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
