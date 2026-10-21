import { describe, expect, it } from "vitest"

import { seededRng } from "@/lib/domain/random"
import { orderSessionCandidates, type WordState } from "@/lib/domain/selection"

const TODAY = "2026-10-20"

function word(id: string, box: number, nextDueOn: string): WordState {
  return { id, box, nextDueOn }
}

const ids = (words: WordState[]) => words.map((w) => w.id)

describe("orderSessionCandidates (R5.1)", () => {
  it("puts due words first, oldest due date first", () => {
    const words = [
      word("future", 0, "2026-10-21"),
      word("today", 3, TODAY),
      word("old", 5, "2026-10-01"),
      word("older", 1, "2026-09-15"),
    ]
    expect(ids(orderSessionCandidates(words, TODAY, seededRng(1)))).toEqual([
      "older",
      "old",
      "today",
      "future",
    ])
  })

  it("orders words due on the same date randomly, reproducibly by seed", () => {
    const words = Array.from({ length: 6 }, (_, i) => word(`w${i}`, 0, TODAY))
    const run = (seed: number) =>
      ids(orderSessionCandidates(words, TODAY, seededRng(seed))).join()

    expect(run(1)).toBe(run(1))
    const orders = new Set([1, 2, 3, 4, 5].map(run))
    expect(orders.size).toBeGreaterThan(1)
  })

  it("keeps date order between groups when shuffling ties", () => {
    const words = [
      word("b1", 0, TODAY),
      word("a1", 0, "2026-10-19"),
      word("b2", 0, TODAY),
      word("a2", 0, "2026-10-19"),
    ]
    for (const seed of [1, 2, 3, 4, 5]) {
      const order = ids(orderSessionCandidates(words, TODAY, seededRng(seed)))
      expect(order.slice(0, 2).sort()).toEqual(["a1", "a2"])
      expect(order.slice(2).sort()).toEqual(["b1", "b2"])
    }
  })

  it("fills with not-due words by box, then nearest due date", () => {
    const words = [
      word("due", 4, TODAY),
      word("box3-near", 3, "2026-10-22"),
      word("box1-far", 1, "2026-10-30"),
      word("box3-far", 3, "2026-11-10"),
      word("box1-near", 1, "2026-10-21"),
    ]
    expect(ids(orderSessionCandidates(words, TODAY, seededRng(1)))).toEqual([
      "due",
      "box1-near",
      "box1-far",
      "box3-near",
      "box3-far",
    ])
  })

  it("returns every word exactly once, beyond the session size", () => {
    const words = Array.from({ length: 20 }, (_, i) =>
      word(`w${i}`, i % 6, i % 2 ? TODAY : "2026-10-25"),
    )
    const order = orderSessionCandidates(words, TODAY, seededRng(9))
    expect(order).toHaveLength(20)
    expect(new Set(ids(order)).size).toBe(20)
  })

  it("uses all words when there are fewer than the session size", () => {
    const words = [word("a", 0, "2026-10-25"), word("b", 2, TODAY)]
    expect(ids(orderSessionCandidates(words, TODAY, seededRng(1)))).toEqual([
      "b",
      "a",
    ])
  })

  it("returns an empty list when there are no words", () => {
    expect(orderSessionCandidates([], TODAY, seededRng(1))).toEqual([])
  })
})
