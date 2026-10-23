import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { listReviewWords } from "@/lib/db/reviews"
import type { Db } from "@/lib/db/words"
import { startSessionWith } from "@/lib/review/startSession"

import {
  adminClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers"

const WORD_COUNT = 2000
const BUDGET_MS = 1000 // T2.6

/** 2,000 words, each with its own Chinese definition and synonym, so questions need no AI. */
async function seed(userId: string) {
  const admin = adminClient()
  const letters = (n: number) =>
    String(n).replace(/\d/g, (d) => "abcdefghij"[+d])
  const words = Array.from({ length: WORD_COUNT }, (_, i) => ({
    user_id: userId,
    text: `word ${letters(i)}`,
    box: i % 6,
    next_due_on: i % 3 ? "2026-10-20" : "2026-10-25",
  }))
  const { data, error } = await admin.from("words").insert(words).select("id")
  if (error) throw error
  const senses = data.map(({ id }, i) => ({
    word_id: id,
    position: 1,
    pos: (["noun", "verb", "adjective"] as const)[i % 3],
    def_en: "definition",
    def_zh: `解釋${i}`,
    synonyms: [`synonym ${letters(i)}`],
    examples: ["example"],
  }))
  for (let i = 0; i < senses.length; i += 1000) {
    const r = await admin.from("senses").insert(senses.slice(i, i + 1000))
    if (r.error) throw r.error
  }
}

describe(`startReviewSession with ${WORD_COUNT} words`, () => {
  let u: TestUser

  beforeAll(async () => {
    u = await createTestUser()
    await seed(u.id)
  }, 60_000)
  afterAll(() => deleteTestUser(u))

  it("reads all words beyond the PostgREST row limit", async () => {
    const words = await listReviewWords(u.client as unknown as Db)
    expect(words).toHaveLength(WORD_COUNT)
    expect(new Set(words.map((w) => w.id)).size).toBe(WORD_COUNT)
  })

  it(`builds 8 questions within ${BUDGET_MS}ms without AI`, async () => {
    const generate = vi.fn()
    const run = () =>
      startSessionWith({
        db: u.client as unknown as Db,
        generate,
        now: new Date("2026-10-20T12:00:00Z"),
      })
    await run() // warm-up

    const started = performance.now()
    const result = await run()
    const elapsed = performance.now() - started

    expect(result.ok && result.questions).toHaveLength(8)
    expect(generate).not.toHaveBeenCalled()
    expect(elapsed).toBeLessThan(BUDGET_MS)
  })
})
