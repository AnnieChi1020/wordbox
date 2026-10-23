import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import type { GenerateDistractorsResult } from "@/lib/ai/generateDistractors"
import type { Db } from "@/lib/db/words"
import {
  buildQuestion,
  type QuestionDraft,
  type QuestionWord,
} from "@/lib/domain/questions"
import { seededRng } from "@/lib/domain/random"
import { completeWithDistractors } from "@/lib/review/distractors"

import {
  createTestUser,
  createWord,
  deleteTestUser,
  sense,
  type TestUser,
} from "./helpers"

const AI_OPTIONS = ["香蕉", "葡萄", "芒果"]

describe("completeWithDistractors (R6.5)", () => {
  let u: TestUser
  let db: Db

  beforeAll(async () => {
    u = await createTestUser()
    db = u.client as unknown as Db
  })
  afterAll(() => deleteTestUser(u))

  /** Creates a word and builds a question with no other words, so all three distractors must be filled in */
  async function draftFor(text: string, defZh: string): Promise<QuestionDraft> {
    const { id } = await createWord(u, text, [sense({ def_zh: defZh })])
    const { data, error } = await u.client
      .from("senses")
      .select("id, pos, def_zh, synonyms, antonyms")
      .eq("word_id", id)
      .single()
    if (error) throw error
    const word: QuestionWord = { id, text, senses: [data] }
    const result = buildQuestion(word, data, "word_to_zh", [], seededRng(1))
    if (!("needsAi" in result)) throw new Error("expected a draft")
    return result.needsAi
  }

  const generating = (result: GenerateDistractorsResult) =>
    vi.fn(async () => result)

  async function cached(senseId: string) {
    const { data } = await u.client
      .from("ai_distractors")
      .select("options")
      .eq("sense_id", senseId)
      .maybeSingle()
    return data?.options ?? null
  }

  it("calls AI on a cache miss and caches the options", async () => {
    const draft = await draftFor("apple", "蘋果")
    const generate = generating({ status: "ok", options: AI_OPTIONS })

    const q = await completeWithDistractors(
      { db, generate },
      draft,
      seededRng(1),
    )
    expect(q?.options.sort()).toEqual([...AI_OPTIONS, "蘋果"].sort())
    expect(generate).toHaveBeenCalledOnce()
    expect(await cached(draft.senseId)).toEqual(AI_OPTIONS)
  })

  it("uses the cache without calling AI", async () => {
    const draft = await draftFor("pear", "梨子")
    await u.client.from("ai_distractors").insert({
      sense_id: draft.senseId,
      question_type: "word_to_zh",
      options: AI_OPTIONS,
    })
    const generate = generating({ status: "ok", options: ["x", "y", "z"] })

    const q = await completeWithDistractors(
      { db, generate },
      draft,
      seededRng(1),
    )
    expect(q?.options.sort()).toEqual([...AI_OPTIONS, "梨子"].sort())
    expect(generate).not.toHaveBeenCalled()
  })

  it("regenerates and overwrites a cache that no longer passes R6.4", async () => {
    const draft = await draftFor("lemon", "檸檬")
    // One cached option equals the correct answer (e.g. stale data from a sense that changed without invalidating the cache)
    await u.client.from("ai_distractors").insert({
      sense_id: draft.senseId,
      question_type: "word_to_zh",
      options: ["檸檬", "葡萄", "芒果"],
    })
    const generate = generating({ status: "ok", options: AI_OPTIONS })

    const q = await completeWithDistractors(
      { db, generate },
      draft,
      seededRng(1),
    )
    expect(q).not.toBeNull()
    expect(generate).toHaveBeenCalledOnce()
    expect(await cached(draft.senseId)).toEqual(AI_OPTIONS)
  })

  it("returns null and caches nothing when AI fails (R6.6)", async () => {
    const draft = await draftFor("melon", "甜瓜")
    const generate = generating({ status: "error", reason: "timeout" })

    expect(
      await completeWithDistractors({ db, generate }, draft, seededRng(1)),
    ).toBeNull()
    expect(await cached(draft.senseId)).toBeNull()
  })

  it("returns null and caches nothing when AI options fail R6.4", async () => {
    const draft = await draftFor("peach", "桃子")
    const generate = generating({
      status: "ok",
      options: ["桃子", "葡萄", "peach"],
    })

    expect(
      await completeWithDistractors({ db, generate }, draft, seededRng(1)),
    ).toBeNull()
    expect(await cached(draft.senseId)).toBeNull()
  })
})
