import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { generateWord, type GenerateWordResult } from "@/lib/ai/generateWord"
import { mockClient, MOCK_TIMEOUT_INPUT } from "@/lib/ai/mock"
import type { Db } from "@/lib/db/words"
import {
  ADD_WORD_MESSAGES,
  addWordWith,
  type AddWordDeps,
} from "@/lib/words/addWord"

import {
  anonClient,
  createTestUser,
  createWord,
  deleteTestUser,
  type TestUser,
} from "./helpers"

// 2026-10-20 12:00 UTC = Kiritimati (UTC+14) 的 2026-10-21
const NOW = new Date("2026-10-20T12:00:00Z")

describe("addWord", () => {
  let u: TestUser
  let db: Db

  /** 以 fixtures 生成，並以測試使用者的身分寫入 ai_generation_logs */
  const generate = vi.fn((input: string) =>
    generateWord(input, {
      client: mockClient,
      timeoutMs: 100,
      log: async (entry) => {
        const { error } = await db.from("ai_generation_logs").insert(entry)
        if (error) throw error
      },
    }),
  )
  const deps = (): AddWordDeps => ({ db, generate, now: NOW })

  async function countRows(text: string) {
    const words = await db.from("words").select("id").ilike("text", text)
    const senses = await db
      .from("senses")
      .select("id, words!inner(text)")
      .ilike("words.text", text)
    return { words: words.data!.length, senses: senses.data!.length }
  }

  async function logsFor(input: string) {
    const { data } = await db
      .from("ai_generation_logs")
      .select("kind, input, success")
      .eq("input", input)
    return data
  }

  beforeAll(async () => {
    u = await createTestUser()
    db = u.client as Db
    await db
      .from("profiles")
      .update({ timezone: "Pacific/Kiritimati" })
      .eq("id", u.id)
  })
  afterAll(() => deleteTestUser(u))

  it("created: normalizes, generates and stores with initial review state (R2.2, R2.7, R2.8)", async () => {
    const result = await addWordWith(deps(), "  Give   up ")
    expect(result.status).toBe("created")
    if (result.status !== "created") return

    const { data: word } = await db
      .from("words")
      .select("text, ipa, box, is_important, next_due_on, senses(pos)")
      .eq("id", result.wordId)
      .single()
    expect(word).toMatchObject({
      text: "Give up",
      box: 0,
      is_important: false,
      next_due_on: "2026-10-21", // 使用者時區的今天，不是 UTC 的 10/20
    })
    expect(word!.senses.length).toBeGreaterThanOrEqual(1)
    expect(word!.senses.every((s) => s.pos === "phrase")).toBe(true)
    expect(await logsFor("Give up")).toEqual([
      { kind: "generate", input: "Give up", success: true },
    ])
  })

  it("exists: AC — `Apple` matches `apple` without calling AI (R2.4)", async () => {
    const first = await addWordWith(deps(), "apple")
    expect(first.status).toBe("created")
    generate.mockClear()

    const second = await addWordWith(deps(), "  APPLE ")
    expect(second).toEqual({
      status: "exists",
      wordId: (first as { wordId: string }).wordId,
    })
    expect(generate).not.toHaveBeenCalled()
  })

  it("invalid: AC — `aple` is not saved and suggests `apple` (R2.6)", async () => {
    const result = await addWordWith(deps(), "aple")
    expect(result.status).toBe("invalid")
    if (result.status === "invalid") {
      expect(result.suggestions).toContain("apple")
    }
    expect(await countRows("aple")).toEqual({ words: 0, senses: 0 })
  })

  it("error: AC — AI timeout writes no word or sense (R2.10)", async () => {
    const result = await addWordWith(deps(), MOCK_TIMEOUT_INPUT)
    expect(result).toEqual({
      status: "error",
      message: ADD_WORD_MESSAGES.aiTimeout,
    })
    expect(await countRows(MOCK_TIMEOUT_INPUT)).toEqual({ words: 0, senses: 0 })
    expect(await logsFor(MOCK_TIMEOUT_INPUT)).toEqual([
      { kind: "generate", input: MOCK_TIMEOUT_INPUT, success: false },
    ])
  })

  it.each([
    ["format", ADD_WORD_MESSAGES.aiFormat],
    ["api", ADD_WORD_MESSAGES.aiApi],
  ] as const)(
    "error: maps AI %s errors to a retryable message",
    async (reason, message) => {
      const result = await addWordWith(
        { db, now: NOW, generate: async () => ({ status: "error", reason }) },
        "orange",
      )
      expect(result).toEqual({ status: "error", message })
      expect(await countRows("orange")).toEqual({ words: 0, senses: 0 })
    },
  )

  it.each(["", "   ", "1apple", "apple!", "蘋果", "a".repeat(65)])(
    "error: rejects %j before calling AI (R2.3)",
    async (input) => {
      generate.mockClear()
      expect(await addWordWith(deps(), input)).toEqual({
        status: "error",
        message: ADD_WORD_MESSAGES.format,
      })
      expect(generate).not.toHaveBeenCalled()
    },
  )

  it("exists: a concurrent insert during generation returns the existing word", async () => {
    let concurrentId = ""
    const racingGenerate = async (
      input: string,
    ): Promise<GenerateWordResult> => {
      const result = await generate(input)
      // AI 生成期間，另一個分頁先新增了同一個字
      concurrentId = (await createWord(u, "Banana")).id
      return result
    }
    const result = await addWordWith(
      { db, now: NOW, generate: racingGenerate },
      "banana",
    )
    expect(result).toEqual({ status: "exists", wordId: concurrentId })
    expect(await countRows("banana")).toEqual({ words: 1, senses: 1 })
  })

  it("error: a valid session whose user was deleted fails before calling AI", async () => {
    const ghost = await createTestUser()
    await deleteTestUser(ghost) // 例如本地 db reset 或帳號被刪除，但瀏覽器的 JWT 尚未過期
    generate.mockClear()
    const result = await addWordWith(
      { db: ghost.client as Db, generate, now: NOW },
      "grape",
    )
    expect(result).toEqual({
      status: "error",
      message: ADD_WORD_MESSAGES.unauthenticated,
    })
    expect(generate).not.toHaveBeenCalled()
  })

  it("error: requires a signed-in user", async () => {
    generate.mockClear()
    const result = await addWordWith(
      { db: anonClient() as Db, generate, now: NOW },
      "grape",
    )
    expect(result).toEqual({
      status: "error",
      message: ADD_WORD_MESSAGES.unauthenticated,
    })
    expect(generate).not.toHaveBeenCalled()
  })
})
