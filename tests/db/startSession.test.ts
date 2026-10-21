import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { generateDistractors } from "@/lib/ai/generateDistractors"
import { mockClient } from "@/lib/ai/mock"
import type { Db } from "@/lib/db/words"
import type { QuestionDraft } from "@/lib/domain/questions"
import { seededRng } from "@/lib/domain/random"
import type { GenerateDistractors } from "@/lib/review/distractors"
import {
  countDueWith,
  startSessionWith,
  type ClientQuestion,
} from "@/lib/review/startSession"

import {
  adminClient,
  createTestUser,
  createWord,
  deleteTestUser,
  sense,
  type TestUser,
} from "./helpers"

// profile.timezone 為 null → UTC 的 2026-10-20
const NOW = new Date("2026-10-20T12:00:00Z")

describe("startReviewSession (R5, R6)", () => {
  let u: TestUser
  let db: Db

  beforeEach(async () => {
    u = await createTestUser()
    db = u.client as unknown as Db
  })
  afterEach(() => deleteTestUser(u))

  /** 以 mock AI 生成干擾選項，並以測試使用者身分寫入 log */
  const mockGenerate: GenerateDistractors = (draft) =>
    generateDistractors(draft, {
      client: mockClient,
      log: async (entry) => {
        await db.from("ai_generation_logs").insert(entry)
      },
    })

  function start(generate: GenerateDistractors = mockGenerate, seed = 1) {
    let n = 0
    return startSessionWith({
      db,
      generate,
      rng: seededRng(seed),
      now: NOW,
      newId: () => `q-${n++}`,
    })
  }

  async function questions(
    generate?: GenerateDistractors,
  ): Promise<ClientQuestion[]> {
    const result = await start(generate)
    if (!result.ok) throw new Error(result.message)
    return result.questions
  }

  async function setDue(wordId: string, nextDueOn: string, box = 0) {
    const { error } = await adminClient()
      .from("words")
      .update({ next_due_on: nextDueOn, box })
      .eq("id", wordId)
    if (error) throw error
  }

  it("returns no questions when the user has no words (R5.2)", async () => {
    expect(await start()).toEqual({ ok: true, questions: [] })
  })

  it("completes a session with only 2 words using AI distractors (R7 AC)", async () => {
    await createWord(u, "apple", [sense({ def_zh: "蘋果" })])
    await createWord(u, "pear", [sense({ def_zh: "梨子" })])

    const qs = await questions()
    expect(qs).toHaveLength(2)
    for (const q of qs) {
      expect(q.options).toHaveLength(4)
      expect(new Set(q.options).size).toBe(4)
      expect(q).not.toHaveProperty("answer") // D15
    }
    expect(qs.map((q) => q.questionId)).toEqual(["q-0", "q-1"])

    const { data: logs } = await db
      .from("ai_generation_logs")
      .select("kind, success")
    expect(logs?.length).toBeGreaterThan(0)
    expect(logs?.every((l) => l.kind === "distractors" && l.success)).toBe(true)
  })

  it("picks at most 8 words, due words first (R5.1)", async () => {
    const ids: string[] = []
    for (let i = 0; i < 10; i++) {
      const text = `word${"abcdefghij"[i]}`
      ids.push((await createWord(u, text, [sense({ def_zh: `解釋${i}` })])).id)
    }
    // 前 2 個未到期且 box 較高，應被排除
    await setDue(ids[0], "2026-10-25", 4)
    await setDue(ids[1], "2026-10-30", 5)
    await setDue(ids[2], "2026-10-01") // 最舊，應排第一

    const qs = await questions()
    expect(qs).toHaveLength(8)
    expect(qs[0].wordId).toBe(ids[2])
    expect(new Set(qs.map((q) => q.wordId))).toEqual(new Set(ids.slice(2)))
  })

  it("skips a word whose distractors fail and fills from the next candidate (R6.6)", async () => {
    // 所有字的中文解釋相同 → 字庫沒有可用的候選，每一題都需要 AI
    const ids: Record<string, string> = {}
    for (const text of [
      "doomed",
      ...Array.from({ length: 8 }, (_, i) => `ok${"abcdefgh"[i]}`),
    ]) {
      ids[text] = (await createWord(u, text, [sense({ def_zh: "相同" })])).id
    }
    await setDue(ids.doomed, "2026-10-01")

    const generate = vi.fn((draft: QuestionDraft) =>
      draft.prompt === "doomed" || draft.answer === "doomed"
        ? Promise.resolve({ status: "error" as const, reason: "api" as const })
        : mockGenerate(draft),
    )
    const qs = await questions(generate)
    expect(qs).toHaveLength(8)
    expect(qs.map((q) => q.wordId)).not.toContain(ids.doomed)
    // doomed 的兩種題型都試過
    const doomedCalls = generate.mock.calls.filter(
      ([d]) => d.prompt === "doomed" || d.answer === "doomed",
    )
    expect(doomedCalls.map(([d]) => d.type).sort()).toEqual([
      "word_to_zh",
      "zh_to_word",
    ])
  })

  it("does not call AI when the library has enough candidates", async () => {
    for (let i = 0; i < 5; i++) {
      await createWord(u, `word${"abcde"[i]}`, [
        sense({ def_zh: `解釋${i}`, synonyms: [`syn${"abcde"[i]}`] }),
      ])
    }
    const generate = vi.fn(mockGenerate)
    const qs = await questions(generate)
    expect(qs).toHaveLength(5)
    expect(generate).not.toHaveBeenCalled()
  })
})

describe("countDueWith (R7.5)", () => {
  let u: TestUser
  beforeEach(async () => {
    u = await createTestUser()
  })
  afterEach(() => deleteTestUser(u))

  it("counts words due on or before the local today", async () => {
    const db = u.client as unknown as Db
    await createWord(u, "apple", undefined, "2026-10-20")
    await createWord(u, "pear", undefined, "2026-10-19")
    await createWord(u, "plum", undefined, "2026-10-21")
    expect(await countDueWith(db, NOW)).toBe(2)
  })
})
