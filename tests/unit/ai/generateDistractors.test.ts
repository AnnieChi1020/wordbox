import { describe, expect, it, vi } from "vitest"

import type { AiClient } from "@/lib/ai/client"
import {
  generateDistractors,
  type DistractorRequest,
} from "@/lib/ai/generateDistractors"
import type { AiCallLog } from "@/lib/ai/log"
import {
  mockClient,
  MOCK_DISTRACTOR_FAIL_INPUT,
  MOCK_TIMEOUT_INPUT,
} from "@/lib/ai/mock"

function setup(client: AiClient = mockClient) {
  const logs: AiCallLog[] = []
  const log = vi.fn(async (entry: AiCallLog) => {
    logs.push(entry)
  })
  return {
    logs,
    run: (request: DistractorRequest, timeoutMs = 1000) =>
      generateDistractors(request, { client, log, timeoutMs }),
  }
}

const returning = (raw: unknown): AiClient => ({
  completeJson: async () => raw,
})

const wordToZh: DistractorRequest = {
  type: "word_to_zh",
  prompt: "apple",
  pos: "noun",
  answer: "蘋果",
  synonyms: [],
  antonyms: [],
}

describe("generateDistractors (R6.5)", () => {
  it("returns 3 options in the answer's language and logs the quiz word (R2.12)", async () => {
    const { run, logs } = setup()
    const result = await run(wordToZh)
    expect(result).toEqual({
      status: "ok",
      options: ["干擾選項甲", "干擾選項乙", "干擾選項丙"],
    })
    expect(logs).toEqual([
      { kind: "distractors", input: "apple", success: true },
    ])
  })

  it("uses the answer as the quiz word for zh_to_word", async () => {
    const { run, logs } = setup()
    const result = await run({
      type: "zh_to_word",
      prompt: "蘋果",
      pos: "noun",
      answer: "apple",
      synonyms: [],
      antonyms: [],
    })
    expect(result).toMatchObject({ status: "ok" })
    if (result.status === "ok") {
      expect(result.options.every((o) => /^[a-z ]+$/.test(o))).toBe(true)
    }
    expect(logs[0].input).toBe("apple")
  })

  it("sends the synonyms to avoid in the user message", async () => {
    const completeJson = vi.fn(async () => ({ options: ["a", "b", "c"] }))
    await setup({ completeJson }).run({
      ...wordToZh,
      type: "word_to_synonym",
      prompt: "fast",
      answer: "quick",
      synonyms: ["quick", "rapid"],
    })
    const [request] = completeJson.mock.calls[0] as unknown as [
      { name: string; user: string },
    ]
    expect(request.name).toBe("distractors_word_to_synonym")
    expect(request.user).toContain("quick, rapid")
    expect(request.user).toContain("correct answer: quick")
  })

  it("sends the antonyms for word_to_antonym", async () => {
    const completeJson = vi.fn(async () => ({ options: ["a", "b", "c"] }))
    await setup({ completeJson }).run({
      ...wordToZh,
      type: "word_to_antonym",
      prompt: "hot",
      pos: "adjective",
      answer: "cold",
      synonyms: ["warm"],
      antonyms: ["cold", "cool"],
    })
    const [request] = completeJson.mock.calls[0] as unknown as [
      { name: string; user: string },
    ]
    expect(request.name).toBe("distractors_word_to_antonym")
    expect(request.user).toContain("antonyms of the quiz word: cold, cool")
    expect(request.user).toContain("never use): warm")
  })

  it("returns English mock options for word_to_antonym", async () => {
    const result = await setup().run({
      ...wordToZh,
      type: "word_to_antonym",
      prompt: "hot",
      answer: "cold",
      antonyms: ["cold"],
    })
    expect(result).toEqual({
      status: "ok",
      options: ["decoy alpha", "decoy bravo", "decoy charlie"],
    })
  })

  it("uses the word, not the sentence, as the quiz word for cloze", async () => {
    const completeJson = vi.fn(async () => ({ options: ["a", "b", "c"] }))
    const { run, logs } = setup({ completeJson })
    await run({
      ...wordToZh,
      type: "cloze",
      prompt: "I eat an ___ every day.",
      answer: "apple",
    })
    const [request] = completeJson.mock.calls[0] as unknown as [
      { name: string; user: string },
    ]
    expect(request.name).toBe("distractors_cloze")
    expect(request.user).toContain("quiz word: apple")
    expect(request.user).toContain("question shown: I eat an ___ every day.")
    expect(logs[0].input).toBe("apple")
  })

  it("returns English mock options for cloze", async () => {
    const result = await setup().run({
      ...wordToZh,
      type: "cloze",
      prompt: "I eat an ___ every day.",
      answer: "apple",
    })
    expect(result).toEqual({
      status: "ok",
      options: ["decoy alpha", "decoy bravo", "decoy charlie"],
    })
  })

  it("fails on timeout and logs the failure (R2.10)", async () => {
    const { run, logs } = setup()
    const result = await run({ ...wordToZh, prompt: MOCK_TIMEOUT_INPUT }, 50)
    expect(result).toEqual({ status: "error", reason: "timeout" })
    expect(logs[0]).toMatchObject({ kind: "distractors", success: false })
  })

  it("fails for the mock failure word (R6.6)", async () => {
    const result = await setup().run({
      ...wordToZh,
      prompt: MOCK_DISTRACTOR_FAIL_INPUT,
    })
    expect(result).toEqual({ status: "error", reason: "format" })
  })

  it.each([
    ["too few options", { options: ["a", "b"] }],
    ["blank option", { options: ["a", " ", "c"] }],
    ["duplicate options", { options: ["Run", "walk", "run"] }],
    ["wrong shape", { choices: ["a", "b", "c"] }],
  ])("fails on %s", async (_, raw) => {
    const result = await setup(returning(raw)).run(wordToZh)
    expect(result).toEqual({ status: "error", reason: "format" })
  })

  it("fails on API errors", async () => {
    const client: AiClient = {
      completeJson: async () => {
        throw new Error("rate limited")
      },
    }
    vi.spyOn(console, "error").mockImplementation(() => {})
    const result = await setup(client).run(wordToZh)
    expect(result).toEqual({ status: "error", reason: "api" })
  })

  it("still returns the result when logging fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const result = await generateDistractors(wordToZh, {
      client: mockClient,
      log: async () => {
        throw new Error("db down")
      },
    })
    expect(result.status).toBe("ok")
  })
})
