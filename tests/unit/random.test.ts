import { describe, expect, it } from "vitest"

import { pick, randomInt, seededRng, shuffle } from "@/lib/domain/random"

describe("seededRng", () => {
  it("is reproducible for the same seed", () => {
    const a = seededRng(42)
    const b = seededRng(42)
    const seqA = Array.from({ length: 5 }, a)
    expect(Array.from({ length: 5 }, b)).toEqual(seqA)
    expect(Array.from({ length: 5 }, seededRng(43))).not.toEqual(seqA)
  })

  it("returns numbers in [0, 1)", () => {
    const rng = seededRng(1)
    for (let i = 0; i < 1000; i++) {
      const x = rng()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })
})

describe("randomInt / pick", () => {
  it("covers the whole range", () => {
    const rng = seededRng(7)
    const seen = new Set(Array.from({ length: 200 }, () => randomInt(4, rng)))
    expect([...seen].sort()).toEqual([0, 1, 2, 3])
  })

  it("returns undefined for an empty array", () => {
    expect(pick([], seededRng(1))).toBeUndefined()
    expect(pick(["a"], seededRng(1))).toBe("a")
  })
})

describe("shuffle", () => {
  it("returns a permutation without mutating the input", () => {
    const input = [1, 2, 3, 4, 5, 6]
    const result = shuffle(input, seededRng(3))
    expect(input).toEqual([1, 2, 3, 4, 5, 6])
    expect([...result].sort()).toEqual(input)
  })

  it("produces different orders for different seeds", () => {
    const input = Array.from({ length: 10 }, (_, i) => i)
    const orders = new Set(
      [1, 2, 3, 4, 5].map((seed) => shuffle(input, seededRng(seed)).join()),
    )
    expect(orders.size).toBeGreaterThan(1)
  })
})
