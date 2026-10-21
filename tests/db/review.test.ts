import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  createTestUser,
  createWord,
  deleteTestUser,
  sense,
  type TestUser,
} from "./helpers"

const TODAY = "2026-10-20"
const TOMORROW = "2026-10-21"

type ReviewArgs = {
  questionId?: string
  wordId: string
  senseId: string
  isCorrect?: boolean
  boxBefore?: number
  dueBefore?: string
  boxAfter?: number
  dueAfter?: string
}

/** 以新字（box 0、今天到期）答對為預設：box 0 → 1、明天到期。 */
function applyReview(user: TestUser, args: ReviewArgs) {
  return user.client.rpc("apply_review", {
    p_question_id: args.questionId ?? randomUUID(),
    p_word_id: args.wordId,
    p_sense_id: args.senseId,
    p_question_type: "word_to_zh",
    p_is_correct: args.isCorrect ?? true,
    p_was_due: true,
    p_box_before: args.boxBefore ?? 0,
    p_due_before: args.dueBefore ?? TODAY,
    p_box_after: args.boxAfter ?? 1,
    p_due_after: args.dueAfter ?? TOMORROW,
    p_local_date: TODAY,
  })
}

async function senseIds(user: TestUser, wordId: string): Promise<string[]> {
  const { data, error } = await user.client
    .from("senses")
    .select("id")
    .eq("word_id", wordId)
    .order("position")
  if (error) throw error
  return data.map((s) => s.id)
}

async function getSenses(user: TestUser, wordId: string) {
  const { data, error } = await user.client
    .from("senses")
    .select("id, pos, def_en, def_zh, synonyms, antonyms, examples")
    .eq("word_id", wordId)
    .order("position")
  if (error) throw error
  return data
}

async function cacheDistractors(user: TestUser, senseId: string) {
  const { error } = await user.client.from("ai_distractors").insert({
    sense_id: senseId,
    question_type: "word_to_zh",
    options: ["香蕉", "橘子", "葡萄"],
  })
  if (error) throw error
}

async function cachedSenseIds(user: TestUser): Promise<string[]> {
  const { data, error } = await user.client
    .from("ai_distractors")
    .select("sense_id")
  if (error) throw error
  return data.map((d) => d.sense_id).sort()
}

async function wordState(user: TestUser, wordId: string) {
  const { data, error } = await user.client
    .from("words")
    .select("box, next_due_on")
    .eq("id", wordId)
    .single()
  if (error) throw error
  return data
}

describe("apply_review", () => {
  let u: TestUser
  beforeAll(async () => {
    u = await createTestUser()
  })
  afterAll(() => deleteTestUser(u))

  it("writes a review log and updates the word's review state", async () => {
    const { id } = await createWord(u, "apple")
    const [senseId] = await senseIds(u, id)

    const { data, error } = await applyReview(u, { wordId: id, senseId })
    expect(error).toBeNull()
    expect(data).toEqual({
      is_correct: true,
      box_before: 0,
      box_after: 1,
      duplicate: false,
    })
    expect(await wordState(u, id)).toEqual({ box: 1, next_due_on: TOMORROW })

    const { data: logs } = await u.client
      .from("review_logs")
      .select("user_id, word_id, sense_id, was_due, local_date")
      .eq("word_id", id)
    expect(logs).toEqual([
      {
        user_id: u.id,
        word_id: id,
        sense_id: senseId,
        was_due: true,
        local_date: TODAY,
      },
    ])
  })

  it("counts a resubmitted question only once (R7.3)", async () => {
    const { id } = await createWord(u, "banana")
    const [senseId] = await senseIds(u, id)
    const questionId = randomUUID()

    const first = await applyReview(u, { questionId, wordId: id, senseId })
    // 重送時即使內容不同，也回傳第一次的結果，不再更新
    const second = await applyReview(u, {
      questionId,
      wordId: id,
      senseId,
      isCorrect: false,
      boxBefore: 1,
      dueBefore: TOMORROW,
      boxAfter: 1,
      dueAfter: "2026-10-22",
    })
    expect(first.data).toMatchObject({ duplicate: false, box_after: 1 })
    expect(second.error).toBeNull()
    expect(second.data).toEqual({
      is_correct: true,
      box_before: 0,
      box_after: 1,
      duplicate: true,
    })
    expect(await wordState(u, id)).toEqual({ box: 1, next_due_on: TOMORROW })

    const { count } = await u.client
      .from("review_logs")
      .select("id", { count: "exact", head: true })
      .eq("question_id", questionId)
    expect(count).toBe(1)
  })

  it("rejects a stale review state without writing (D13)", async () => {
    const { id } = await createWord(u, "cherry")
    const [senseId] = await senseIds(u, id)

    const staleBox = await applyReview(u, { wordId: id, senseId, boxBefore: 2 })
    expect(staleBox.error?.code).toBe("40001")
    const staleDue = await applyReview(u, {
      wordId: id,
      senseId,
      dueBefore: "2026-10-19",
    })
    expect(staleDue.error?.code).toBe("40001")

    expect(await wordState(u, id)).toEqual({ box: 0, next_due_on: TODAY })
    const { count } = await u.client
      .from("review_logs")
      .select("id", { count: "exact", head: true })
      .eq("word_id", id)
    expect(count).toBe(0)
  })

  it("rejects a sense from another word", async () => {
    const w1 = await createWord(u, "dog")
    const w2 = await createWord(u, "cat")
    const [foreign] = await senseIds(u, w2.id)

    const { error } = await applyReview(u, { wordId: w1.id, senseId: foreign })
    expect(error?.code).toBe("P0002")
    expect(await wordState(u, w1.id)).toEqual({ box: 0, next_due_on: TODAY })
  })

  it("keeps review logs when the word is deleted (R4.7)", async () => {
    const { id } = await createWord(u, "eagle")
    const [senseId] = await senseIds(u, id)
    const questionId = randomUUID()
    await applyReview(u, { questionId, wordId: id, senseId })

    await u.client.from("words").delete().eq("id", id)

    const { data } = await u.client
      .from("review_logs")
      .select("word_id, sense_id, is_correct")
      .eq("question_id", questionId)
    expect(data).toEqual([{ word_id: null, sense_id: null, is_correct: true }])

    // 字已刪除後重送仍回傳第一次的結果
    const resend = await applyReview(u, { questionId, wordId: id, senseId })
    expect(resend.data).toMatchObject({ duplicate: true })
  })
})

