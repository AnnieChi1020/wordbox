import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  createTestUser,
  createWord,
  deleteTestUser,
  sense,
  type TestUser,
} from "./helpers"

const SENSE_COLUMNS =
  "id, position, pos, def_en, def_zh, synonyms, antonyms, examples"

async function getWord(user: TestUser, id: string) {
  const { data, error } = await user.client
    .from("words")
    .select(`*, senses(${SENSE_COLUMNS})`)
    .eq("id", id)
    .order("position", { referencedTable: "senses" })
    .single()
  if (error) throw error
  return data
}

describe("profiles", () => {
  let u: TestUser
  beforeAll(async () => {
    u = await createTestUser()
  })
  afterAll(() => deleteTestUser(u))

  it("creates a profile with null timezone on sign-up (design §4.4)", async () => {
    const { data } = await u.client
      .from("profiles")
      .select("id, timezone")
      .single()
    expect(data).toEqual({ id: u.id, timezone: null })
  })
})

describe("create_word", () => {
  let u: TestUser
  beforeAll(async () => {
    u = await createTestUser()
  })
  afterAll(() => deleteTestUser(u))

  it("creates a word with initial review state and ordered senses (R2.7, R2.8)", async () => {
    const { id, existed } = await createWord(
      u,
      "run",
      [
        sense({
          pos: "verb",
          def_zh: "跑",
          synonyms: ["sprint", "dash"],
          examples: ["I run every day.", "She runs fast."],
        }),
        sense({ pos: "noun", def_zh: "跑步", antonyms: ["walk"] }),
      ],
      "2026-10-20",
    )
    expect(existed).toBe(false)

    const word = await getWord(u, id)
    expect(word).toMatchObject({
      user_id: u.id,
      text: "run",
      box: 0,
      next_due_on: "2026-10-20",
      is_important: false,
    })
    expect(word.senses).toMatchObject([
      {
        position: 1,
        pos: "verb",
        def_zh: "跑",
        synonyms: ["sprint", "dash"],
        examples: ["I run every day.", "She runs fast."],
      },
      { position: 2, pos: "noun", def_zh: "跑步", antonyms: ["walk"] },
    ])
  })

  it("returns the existing word on case-insensitive duplicates (R2.4)", async () => {
    const first = await createWord(u, "apple")
    const second = await createWord(u, "Apple", [sense(), sense()])
    expect(second).toEqual({ id: first.id, existed: true })

    const word = await getWord(u, first.id)
    expect(word.text).toBe("apple")
    expect(word.senses).toHaveLength(1)
  })

  it("rejects 0 or more than 3 senses without writing anything", async () => {
    for (const senses of [[], [sense(), sense(), sense(), sense()]]) {
      const { error } = await u.client.rpc("create_word", {
        p_text: "banana",
        p_ipa: null,
        p_senses: senses,
        p_today: "2026-10-20",
      })
      expect(error).not.toBeNull()
    }
    const { data } = await u.client
      .from("words")
      .select("id")
      .eq("text", "banana")
    expect(data).toEqual([])
  })

  it("rolls back the word when a sense violates a constraint", async () => {
    const { error } = await u.client.rpc("create_word", {
      p_text: "cherry",
      p_ipa: null,
      p_senses: [sense({ def_zh: "" })],
      p_today: "2026-10-20",
    })
    expect(error).not.toBeNull()
    const { data } = await u.client
      .from("words")
      .select("id")
      .eq("text", "cherry")
    expect(data).toEqual([])
  })

  it("rejects text that breaks the input format (R2.3)", async () => {
    for (const text of ["1apple", "apple!", "a".repeat(65)]) {
      const { error } = await u.client.rpc("create_word", {
        p_text: text,
        p_ipa: null,
        p_senses: [sense()],
        p_today: "2026-10-20",
      })
      expect(error, text).not.toBeNull()
    }
  })
})

