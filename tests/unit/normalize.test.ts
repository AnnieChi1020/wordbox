import { describe, expect, it } from "vitest"

import { dedupeKey, isValidInput, normalizeInput } from "@/lib/domain/normalize"

describe("normalizeInput (R2.2)", () => {
  it("trims and collapses whitespace — AC: `  Give   up ` → `Give up`", () => {
    expect(normalizeInput("  Give   up ")).toBe("Give up")
  })

  it("collapses tabs and newlines", () => {
    expect(normalizeInput("\tlook\n\n up \t")).toBe("look up")
  })

  it("keeps a single word unchanged", () => {
    expect(normalizeInput("apple")).toBe("apple")
  })
})

describe("isValidInput (R2.3)", () => {
  it.each([
    "a",
    "apple",
    "Give up",
    "mother-in-law",
    "don't",
    "rock 'n' roll",
    "a".repeat(64),
  ])("accepts %j", (s) => expect(isValidInput(s)).toBe(true))

  it.each([
    ["empty", ""],
    ["65 chars", "a".repeat(65)],
    ["starts with digit", "1st"],
    ["starts with hyphen", "-ish"],
    ["starts with apostrophe", "'til"],
    ["starts with space", " apple"],
    ["digit inside", "covid19"],
    ["punctuation", "apple!"],
    ["non-ASCII letter", "café"],
    ["Chinese", "蘋果"],
    ["underscore", "snake_case"],
  ])("rejects %s", (_, s) => expect(isValidInput(s)).toBe(false))
})

describe("dedupeKey (R2.4)", () => {
  it("is case-insensitive — AC: `Apple` matches `apple`", () => {
    expect(dedupeKey("Apple")).toBe(dedupeKey("apple"))
  })

  it("normalizes whitespace before comparing", () => {
    expect(dedupeKey("  GIVE   Up")).toBe("give up")
  })
})
