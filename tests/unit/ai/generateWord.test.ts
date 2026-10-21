import { afterEach, describe, expect, it, vi } from "vitest"

import { getAiClient, type AiClient } from "@/lib/ai/client"
import { generateWord } from "@/lib/ai/generateWord"
import type { AiCallLog } from "@/lib/ai/log"
import {
  mockClient,
  MOCK_MALFORMED_INPUT,
  MOCK_TIMEOUT_INPUT,
} from "@/lib/ai/mock"
import { posTags } from "@/lib/domain/pos"

function setup(client: AiClient = mockClient) {
  const logs: AiCallLog[] = []
  const log = vi.fn(async (entry: AiCallLog) => {
    logs.push(entry)
  })
  return {
    logs,
    run: (
      input: string,
      opts: { kind?: "generate" | "regenerate"; timeoutMs?: number } = {},
    ) => generateWord(input, { client, log, ...opts }),
  }
}

/** 回傳固定 JSON 的假 client */
const returning = (raw: unknown): AiClient => ({
  completeJson: async () => raw,
})

const validEntry = (overrides: Record<string, unknown> = {}) => ({
  is_valid: true,
  suggestions: [],
  headword: "test",
  ipa: "/test/",
  senses: [
    {
      pos: "noun",
      def_en: "a test",
      def_zh: "測試",
      synonyms: [],
      antonyms: [],
      examples: ["This is a test."],
    },
  ],
  ...overrides,
})

describe("generateWord with fixtures", () => {
  it("returns a valid entry for `apple` and logs success (R2.7, R2.12)", async () => {
    const { run, logs } = setup()
    const result = await run("apple")
    expect(result).toMatchObject({ status: "valid", ipa: "/ˈæp.əl/" })
    expect(logs).toEqual([{ kind: "generate", input: "apple", success: true }])
  })

  it("AC: `run` yields 1–3 senses including a verb", async () => {
    const result = await setup().run("run")
    if (result.status !== "valid") throw new Error(result.status)
    expect(result.senses.length).toBeGreaterThanOrEqual(1)
    expect(result.senses.length).toBeLessThanOrEqual(3)
    expect(posTags(result.senses)).toContain("v.")
  })

  it("handles phrases such as `give up`", async () => {
    const result = await setup().run("give up")
    if (result.status !== "valid") throw new Error(result.status)
    expect(result.senses.every((s) => s.pos === "phrase")).toBe(true)
  })

  it("AC: `aple` is invalid with `apple` among the suggestions (R2.6)", async () => {
    const { run, logs } = setup()
    const result = await run("aple")
    expect(result.status).toBe("invalid")
    if (result.status === "invalid")
      expect(result.suggestions).toContain("apple")
    expect(logs[0].success).toBe(true)
  })

  it("times out and logs a failure (R2.10)", async () => {
    const { run, logs } = setup()
    const started = Date.now()
    const result = await run(MOCK_TIMEOUT_INPUT, { timeoutMs: 50 })
    expect(result).toEqual({ status: "error", reason: "timeout" })
    expect(Date.now() - started).toBeLessThan(1000)
    expect(logs).toEqual([
      { kind: "generate", input: MOCK_TIMEOUT_INPUT, success: false },
    ])
  })

  it("rejects malformed output (R2.10)", async () => {
    const { run, logs } = setup()
    expect(await run(MOCK_MALFORMED_INPUT)).toEqual({
      status: "error",
      reason: "format",
    })
    expect(logs[0].success).toBe(false)
  })

  it.each([
    ["Conventional", "conventional"], // 沒有 fixture → 通用條目，小寫
    ["APPLE", "apple"],
    ["Give Up", "give up"],
    ["monday", "Monday"], // 英文本身需要大寫
    ["ran", "ran"], // AI 改成原形 run → 不採用
  ])("stores %j as the dictionary headword %j (R2.7)", async (input, text) => {
    const result = await setup().run(input)
    expect(result).toMatchObject({ status: "valid", text })
  })

  it("logs the regenerate kind (R4.5)", async () => {
    const { run, logs } = setup()
    await run("apple", { kind: "regenerate" })
    expect(logs[0].kind).toBe("regenerate")
  })
})

