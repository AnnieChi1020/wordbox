import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  anonClient,
  createTestUser,
  createWord,
  deleteTestUser,
  sense,
  type TestUser,
} from "./helpers"

// R1.4：A 使用者無法以任何 Supabase client 查詢或修改 B 使用者的資料
describe("row level security", () => {
  let a: TestUser
  let b: TestUser
  let aWordId: string
  let aSenseId: string

  beforeAll(async () => {
    a = await createTestUser()
    b = await createTestUser()
    aWordId = (await createWord(a, "apple")).id
    const { data } = await a.client
      .from("senses")
      .select("id")
      .eq("word_id", aWordId)
      .single()
    aSenseId = data!.id
    await a.client
      .from("ai_generation_logs")
      .insert({ kind: "generate", input: "apple", success: true })
  })

  afterAll(async () => {
    await deleteTestUser(a)
    await deleteTestUser(b)
  })

  it("lets the owner read their own words and senses", async () => {
    const words = await a.client.from("words").select("id")
    expect(words.data).toEqual([{ id: aWordId }])
    const senses = await a.client.from("senses").select("id")
    expect(senses.data).toEqual([{ id: aSenseId }])
  })

  it("hides other users' words and senses", async () => {
    const words = await b.client.from("words").select("id")
    expect(words.error).toBeNull()
    expect(words.data).toEqual([])

    const byId = await b.client.from("words").select("id").eq("id", aWordId)
    expect(byId.data).toEqual([])

    const senses = await b.client
      .from("senses")
      .select("id")
      .eq("word_id", aWordId)
    expect(senses.data).toEqual([])
  })

  it("prevents updating or deleting other users' words", async () => {
    const update = await b.client
      .from("words")
      .update({ is_important: true, box: 5 })
      .eq("id", aWordId)
      .select()
    expect(update.data).toEqual([])

    const del = await b.client.from("words").delete().eq("id", aWordId).select()
    expect(del.data).toEqual([])

    const senseUpdate = await b.client
      .from("senses")
      .update({ def_zh: "被竄改" })
      .eq("id", aSenseId)
      .select()
    expect(senseUpdate.data).toEqual([])

    const { data } = await a.client
      .from("words")
      .select("is_important, box, senses(def_zh)")
      .eq("id", aWordId)
      .single()
    expect(data).toEqual({
      is_important: false,
      box: 0,
      senses: [{ def_zh: "蘋果" }],
    })
  })

  it("prevents inserting rows owned by another user", async () => {
    const word = await b.client.from("words").insert({
      user_id: a.id,
      text: "banana",
      next_due_on: "2026-10-20",
    })
    expect(word.error?.code).toBe("42501")

    const s = await b.client.from("senses").insert({
      word_id: aWordId,
      position: 2,
      pos: "noun",
      def_en: "x",
      def_zh: "x",
    })
    expect(s.error?.code).toBe("42501")

    const log = await b.client
      .from("ai_generation_logs")
      .insert({ user_id: a.id, kind: "generate", input: "x", success: true })
    expect(log.error?.code).toBe("42501")
  })

  it("rejects RPC writes to other users' words", async () => {
    const update = await b.client.rpc("update_word_content", {
      p_word_id: aWordId,
      p_ipa: null,
      p_senses: [sense({ def_zh: "被竄改" })],
    })
    expect(update.error?.message).toContain("word not found")

    const replace = await b.client.rpc("replace_word_content", {
      p_word_id: aWordId,
      p_ipa: null,
      p_senses: [sense({ def_zh: "被竄改" })],
    })
    expect(replace.error?.message).toContain("word not found")
  })

  it("isolates profiles and AI logs", async () => {
    const profiles = await b.client.from("profiles").select("id")
    expect(profiles.data).toEqual([{ id: b.id }])

    const logs = await b.client.from("ai_generation_logs").select("id")
    expect(logs.data).toEqual([])
  })

  it("denies anonymous access", async () => {
    const anon = anonClient()
    const words = await anon.from("words").select("id")
    expect(words.data ?? []).toEqual([])
    const rpc = await anon.rpc("create_word", {
      p_text: "apple",
      p_ipa: null,
      p_senses: [sense()],
      p_today: "2026-10-20",
    })
    expect(rpc.error).not.toBeNull()
  })
})
