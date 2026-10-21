import { describe, expect, it } from "vitest"

import {
  EditWordSchema,
  fieldErrors,
  splitLines,
  splitList,
} from "@/lib/words/editSchema"

const sense = (overrides: Record<string, unknown> = {}) => ({
  pos: "verb",
  def_en: "to move fast",
  def_zh: "跑",
  synonyms: ["sprint"],
  antonyms: [],
  examples: ["I run."],
  ...overrides,
})

function errorsOf(input: unknown) {
  const result = EditWordSchema.safeParse(input)
  if (result.success) return {}
  return fieldErrors(result.error)
}

describe("EditWordSchema (R4.3, R4.4)", () => {
  it("accepts valid content and turns a blank IPA into null", () => {
    const result = EditWordSchema.parse({ ipa: "  ", senses: [sense()] })
    expect(result.ipa).toBeNull()
    expect(result.senses[0].def_zh).toBe("跑")
  })

  it("keeps existing sense ids", () => {
    const id = "6f1c2c6e-6d1b-4b6a-9d0e-2a3b4c5d6e7f"
    expect(
      EditWordSchema.parse({ ipa: null, senses: [sense({ id })] }).senses[0].id,
    ).toBe(id)
  })

  it.each([
    [{ def_en: " " }, "senses.0.def_en", "請輸入英文解釋"],
    [{ def_zh: "" }, "senses.0.def_zh", "請輸入中文解釋"],
    [
      { synonyms: ["a", "b", "c", "d", "e", "f"] },
      "senses.0.synonyms",
      "同義詞最多 5 個",
    ],
    [
      { antonyms: ["a", "b", "c", "d", "e", "f"] },
      "senses.0.antonyms",
      "反義詞最多 5 個",
    ],
    [{ examples: ["a", "b", "c"] }, "senses.0.examples", "例句最多 2 句"],
    [{ pos: "article" }, "senses.0.pos", "請選擇詞性"],
  ])("marks %j as an error on %s", (overrides, path, message) => {
    expect(errorsOf({ ipa: null, senses: [sense(overrides)] })).toEqual({
      [path]: message,
    })
  })

  it.each([
    [[], "至少要有 1 個義項"],
    [[sense(), sense(), sense(), sense()], "最多 3 個義項"],
  ])("requires 1–3 senses", (senses, message) => {
    expect(errorsOf({ ipa: null, senses })).toEqual({ senses: message })
  })

  it("reports every invalid field", () => {
    expect(
      errorsOf({
        ipa: null,
        senses: [sense({ def_zh: "" }), sense({ def_en: "" })],
      }),
    ).toEqual({
      "senses.0.def_zh": "請輸入中文解釋",
      "senses.1.def_en": "請輸入英文解釋",
    })
  })
})

describe("form text helpers", () => {
  it("splits comma lists, including full-width separators, and dedupes", () => {
    expect(splitList(" sprint, jog，dash、 Jog ,, ")).toEqual([
      "sprint",
      "jog",
      "dash",
    ])
    expect(splitList("")).toEqual([])
  })

  it("splits examples by line", () => {
    expect(splitLines("I run.\n\n  She runs.  \r\nI run.")).toEqual([
      "I run.",
      "She runs.",
    ])
  })
})
