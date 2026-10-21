import { describe, expect, it } from "vitest"

import type { PartOfSpeech } from "@/lib/domain/pos"
import {
  availableTypes,
  buildQuestion,
  completeQuestion,
  filterDistractors,
  findCorrectOption,
  type Question,
  type QuestionDraft,
  type QuestionSense,
  type QuestionType,
  type QuestionWord,
} from "@/lib/domain/questions"
import { seededRng } from "@/lib/domain/random"

let nextId = 0

function s(
  pos: PartOfSpeech,
  def_zh: string,
  synonyms: string[] = [],
): QuestionSense {
  return { id: `s${nextId++}`, pos, def_zh, synonyms }
}

function w(text: string, ...senses: QuestionSense[]): QuestionWord {
  return { id: `w-${text}`, text, senses }
}

function build(
  target: QuestionWord,
  type: QuestionType,
  pool: QuestionWord[],
  seed = 1,
  sense = target.senses[0],
) {
  return buildQuestion(target, sense, type, pool, seededRng(seed))
}

function question(result: ReturnType<typeof build>): Question {
  if (!("question" in result)) throw new Error("expected a full question")
  return result.question
}

function draft(result: ReturnType<typeof build>): QuestionDraft {
  if (!("needsAi" in result)) throw new Error("expected a draft")
  return result.needsAi
}

const distractorsOf = (q: Question) => q.options.filter((o) => o !== q.answer)

describe("availableTypes (R6.1)", () => {
  it("offers all three types when the sense has synonyms", () => {
    expect(availableTypes(s("verb", "跑", ["sprint"]))).toEqual([
      "word_to_zh",
      "word_to_synonym",
      "zh_to_word",
    ])
  })

  it("excludes word_to_synonym when the sense has no synonyms (R7 AC)", () => {
    expect(availableTypes(s("noun", "蘋果"))).toEqual([
      "word_to_zh",
      "zh_to_word",
    ])
  })
})

describe("buildQuestion", () => {
  const pool = [
    w("banana", s("noun", "香蕉", ["plantain"])),
    w("orange", s("noun", "柳橙", ["citrus"])),
    w("grape", s("noun", "葡萄", ["vine fruit"])),
    w("quickly", s("adverb", "快速地", ["rapidly"])),
  ]

  it("builds word_to_zh with the sense's Chinese definition as the answer", () => {
    const apple = w("apple", s("noun", "蘋果"))
    const q = question(build(apple, "word_to_zh", [apple, ...pool]))
    expect(q).toMatchObject({
      type: "word_to_zh",
      wordId: apple.id,
      senseId: apple.senses[0].id,
      prompt: "apple",
      pos: "noun",
      answer: "蘋果",
    })
    expect(q.options).toHaveLength(4)
    expect(q.options).toContain("蘋果")
  })

  it("builds zh_to_word with the word as the answer", () => {
    const apple = w("apple", s("noun", "蘋果"))
    const q = question(build(apple, "zh_to_word", [apple, ...pool]))
    expect(q).toMatchObject({ prompt: "蘋果", answer: "apple" })
    expect(distractorsOf(q)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^[a-z]+$/)]),
    )
  })

  it("builds word_to_synonym with one of the sense's synonyms as the answer", () => {
    const fast = w("fast", s("adjective", "快的", ["quick", "rapid"]))
    const q = question(build(fast, "word_to_synonym", [fast, ...pool]))
    expect(["quick", "rapid"]).toContain(q.answer)
    expect(q.prompt).toBe("fast")
  })

  it("shuffles option order by rng", () => {
    const apple = w("apple", s("noun", "蘋果"))
    const positions = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
        const q = question(build(apple, "word_to_zh", pool, seed))
        return q.options.indexOf(q.answer)
      }),
    )
    expect(positions.size).toBeGreaterThan(1)
  })

  it("prefers candidates with the same part of speech (R6.3)", () => {
    const run = w("run", s("verb", "跑"))
    const verbs = ["走", "跳", "游泳"].map((zh, i) =>
      w(`verb${"abc"[i]}`, s("verb", zh)),
    )
    const nouns = ["桌子", "椅子", "窗戶", "門"].map((zh, i) =>
      w(`noun${"abcd"[i]}`, s("noun", zh)),
    )
    for (const seed of [1, 2, 3, 4, 5]) {
      const q = question(build(run, "word_to_zh", [...nouns, ...verbs], seed))
      expect(distractorsOf(q).sort()).toEqual(["游泳", "走", "跳"].sort())
    }
  })

  it("never uses the target word itself as a candidate source", () => {
    const light = w("light", s("noun", "光"), s("adjective", "輕的"))
    const result = build(light, "word_to_zh", [light])
    expect(draft(result).distractors).toEqual([])
  })

  describe("R6.4 exclusions", () => {
    it("word_to_zh: drops candidates equal to any of the target's definitions", () => {
      const light = w("light", s("noun", "光"), s("adjective", "輕的"))
      const others = [
        w("ray", s("noun", "光")),
        w("feather", s("adjective", " 輕的 ")),
        w("bright", s("adjective", "明亮的")),
      ]
      expect(draft(build(light, "word_to_zh", others)).distractors).toEqual([
        "明亮的",
      ])
    })

    it("word_to_synonym: drops the target word and all of its synonyms", () => {
      const fast = w(
        "fast",
        s("adjective", "快的", ["quick"]),
        s("verb", "禁食", ["starve"]),
      )
      const others = [
        w("speedy", s("adjective", "迅速的", ["Quick", "FAST", "rapid"])),
        w("hungry", s("adjective", "餓的", ["starve", "famished"])),
      ]
      expect(
        draft(build(fast, "word_to_synonym", others)).distractors.sort(),
      ).toEqual(["famished", "rapid"])
    })

    it("zh_to_word: drops synonyms of the target and words sharing the question's definition", () => {
      const big = w("big", s("adjective", "大的", ["large"]))
      const others = [
        w("large", s("adjective", "巨大的")),
        w("huge", s("adjective", "大的")),
        w("small", s("adjective", "小的")),
      ]
      expect(draft(build(big, "zh_to_word", others)).distractors).toEqual([
        "small",
      ])
    })

    it("compares case-insensitively after trimming and removes duplicates", () => {
      const apple = w("apple", s("noun", "蘋果"))
      const others = [
        w("Banana", s("noun", "香蕉")),
        w("plantain", s("noun", "香蕉 ")),
        w("pear", s("noun", "梨子")),
      ]
      expect(
        draft(build(apple, "word_to_zh", others)).distractors.sort(),
      ).toEqual(["梨子", "香蕉"])
    })
  })

  it("returns a draft with the missing count and partial candidates", () => {
    const apple = w("apple", s("noun", "蘋果", ["pome"]))
    const d = draft(build(apple, "word_to_zh", [w("pear", s("noun", "梨子"))]))
    expect(d).toMatchObject({
      type: "word_to_zh",
      prompt: "apple",
      answer: "蘋果",
      synonyms: ["pome"],
      distractors: ["梨子"],
      missing: 2,
    })
  })
})

