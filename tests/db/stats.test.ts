import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getDashboardStats } from "@/lib/db/stats"
import type { Db } from "@/lib/db/words"

import {
  adminClient,
  anonClient,
  createTestUser,
  createWord,
  deleteTestUser,
  type TestUser,
} from "./helpers"

/** 以 service role 寫入複習紀錄（不經過 apply_review，方便指定日期） */
async function seedLogs(
  user: TestUser,
  wordId: string | null,
  dates: Record<string, number>,
) {
  const rows = Object.entries(dates).flatMap(([localDate, n]) =>
    Array.from({ length: n }, () => ({
      user_id: user.id,
      question_id: randomUUID(),
      word_id: wordId,
      question_type: "word_to_zh",
      is_correct: true,
      was_due: true,
      box_before: 0,
      box_after: 1,
      local_date: localDate,
    })),
  )
  const { error } = await adminClient().from("review_logs").insert(rows)
  if (error) throw error
}

describe("get_dashboard_stats (R8.1, R8.2, R8.6)", () => {
  let a: TestUser
  let b: TestUser
  let doomedId: string

  beforeAll(async () => {
    a = await createTestUser()
    b = await createTestUser()

    const boxes: Record<string, number> = {
      apple: 0,
      pear: 0,
      plum: 2,
      grape: 5,
      lemon: 5,
    }
    for (const [text, box] of Object.entries(boxes)) {
      const { id } = await createWord(a, text)
      await adminClient().from("words").update({ box }).eq("id", id)
      if (text === "lemon") doomedId = id
    }
    await seedLogs(a, doomedId, {
      "2025-10-18": 4, // 早於 since
      "2025-10-19": 1,
      "2026-01-01": 10,
      "2026-10-22": 3,
    })

    // B 的資料不應計入 A
    const { id: bWord } = await createWord(b, "apple")
    await seedLogs(b, bWord, { "2026-10-22": 7 })
  })

  afterAll(async () => {
    await deleteTestUser(a)
    await deleteTestUser(b)
  })

  const stats = (user: TestUser) =>
    getDashboardStats(user.client as unknown as Db, "2025-10-19")

  it("returns totals, the star distribution and daily counts since the given date", async () => {
    const s = await stats(a)
    expect(s.total).toBe(5)
    expect(s.byBox).toEqual([2, 0, 1, 0, 0, 2])
    expect(Object.fromEntries(s.daily)).toEqual({
      "2025-10-19": 1,
      "2026-01-01": 10,
      "2026-10-22": 3,
    })
  })

  it("only counts the current user's data (R1.4)", async () => {
    const s = await stats(b)
    expect(s.total).toBe(1)
    expect(s.byBox).toEqual([1, 0, 0, 0, 0, 0])
    expect(Object.fromEntries(s.daily)).toEqual({ "2026-10-22": 7 })
  })

  it("returns zeros for a user without data", async () => {
    const c = await createTestUser()
    try {
      const s = await stats(c)
      expect(s).toEqual({
        total: 0,
        byBox: [0, 0, 0, 0, 0, 0],
        daily: new Map(),
      })
    } finally {
      await deleteTestUser(c)
    }
  })

  it("keeps daily counts after deleting a word (R8 AC, R4.7 AC)", async () => {
    const before = await stats(a)
    await a.client.from("words").delete().eq("id", doomedId)
    const after = await stats(a)
    expect(after.total).toBe(before.total - 1)
    expect(after.byBox).toEqual([2, 0, 1, 0, 0, 1])
    expect(after.daily).toEqual(before.daily)
  })

  it("is not callable anonymously", async () => {
    const { error } = await anonClient().rpc("get_dashboard_stats", {
      p_since: "2025-10-19",
    })
    expect(error).not.toBeNull()
  })
})
