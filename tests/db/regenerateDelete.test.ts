import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { generateWord, type GenerateWordResult } from "@/lib/ai/generateWord"
import { mockClient, MOCK_TIMEOUT_INPUT } from "@/lib/ai/mock"
import { getWordDetail, type Db } from "@/lib/db/words"
import { deleteWordWith } from "@/lib/words/deleteWord"
import { regenerateWordWith } from "@/lib/words/regenerateWord"

import {
  adminClient,
  createTestUser,
  createWord,
  deleteTestUser,
  sense,
  type TestUser,
} from "./helpers"

describe("regenerateWord (R4.5, R4.6)", () => {
  let a: TestUser
  let b: TestUser
  let db: Db

  const regenerate = (text: string) =>
    generateWord(text, {
      kind: "regenerate",
      client: mockClient,
      timeoutMs: 100,
      log: async (entry) => {
        await db.from("ai_generation_logs").insert(entry)
      },
    })

  beforeAll(async () => {
    a = await createTestUser()
    b = await createTestUser()
    db = a.client as Db
  })
  afterAll(async () => {
    await deleteTestUser(a)
    await deleteTestUser(b)
  })

  it("AC: replaces content but keeps box, important, due date and the word", async () => {
    const { id } = await createWord(a, "run", [sense({ def_zh: "舊的解釋" })])
    await db
      .from("words")
      .update({ box: 3, is_important: true, next_due_on: "2026-11-01" })
      .eq("id", id)
    const before = (await getWordDetail(db, id))!

    expect(await regenerateWordWith(db, regenerate, id)).toEqual({ ok: true })

    const after = (await getWordDetail(db, id))!
    expect(after).toMatchObject({
      text: "run",
      ipa: "/rʌn/",
      box: 3,
      is_important: true,
    })
    expect(after.senses.map((s) => s.def_zh)).toEqual([
      "跑；奔跑",
      "經營；管理",
      "跑步",
    ])
    expect(after.senses[0].id).not.toBe(before.senses[0].id)
    const { data: due } = await db
      .from("words")
      .select("next_due_on")
      .eq("id", id)
      .single()
    expect(due!.next_due_on).toBe("2026-11-01")

    const { data: logs } = await db
      .from("ai_generation_logs")
      .select("kind, input, success")
      .eq("input", "run")
    expect(logs).toEqual([{ kind: "regenerate", input: "run", success: true }])
  })

  it("does not change the stored word even if the AI capitalizes differently", async () => {
    const { id } = await createWord(a, "Monday", [sense()])
    await db.from("words").update({ text: "monday" }).eq("id", id) // pretend the old data was lowercase
    expect(await regenerateWordWith(db, regenerate, id)).toEqual({ ok: true })
    expect((await getWordDetail(db, id))!.text).toBe("monday")
  })

  it("keeps the original content when AI fails (R4.6)", async () => {
    const { id } = await createWord(a, MOCK_TIMEOUT_INPUT, [
      sense({ def_zh: "原本" }),
    ])
    const result = await regenerateWordWith(db, regenerate, id)
    expect(result).toEqual({
      ok: false,
      message: "AI 回應逾時，原內容未變更，請重試",
    })
    expect((await getWordDetail(db, id))!.senses.map((s) => s.def_zh)).toEqual([
      "原本",
    ])
  })

  it("treats an AI `invalid` verdict as a failure", async () => {
    const { id } = await createWord(a, "aple", [sense({ def_zh: "原本" })])
    const result = await regenerateWordWith(db, regenerate, id)
    expect(result.ok).toBe(false)
    expect((await getWordDetail(db, id))!.senses[0].def_zh).toBe("原本")
  })

  it("cannot regenerate another user's word without calling AI", async () => {
    const { id } = await createWord(a, "secret", [sense({ def_zh: "秘密" })])
    let called = false
    const spy = async (text: string): Promise<GenerateWordResult> => {
      called = true
      return regenerate(text)
    }
    expect(await regenerateWordWith(b.client as Db, spy, id)).toEqual({
      ok: false,
      message: "找不到這個單字",
    })
    expect(called).toBe(false)
  })
})

describe("deleteWord (R4.7)", () => {
  let a: TestUser
  let b: TestUser

  beforeAll(async () => {
    a = await createTestUser()
    b = await createTestUser()
  })
  afterAll(async () => {
    await deleteTestUser(a)
    await deleteTestUser(b)
  })

  it("deletes the word and its senses", async () => {
    const { id } = await createWord(a, "gone", [sense(), sense()])
    expect(await deleteWordWith(a.client as Db, id)).toEqual({ ok: true })
    const admin = adminClient()
    expect((await admin.from("words").select("id").eq("id", id)).data).toEqual(
      [],
    )
    expect(
      (await admin.from("senses").select("id").eq("word_id", id)).data,
    ).toEqual([])
    // Delete again → not found
    expect(await deleteWordWith(a.client as Db, id)).toEqual({
      ok: false,
      message: "找不到這個單字",
    })
  })

  it("cannot delete another user's word (R1.4)", async () => {
    const { id } = await createWord(a, "mine")
    expect((await deleteWordWith(b.client as Db, id)).ok).toBe(false)
    expect(
      (await adminClient().from("words").select("id").eq("id", id)).data,
    ).toHaveLength(1)
  })
})
