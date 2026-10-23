/** Returns a random number in [0, 1); all randomness is injected as a parameter so tests can reproduce it with a fixed seed (design §7.5). */
export type Rng = () => number

export const defaultRng: Rng = Math.random

/** A seedable rng (mulberry32). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A random integer from 0 to n - 1. */
export function randomInt(n: number, rng: Rng): number {
  return Math.floor(rng() * n)
}

/** Picks a random element; undefined for an empty array. */
export function pick<T>(items: readonly T[], rng: Rng): T | undefined {
  return items.length === 0 ? undefined : items[randomInt(items.length, rng)]
}

/** Returns a shuffled copy (Fisher–Yates) without modifying the original array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
