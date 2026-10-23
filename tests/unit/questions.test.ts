import { describe, expect, it } from "vitest"

import type { PartOfSpeech } from "@/lib/domain/pos"
import {
  availableTypes,
  buildQuestion,
  CLOZE_BLANK,
  clozeSentence,
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
  antonyms: string[] = [],
  examples: string[] = [],
): QuestionSense {
  return { id: `s${nextId++}`, pos, def_zh, synonyms, antonyms, examples }
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
    expect(availableTypes({ text: "w" }, s("verb", "跑", ["sprint"]))).toEqual([
      "word_to_zh",
      "word_to_synonym",
      "zh_to_word",
    ])
  })

  it("offers word_to_antonym when the sense has antonyms", () => {
    expect(
      availableTypes({ text: "w" }, s("adjective", "熱的", [], ["cold"])),
    ).toEqual(["word_to_zh", "word_to_antonym", "zh_to_word"])
  })

  it("excludes word_to_antonym when the sense has no antonyms (R7 AC)", () => {
    expect(
      availableTypes({ text: "w" }, s("verb", "跑", ["sprint"])),
    ).not.toContain("word_to_antonym")
  })

  it("offers cloze only when an example contains the word (R7 AC)", () => {
    const sense = s("verb", "跑", [], [], ["He ran to catch the bus."])
    expect(availableTypes({ text: "run" }, sense)).not.toContain("cloze")
    sense.examples.push("I run every morning.")
    expect(availableTypes({ text: "run" }, sense)).toEqual([
      "word_to_zh",
      "zh_to_word",
      "cloze",
    ])
  })

  it("excludes word_to_synonym when the sense has no synonyms (R7 AC)", () => {
    expect(availableTypes({ text: "w" }, s("noun", "蘋果"))).toEqual([
      "word_to_zh",
      "zh_to_word",
    ])
  })
})

describe("clozeSentence (R6.1, D27)", () => {
  it("blanks every whole-word occurrence, ignoring case", () => {
    expect(clozeSentence("Run, run as fast as you RUN.", "run")).toBe(
      `${CLOZE_BLANK}, ${CLOZE_BLANK} as fast as you ${CLOZE_BLANK}.`,
    )
    expect(clozeSentence("monday is busy.", "Monday")).toBe(
      `${CLOZE_BLANK} is busy.`,
    )
  })

  it("matches phrases across extra whitespace", () => {
    expect(clozeSentence("Never give   up on it.", "give up")).toBe(
      `Never ${CLOZE_BLANK} on it.`,
    )
  })

  it("does not match inside other words", () => {
    expect(clozeSentence("I like running and brunch.", "run")).toBeNull()
    expect(clozeSentence("A well-known run-down shop.", "known")).toBeNull()
  })

  it("keeps punctuation and possessives around the word", () => {
    expect(clozeSentence("The apple's skin (apple) is red.", "apple")).toBe(
      `The ${CLOZE_BLANK}'s skin (${CLOZE_BLANK}) is red.`,
    )
  })

  it("returns null when only an inflected form appears", () => {
    expect(clozeSentence("He ran to catch the bus.", "run")).toBeNull()
    expect(clozeSentence("She gave up smoking.", "give up")).toBeNull()
  })

  it("treats regex characters in the word literally", () => {
    expect(clozeSentence("Is it a.b or ab?", "a.b")).toBe(
      `Is it ${CLOZE_BLANK} or ab?`,
    )
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

  it("builds word_to_antonym with one of the sense's antonyms as the answer", () => {
    const hot = w("hot", s("adjective", "熱的", ["warm"], ["cold", "cool"]))
    const others = [
      w("big", s("adjective", "大的", [], ["small"])),
      w("fast", s("adjective", "快的", [], ["slow"])),
      w("up", s("adverb", "向上", [], ["down"])),
    ]
    const q = question(build(hot, "word_to_antonym", [hot, ...others]))
    expect(q).toMatchObject({ type: "word_to_antonym", prompt: "hot" })
    expect(["cold", "cool"]).toContain(q.answer)
    expect(distractorsOf(q).sort()).toEqual(["down", "slow", "small"])
  })

  it("builds cloze from an example that contains the word, with the word as the answer", () => {
    const run = w(
      "run",
      s("verb", "跑", [], [], ["He ran to catch the bus.", "I run every day."]),
    )
    for (const seed of [1, 2, 3, 4]) {
      const q = question(build(run, "cloze", [run, ...pool], seed))
      expect(q).toMatchObject({
        type: "cloze",
        prompt: `I ${CLOZE_BLANK} every day.`,
        answer: "run",
      })
      expect(q.options).toHaveLength(4)
    }
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

    it("word_to_antonym: drops the target word and all of its synonyms and antonyms", () => {
      const light = w(
        "light",
        s("adjective", "輕的", ["weightless"], ["heavy"]),
        s("noun", "光", ["glow"], ["darkness"]),
      )
      const others = [
        w("bright", s("adjective", "明亮的", [], ["Darkness", "LIGHT", "dim"])),
        w("dark", s("adjective", "暗的", [], ["glow", "weightless"])),
        w("full", s("adjective", "滿的", [], ["heavy ", "empty"])),
      ]
      expect(
        draft(build(light, "word_to_antonym", others)).distractors.sort(),
      ).toEqual(["dim", "empty"])
    })

    it("cloze: drops words that are synonyms or antonyms of the target", () => {
      const run = w(
        "run",
        s("verb", "跑", ["sprint"], ["walk"], ["I run every day."]),
        s("noun", "跑步", [], ["rest"], []),
      )
      const others = [
        w("sprint", s("verb", "衝刺")),
        w("Walk", s("verb", "走")),
        w("rest", s("verb", "休息")),
        w("swim", s("verb", "游泳")),
      ]
      expect(draft(build(run, "cloze", others)).distractors).toEqual(["swim"])
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
    // The correct answer, duplicates, and options equal to candidates from the user's words cannot be used
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
  const sense = {
    def_zh: "快的",
    synonyms: ["quick", "rapid"],
    antonyms: ["slow", "sluggish"],
  }

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
      findCorrectOption("word_to_antonym", word, sense, [
        "quick",
        "Slow",
        "big",
        "small",
      ]),
    ).toBe("Slow")
    expect(
      findCorrectOption("cloze", word, sense, ["slow", "FAST", "big", "small"]),
    ).toBe("FAST")
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
    expect(
      findCorrectOption("word_to_antonym", word, sense, [
        "slow",
        "sluggish",
        "big",
        "small",
      ]),
    ).toBeNull()
  })
})