describe("ai_distractors invalidation (R6.5, D9)", () => {
  let u: TestUser
  beforeAll(async () => {
    u = await createTestUser()
  })
  afterAll(() => deleteTestUser(u))

  it("keeps the cache when senses are only reordered", async () => {
    const { id } = await createWord(u, "light", [
      sense({ pos: "noun", def_zh: "光" }),
      sense({ pos: "adjective", def_zh: "輕的" }),
    ])
    const [first, second] = await getSenses(u, id)
    await cacheDistractors(u, first.id)
    await cacheDistractors(u, second.id)

    const { error } = await u.client.rpc("update_word_content", {
      p_word_id: id,
      p_ipa: "/laɪt/",
      p_senses: [second, first],
    })
    expect(error).toBeNull()
    expect(await cachedSenseIds(u)).toEqual([first.id, second.id].sort())

    await u.client
      .from("ai_distractors")
      .delete()
      .in("sense_id", [first.id, second.id])
  })

  it("drops only the cache of the edited sense", async () => {
    const { id } = await createWord(u, "run", [
      sense({ pos: "verb", def_zh: "跑" }),
      sense({ pos: "noun", def_zh: "跑步" }),
    ])
    const [verb, noun] = await getSenses(u, id)
    await cacheDistractors(u, verb.id)
    await cacheDistractors(u, noun.id)

    const { error } = await u.client.rpc("update_word_content", {
      p_word_id: id,
      p_ipa: null,
      p_senses: [{ ...verb, def_zh: "奔跑" }, noun],
    })
    expect(error).toBeNull()
    expect(await cachedSenseIds(u)).toEqual([noun.id])

    // 同義詞變動也算內容變動
    const { error: e2 } = await u.client.rpc("update_word_content", {
      p_word_id: id,
      p_ipa: null,
      p_senses: [
        { ...verb, def_zh: "奔跑" },
        { ...noun, synonyms: ["jog"] },
      ],
    })
    expect(e2).toBeNull()
    expect(await cachedSenseIds(u)).toEqual([])
  })

  it("drops all caches when the word is regenerated", async () => {
    const { id } = await createWord(u, "bank", [
      sense({ pos: "noun", def_zh: "銀行" }),
      sense({ pos: "noun", def_zh: "河岸" }),
    ])
    for (const s of await getSenses(u, id)) await cacheDistractors(u, s.id)

    const { error } = await u.client.rpc("replace_word_content", {
      p_word_id: id,
      p_ipa: null,
      p_senses: [sense({ def_zh: "銀行" })],
    })
    expect(error).toBeNull()
    expect(await cachedSenseIds(u)).toEqual([])
  })
})

describe("review row level security (R1.4)", () => {
  let a: TestUser
  let b: TestUser
  let wordId: string
  let senseId: string

  beforeAll(async () => {
    a = await createTestUser()
    b = await createTestUser()
    wordId = (await createWord(a, "apple")).id
    ;[senseId] = await senseIds(a, wordId)
    await applyReview(a, { wordId, senseId })
    await cacheDistractors(a, senseId)
  })

  afterAll(async () => {
    await deleteTestUser(a)
    await deleteTestUser(b)
  })

  it("hides other users' review logs and distractors", async () => {
    expect((await a.client.from("review_logs").select("id")).data).toHaveLength(
      1,
    )
    expect(
      (await a.client.from("ai_distractors").select("sense_id")).data,
    ).toHaveLength(1)

    const logs = await b.client.from("review_logs").select("id")
    expect(logs.error).toBeNull()
    expect(logs.data).toEqual([])
    const cache = await b.client.from("ai_distractors").select("sense_id")
    expect(cache.error).toBeNull()
    expect(cache.data).toEqual([])
  })

  it("prevents writing to other users' words and caches", async () => {
    const review = await applyReview(b, {
      wordId,
      senseId,
      boxBefore: 1,
      dueBefore: TOMORROW,
      boxAfter: 5,
    })
    expect(review.error?.code).toBe("P0002")

    const log = await b.client.from("review_logs").insert({
      user_id: a.id,
      question_id: randomUUID(),
      question_type: "word_to_zh",
      is_correct: true,
      was_due: true,
      box_before: 0,
      box_after: 5,
      local_date: TODAY,
    })
    expect(log.error?.code).toBe("42501")

    const cache = await b.client
      .from("ai_distractors")
      .update({ options: ["x", "y", "z"] })
      .eq("sense_id", senseId)
      .select()
    expect(cache.data).toEqual([])

    const insert = await b.client.from("ai_distractors").insert({
      sense_id: senseId,
      question_type: "zh_to_word",
      options: ["x", "y", "z"],
    })
    expect(insert.error?.code).toBe("42501")

    expect(await wordState(a, wordId)).toEqual({
      box: 1,
      next_due_on: TOMORROW,
    })
  })
})