describe("completeQuestion (R6.5, R6.6)", () => {
  const apple = w("apple", s("noun", "蘋果", ["pome"]))
  const partial = () =>
    draft(build(apple, "word_to_zh", [w("pear", s("noun", "梨子"))]))

  it("fills the missing distractors from AI options", () => {
    const q = completeQuestion(
      partial(),
      ["香蕉", "葡萄", "芒果"],
      seededRng(1),
    )
    expect(q?.options.sort()).toEqual(["梨子", "葡萄", "蘋果", "香蕉"].sort())
  })

  it("filters AI options with the same R6.4 rules", () => {
    // 正確答案、重複、與字庫候選相同的都不能用
    const q = completeQuestion(
      partial(),
      ["蘋果", "梨子", "香蕉", "香蕉", "葡萄"],
      seededRng(1),
    )
    expect(q && distractorsOf(q).sort()).toEqual(
      ["梨子", "葡萄", "香蕉"].sort(),
    )
  })

  it("returns null when still short after filtering", () => {
    expect(
      completeQuestion(partial(), ["蘋果", "香蕉"], seededRng(1)),
    ).toBeNull()
  })
})

describe("filterDistractors", () => {
  it("keeps order, trims, and drops blanks, duplicates and excluded keys", () => {
    expect(
      filterDistractors(
        ["  Run ", "", "walk", "RUN", "jog", "sprint"],
        new Set(["sprint"]),
      ),
    ).toEqual(["Run", "walk", "jog"])
  })
})

describe("findCorrectOption (R7.3)", () => {
  const word = { text: "fast" }
  const sense = { def_zh: "快的", synonyms: ["quick", "rapid"] }

  it("finds the answer for each question type", () => {
    expect(
      findCorrectOption("word_to_zh", word, sense, [
        "慢的",
        "快的",
        "大的",
        "小的",
      ]),
    ).toBe("快的")
    expect(
      findCorrectOption("word_to_synonym", word, sense, [
        "slow",
        "Rapid",
        "big",
        "small",
      ]),
    ).toBe("Rapid")
    expect(
      findCorrectOption("zh_to_word", word, sense, [
        "slow",
        "Fast",
        "big",
        "small",
      ]),
    ).toBe("Fast")
  })

  it("returns null when no option or more than one option matches", () => {
    expect(
      findCorrectOption("word_to_zh", word, sense, [
        "慢的",
        "大的",
        "小的",
        "高的",
      ]),
    ).toBeNull()
    expect(
      findCorrectOption("word_to_synonym", word, sense, [
        "quick",
        "rapid",
        "big",
        "small",
      ]),
    ).toBeNull()
  })
})
