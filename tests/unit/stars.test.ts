import { describe, expect, it } from "vitest"

import { starsFromBox, starsLabel } from "@/lib/domain/stars"

describe("starsFromBox (R3.1)", () => {
  it("AC: box 3 → 3 filled, 2 empty", () => {
    expect(starsFromBox(3)).toEqual({ filled: 3, empty: 2 })
  })

  it.each([0, 1, 2, 3, 4, 5])("box %i always totals 5 stars", (box) => {
    const { filled, empty } = starsFromBox(box)
    expect(filled).toBe(box)
    expect(filled + empty).toBe(5)
  })

  it.each([-1, 6, 2.5, Number.NaN])("rejects box %s", (box) => {
    expect(() => starsFromBox(box)).toThrow(RangeError)
  })
})

describe("starsLabel (NFR5)", () => {
  it("describes the level as text", () => {
    expect(starsLabel(3)).toBe("熟悉度 3 / 5")
    expect(starsLabel(0)).toBe("熟悉度 0 / 5")
  })
})
