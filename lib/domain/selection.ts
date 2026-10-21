import { shuffle, type Rng } from "./random"

/** 一輪複習的題數上限（R5.1）。 */
export const SESSION_SIZE = 8

export type WordState = { id: string; box: number; nextDueOn: string }

/**
 * R5.1：一輪複習的候選序列（design §7.4）。
 * 到期的字在前，依 next_due_on 舊→新、同日期隨機；接著是未到期的字，依 box 低→高、next_due_on 近→遠。
 * 回傳完整序列：呼叫端依序取前 SESSION_SIZE 個，無法出題時繼續往下遞補（R6.6）。
 */
export function orderSessionCandidates<T extends WordState>(
  words: readonly T[],
  today: string,
  rng: Rng,
): T[] {
  // 先打亂再做穩定排序，同日期的順序即為隨機
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
