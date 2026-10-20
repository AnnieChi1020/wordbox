import { describe, expect, it } from "vitest"

import {
  isPartOfSpeech,
  POS_ABBR,
  POS_VALUES,
  posTags,
  type PartOfSpeech,
} from "@/lib/domain/pos"

describe("POS (R2.11)", () => {
  it("defines the ten parts of speech with their abbreviations", () => {
    expect(POS_ABBR).toEqual({
      noun: "n.",
      verb: "v.",
      adjective: "adj.",
      adverb: "adv.",
      pronoun: "pron.",
      preposition: "prep.",
      conjunction: "conj.",
      interjection: "interj.",
      determiner: "det.",
      phrase: "phr.",
    })
    expect(Object.keys(POS_ABBR)).toEqual([...POS_VALUES])
  })

  it("recognises valid values only", () => {
    expect(isPartOfSpeech("verb")).toBe(true)
    expect(isPartOfSpeech("Verb")).toBe(false)
    expect(isPartOfSpeech("article")).toBe(false)
    expect(isPartOfSpeech(undefined)).toBe(false)
  })
})

describe("posTags (R3.1)", () => {
  const senses = (...pos: PartOfSpeech[]) => pos.map((p) => ({ pos: p }))

  it("dedupes in sense order", () => {
    expect(posTags(senses("verb", "noun", "verb"))).toEqual(["v.", "n."])
  })

  it("returns a single tag for one sense", () => {
    expect(posTags(senses("phrase"))).toEqual(["phr."])
  })

  it("returns an empty list without senses", () => {
    expect(posTags([])).toEqual([])
  })
})
