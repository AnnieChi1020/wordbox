import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import type { Db } from "@/lib/db/words"
import type { QuestionType } from "@/lib/domain/questions"
import {
  SUBMIT_ANSWER_MESSAGES,
  submitAnswerWith,
  type AnswerInput,
} from "@/lib/review/submitAnswer"

import {
  adminClient,
  createTestUser,
  createWord,
  deleteTestUser,
  sense,
  type TestUser,
} from "./helpers"

// profile.timezone is null → 2026-10-20 in UTC
const NOW = new Date("2026-10-20T12:00:00Z")
const TODAY = "2026-10-20"

describe("submitAnswer (R7.3, R7.4)", () => {
  let u: TestUser
  let db: Db

  beforeAll(async () => {
    u = await createTestUser()
    db = u.client as unknown as Db
  })
  afterAll(() => deleteTestUser(u))

  let wordCount = 0

  /** Creates a word (Chinese definition 「答案」, synonyms quick / rapid, antonyms slow / sluggish) and sets its review state */
  async function setupWord(
    state: { box?: number; nextDueOn?: string; important?: boolean } = {},
  ) {
    const text = `word${"abcdefghijklmnopqrstuvwxyz"[wordCount++]}`
    const { id } = await createWord(u, text, [
      sense({
        def_zh: "答案",
        synonyms: ["quick", "rapid"],
        antonyms: ["slow", "sluggish"],
      }),
    ])
    const { error } = await adminClient()
      .from("words")
      .update({
        box: state.box ?? 0,
        next_due_on: state.nextDueOn ?? TODAY,
        is_important: state.important ?? false,
      })
      .eq("id", id)
    if (error) throw error
    const { data } = await u.client
      .from("senses")
      .select("id")
      .eq("word_id", id)
      .single()
    return { wordId: id, senseId: data!.id as string, text }
  }

  function answer(
    word: { wordId: string; senseId: string },
    overrides: Partial<AnswerInput> & { correct?: boolean } = {},
  ): AnswerInput {
    const { correct = true, ...rest } = overrides
    const options = ["答案", "錯一", "錯二", "錯三"]
    return {
      questionId: randomUUID(),
      wordId: word.wordId,
      senseId: word.senseId,
      questionType: "word_to_zh",
      options,
      selected: correct ? "答案" : "錯一",
      ...rest,
    }
  }

  const submit = (input: unknown, now = NOW) =>
    submitAnswerWith({ db, now }, input)

  async function state(wordId: string) {
    const { data } = await u.client
      .from("words")
      .select("box, next_due_on")
      .eq("id", wordId)
      .single()
    return data
  }

  async function logsFor(wordId: string) {
    const { data } = await u.client
      .from("review_logs")
      .select(
        "question_id, is_correct, was_due, box_before, box_after, local_date",
      )
      .eq("word_id", wordId)
    return data ?? []
  }

  describe("R7.4 AC", () => {
    it("box 2, due, normal, correct → box 3, due in 4 days", async () => {
      const w = await setupWord({ box: 2 })
      expect(await submit(answer(w))).toEqual({
        ok: true,
        isCorrect: true,
        correctOption: "答案",
        boxBefore: 2,
        boxAfter: 3,
      })
      expect(await state(w.wordId)).toEqual({
        box: 3,
        next_due_on: "2026-10-24",
      })
    })

    it("box 2, due, important, correct → box 3, due in 2 days", async () => {
      const w = await setupWord({ box: 2, important: true })
      await submit(answer(w))
      expect(await state(w.wordId)).toEqual({
        box: 3,
        next_due_on: "2026-10-22",
      })
    })

    it("box 5, due, correct → box 5, due in 16 days", async () => {
      const w = await setupWord({ box: 5 })
      await submit(answer(w))
      expect(await state(w.wordId)).toEqual({
        box: 5,
        next_due_on: "2026-11-05",
      })
    })

    it("box 4, wrong → box 0, due tomorrow", async () => {
      const w = await setupWord({ box: 4 })
      expect(await submit(answer(w, { correct: false }))).toMatchObject({
        ok: true,
        isCorrect: false,
        correctOption: "答案",
        boxBefore: 4,
        boxAfter: 0,
      })
      expect(await state(w.wordId)).toEqual({
        box: 0,
        next_due_on: "2026-10-21",
      })
    })

    it("not-due filler word answered correctly → unchanged", async () => {
      const w = await setupWord({ box: 3, nextDueOn: "2026-10-23" })
      await submit(answer(w))
      expect(await state(w.wordId)).toEqual({
        box: 3,
        next_due_on: "2026-10-23",
      })
      expect(await logsFor(w.wordId)).toMatchObject([
        { was_due: false, box_before: 3, box_after: 3 },
      ])
    })
  })

  it.each<[QuestionType, string[], string, string]>([
    ["word_to_synonym", ["slow", "Rapid", "big", "small"], "Rapid", "Rapid"],
    [
      "word_to_antonym",
      ["quick", "Sluggish", "big", "small"],
      "big",
      "Sluggish",
    ],
    ["zh_to_word", ["slow", "big", "small", "WORDZ"], "slow", "WORDZ"],
  ])(
    "checks %s answers on the server",
    async (questionType, options, selected, correctOption) => {
      const w = await setupWord()
      const opts =
        questionType === "zh_to_word"
          ? options.map((o) => (o === "WORDZ" ? w.text.toUpperCase() : o))
          : options
      const result = await submit(
        answer(w, { questionType, options: opts, selected }),
      )
      const expected =
        correctOption === "WORDZ" ? w.text.toUpperCase() : correctOption
      expect(result).toMatchObject({
        ok: true,
        isCorrect: selected === expected,
        correctOption: expected,
      })
    },
  )

  it("counts a resubmitted question only once (R7.3)", async () => {
    const w = await setupWord({ box: 2 })
    const input = answer(w)

    const first = await submit(input)
    const again = await submit(input)
    // Even if the resubmission picks a different option, the first result is returned
    const changed = await submit({ ...input, selected: "錯一" })

    expect(again).toEqual(first)
    expect(changed).toEqual(first)
    expect(await logsFor(w.wordId)).toHaveLength(1)
    expect(await state(w.wordId)).toEqual({ box: 3, next_due_on: "2026-10-24" })
  })

  it("re-reads and retries once when another tab answered first (D13)", async () => {
    const w = await setupWord({ box: 2 })
    let interfered = false
    // Before the first write, simulate another tab answering this word wrong (box 2 → 1)
    const racingDb = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop !== "rpc") return Reflect.get(target, prop, receiver)
        return async (...args: Parameters<Db["rpc"]>) => {
          if (!interfered) {
            interfered = true
            await adminClient()
              .from("words")
              .update({ box: 1, next_due_on: "2026-10-21" })
              .eq("id", w.wordId)
          }
          return target.rpc(...args)
        }
      },
    })

    const result = await submitAnswerWith({ db: racingDb, now: NOW }, answer(w))
    // After rereading, the answer is checked against box 1 and not due: a filler word answered correctly does not change
    expect(result).toMatchObject({ ok: true, boxBefore: 1, boxAfter: 1 })
    expect(await state(w.wordId)).toEqual({ box: 1, next_due_on: "2026-10-21" })
    expect(await logsFor(w.wordId)).toHaveLength(1)
  })

  it("uses the profile time zone for local_date and due checks (R8.6)", async () => {
    // Kiritimati (UTC+14): 2026-10-20 12:00 UTC is 2026-10-21 locally
    await u.client
      .from("profiles")
      .update({ timezone: "Pacific/Kiritimati" })
      .eq("id", u.id)
    try {
      const w = await setupWord({ box: 1, nextDueOn: "2026-10-21" })
      await submit(answer(w))
      expect(await logsFor(w.wordId)).toMatchObject([
        { was_due: true, local_date: "2026-10-21" },
      ])
      expect(await state(w.wordId)).toEqual({
        box: 2,
        next_due_on: "2026-10-23",
      })
    } finally {
      await u.client.from("profiles").update({ timezone: null }).eq("id", u.id)
    }
  })

  describe("rejects without writing", () => {
    it.each<[string, (w: { wordId: string; senseId: string }) => unknown]>([
      [
        "missing correct option",
        (w) =>
          answer(w, {
            options: ["錯零", "錯一", "錯二", "錯三"],
            selected: "錯一",
          }),
      ],
      ["selected not among options", (w) => answer(w, { selected: "答 案" })],
      ["3 options", (w) => answer(w, { options: ["答案", "錯一", "錯二"] })],
      [
        "duplicate options",
        (w) => answer(w, { options: ["答案", "錯一", "錯一", "錯三"] }),
      ],
      [
        "unknown question type",
        (w) => ({ ...answer(w), questionType: "cloze" }),
      ],
      ["bad question id", (w) => ({ ...answer(w), questionId: "not-a-uuid" })],
    ])("%s", async (_, build) => {
      const w = await setupWord({ box: 2 })
      const result = await submit(build(w))
      expect(result.ok).toBe(false)
      expect(await logsFor(w.wordId)).toEqual([])
      expect(await state(w.wordId)).toEqual({ box: 2, next_due_on: TODAY })
    })

    it("a sense regenerated during the session", async () => {
      const w = await setupWord({ box: 2 })
      await u.client.rpc("replace_word_content", {
        p_word_id: w.wordId,
        p_ipa: null,
        p_senses: [sense({ def_zh: "答案" })],
      })
      expect(await submit(answer(w))).toEqual({
        ok: false,
        message: SUBMIT_ANSWER_MESSAGES.stale,
      })
      expect(await state(w.wordId)).toEqual({ box: 2, next_due_on: TODAY })
    })

    it("another user's word", async () => {
      const w = await setupWord({ box: 2 })
      const other = await createTestUser()
      try {
        const result = await submitAnswerWith(
          { db: other.client as unknown as Db, now: NOW },
          answer(w),
        )
        expect(result).toEqual({
          ok: false,
          message: SUBMIT_ANSWER_MESSAGES.stale,
        })
        expect(await state(w.wordId)).toEqual({ box: 2, next_due_on: TODAY })
      } finally {
        await deleteTestUser(other)
      }
    })
  })
})
