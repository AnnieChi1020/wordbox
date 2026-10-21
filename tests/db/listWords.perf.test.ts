import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { listWords, WORDS_PAGE_SIZE, type Db } from "@/lib/db/words"
import { SORT_OPTIONS, type ListParams } from "@/lib/words/listParams"

import {
  adminClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers"

const WORD_COUNT = 2000
const BUDGET_MS = 300 // NFR4

/** 建立 2,000 個字（每字 1–3 個義項）。 */
async function seed2000(userId: string) {
  const admin = adminClient()
  const words = Array.from({ length: WORD_COUNT }, (_, i) => ({
    user_id: userId,
    text: `word${String.fromCharCode(97 + (i % 26))}${"x".repeat(i % 7)}-${i}`.replace(
      /\d/g,
      (d) => "abcdefghij"[+d],
    ),
    box: i % 6,
    is_important: i % 5 === 0,
    next_due_on: "2026-10-20",
    created_at: new Date(Date.UTC(2025, 0, 1) + i * 3_600_000).toISOString(),
  }))
  const { data, error } = await admin.from("words").insert(words).select("id")
  if (error) throw error
  const senses = data.flatMap(({ id }, i) =>
    Array.from({ length: (i % 3) + 1 }, (_, j) => ({
      word_id: id,
      position: j + 1,
      pos: (["noun", "verb", "adjective"] as const)[j],
      def_en: "definition",
      def_zh: "解釋",
      examples: ["example"],
    })),
  )
  for (let i = 0; i < senses.length; i += 1000) {
    const r = await admin.from("senses").insert(senses.slice(i, i + 1000))
    if (r.error) throw r.error
  }
}

describe(`listWords with ${WORD_COUNT} words (NFR4)`, () => {
  let u: TestUser

  beforeAll(async () => {
    u = await createTestUser()
    await seed2000(u.id)
  }, 60_000)
  afterAll(() => deleteTestUser(u))

  const cases: [string, ListParams][] = [
    ...SORT_OPTIONS.map((o): [string, ListParams] => [
      `sort ${o.value}`,
      { stars: [], importantOnly: false, sort: o.value },
    ]),
    [
      "stars 0,1 + important",
      { stars: [0, 1], importantOnly: true, sort: "alpha_asc" },
    ],
    ["stars 5", { stars: [5], importantOnly: false, sort: "stars_desc" }],
  ]

  it("pages through all words in order with an exact total", async () => {
    const db = u.client as Db
    const params: ListParams = {
      stars: [],
      importantOnly: false,
      sort: "alpha_asc",
    }
    const all = []
    for (let offset = 0; ; offset += WORDS_PAGE_SIZE) {
      const page = await listWords(db, params, { offset })
      expect(page.total).toBe(WORD_COUNT)
      all.push(...page.words)
      if (page.words.length < WORDS_PAGE_SIZE) break
    }
    expect(all).toHaveLength(WORD_COUNT)
    expect(new Set(all.map((w) => w.id)).size).toBe(WORD_COUNT)
    const keys = all.map((w) => w.text.toLowerCase())
    expect(keys).toEqual([...keys].sort())
  })

  it("counts filtered totals", async () => {
    const { total } = await listWords(u.client as Db, {
      stars: [0, 1],
      importantOnly: true,
      sort: "created_desc",
    })
    const expected = Array.from({ length: WORD_COUNT }, (_, i) => i).filter(
      (i) => i % 6 <= 1 && i % 5 === 0,
    ).length
    expect(total).toBe(expected)
  })

  it.each(cases)(`%s completes within ${BUDGET_MS}ms`, async (_, params) => {
    const db = u.client as Db
    // 暖機：剛大量寫入後的第一次查詢可能較慢
    await listWords(db, params)
    await listWords(db, params)
    const timings: number[] = []
    for (let i = 0; i < 5; i++) {
      const started = performance.now()
      const { words } = await listWords(db, params)
      timings.push(performance.now() - started)
      expect(words.length).toBeGreaterThan(0)
      expect(words.length).toBeLessThanOrEqual(WORDS_PAGE_SIZE)
    }
    const median = timings.sort((a, b) => a - b)[2]
    expect(median).toBeLessThan(BUDGET_MS)
  })
})