describe("update_word_content", () => {
  let u: TestUser
  beforeAll(async () => {
    u = await createTestUser()
  })
  afterAll(() => deleteTestUser(u))

  it("updates senses in place, keeping ids of retained senses (R4.3, D9)", async () => {
    const { id } = await createWord(u, "light", [
      sense({ pos: "noun", def_zh: "光" }),
      sense({ pos: "adjective", def_zh: "輕的" }),
      sense({ pos: "verb", def_zh: "點燃" }),
    ])
    await u.client
      .from("words")
      .update({ box: 3, is_important: true })
      .eq("id", id)
    const before = await getWord(u, id)
    const [noun, , verb] = before.senses

    // 刪除第 2 個、把第 3 個移到最前面並修改、新增一個
    const { error } = await u.client.rpc("update_word_content", {
      p_word_id: id,
      p_ipa: "/laɪt/",
      p_senses: [
        { ...verb, def_zh: "點亮", synonyms: ["ignite"] },
        noun,
        sense({ pos: "adjective", def_zh: "淺色的" }),
      ],
    })
    expect(error).toBeNull()

    const after = await getWord(u, id)
    expect(after).toMatchObject({ ipa: "/laɪt/", box: 3, is_important: true })
    expect(after.updated_at > before.updated_at).toBe(true)
    expect(after.senses).toMatchObject([
      { id: verb.id, position: 1, def_zh: "點亮", synonyms: ["ignite"] },
      { id: noun.id, position: 2, def_zh: "光" },
      { position: 3, def_zh: "淺色的" },
    ])
    expect(after.senses[2].id).not.toBe(before.senses[1].id)
  })

  it("rejects a sense id from another word and rolls back", async () => {
    const w1 = await createWord(u, "dark")
    const w2 = await createWord(u, "bright")
    const foreign = (await getWord(u, w2.id)).senses[0]

    const { error } = await u.client.rpc("update_word_content", {
      p_word_id: w1.id,
      p_ipa: "/changed/",
      p_senses: [foreign],
    })
    expect(error).not.toBeNull()

    const w1After = await getWord(u, w1.id)
    expect(w1After.ipa).not.toBe("/changed/")
    expect(w1After.senses).toHaveLength(1)
    expect((await getWord(u, w2.id)).senses[0].id).toBe(foreign.id)
  })

  it("rejects invalid content (R4.4)", async () => {
    const { id } = await createWord(u, "quick")
    const s = (await getWord(u, id)).senses[0]
    const cases = [
      [],
      [{ ...s, def_en: "" }],
      [{ ...s, synonyms: ["a", "b", "c", "d", "e", "f"] }],
      [{ ...s, examples: ["a", "b", "c"] }],
      [s, sense(), sense(), sense()],
    ]
    for (const senses of cases) {
      const { error } = await u.client.rpc("update_word_content", {
        p_word_id: id,
        p_ipa: null,
        p_senses: senses,
      })
      expect(error, JSON.stringify(senses)).not.toBeNull()
    }
  })
})

describe("replace_word_content", () => {
  let u: TestUser
  beforeAll(async () => {
    u = await createTestUser()
  })
  afterAll(() => deleteTestUser(u))

  it("replaces all senses while keeping review state (R4.5)", async () => {
    const { id } = await createWord(u, "bank", [sense({ def_zh: "銀行" })])
    await u.client
      .from("words")
      .update({ box: 4, is_important: true, next_due_on: "2026-11-01" })
      .eq("id", id)
    const before = await getWord(u, id)

    const { error } = await u.client.rpc("replace_word_content", {
      p_word_id: id,
      p_ipa: "/bæŋk/",
      p_senses: [sense({ def_zh: "銀行" }), sense({ def_zh: "河岸" })],
    })
    expect(error).toBeNull()

    const after = await getWord(u, id)
    expect(after).toMatchObject({
      ipa: "/bæŋk/",
      box: 4,
      is_important: true,
      next_due_on: "2026-11-01",
    })
    expect(after.senses.map((s: { def_zh: string }) => s.def_zh)).toEqual([
      "銀行",
      "河岸",
    ])
    expect(after.senses[0].id).not.toBe(before.senses[0].id)
  })
})