describe("generateWord error handling", () => {
  it.each([
    ["valid but no senses", validEntry({ senses: [] })],
    [
      "more than 3 senses",
      validEntry({ senses: Array(4).fill(validEntry().senses[0]) }),
    ],
    [
      "unknown part of speech",
      validEntry({ senses: [{ ...validEntry().senses[0], pos: "article" }] }),
    ],
    [
      "empty Chinese definition",
      validEntry({ senses: [{ ...validEntry().senses[0], def_zh: " " }] }),
    ],
    [
      "no examples",
      validEntry({ senses: [{ ...validEntry().senses[0], examples: [] }] }),
    ],
    [
      "6 synonyms",
      validEntry({
        senses: [
          {
            ...validEntry().senses[0],
            synonyms: ["a", "b", "c", "d", "e", "f"],
          },
        ],
      }),
    ],
    ["missing field", { is_valid: true, senses: [] }],
    ["not an object", "apple"],
  ])("treats %s as a format error", async (_, raw) => {
    expect(await setup(returning(raw)).run("test")).toEqual({
      status: "error",
      reason: "format",
    })
  })

  it("treats unparsable JSON as a format error", async () => {
    const client: AiClient = {
      completeJson: async () => JSON.parse("{ truncated"),
    }
    expect(await setup(client).run("test")).toEqual({
      status: "error",
      reason: "format",
    })
  })

  it("reports API failures without retrying", async () => {
    const completeJson = vi.fn(async () => {
      throw new Error("503 Service Unavailable")
    })
    vi.spyOn(console, "error").mockImplementation(() => {})
    const result = await setup({ completeJson }).run("test")
    expect(result).toEqual({ status: "error", reason: "api" })
    expect(completeJson).toHaveBeenCalledTimes(1)
  })

  it("still returns the result when logging fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const result = await generateWord("apple", {
      client: mockClient,
      log: async () => {
        throw new Error("db down")
      },
    })
    expect(result.status).toBe("valid")
  })
})

describe("generateWord output cleanup", () => {
  it.each([
    [["Aple", "Apple", "ap ple!"], ["Apple"]],
    [
      ["apple", "APPLE", "maple"],
      ["apple", "maple"],
    ],
  ])(
    "keeps only resubmittable, unique suggestions other than the input: %j",
    async (suggestions, expected) => {
      const raw = {
        is_valid: false,
        suggestions,
        headword: null,
        ipa: null,
        senses: [],
      }
      expect(await setup(returning(raw)).run("aple")).toEqual({
        status: "invalid",
        suggestions: expected,
      })
    },
  )

  it("dedupes synonyms/antonyms case-insensitively and drops the word itself", async () => {
    const raw = validEntry({
      senses: [
        {
          ...validEntry().senses[0],
          synonyms: ["Quick", "fast", "FAST", "rapid"],
          antonyms: ["slow", "Slow"],
        },
      ],
    })
    const result = await setup(returning(raw)).run("quick")
    if (result.status !== "valid") throw new Error(result.status)
    expect(result.senses[0].synonyms).toEqual(["fast", "rapid"])
    expect(result.senses[0].antonyms).toEqual(["slow"])
  })

  it("turns a blank IPA into null", async () => {
    const result = await setup(returning(validEntry({ ipa: "  " }))).run("test")
    expect(result).toMatchObject({ status: "valid", ipa: null })
  })
})

describe("getAiClient (NFR6)", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("uses fixtures when AI_MOCK=1", async () => {
    vi.stubEnv("AI_MOCK", "1")
    expect(await getAiClient()).toBe(mockClient)
  })

  it("requires OpenAI settings otherwise", async () => {
    vi.stubEnv("AI_MOCK", "0")
    vi.stubEnv("OPENAI_API_KEY", "")
    await expect(getAiClient()).rejects.toThrow("OPENAI_API_KEY")
  })
})
