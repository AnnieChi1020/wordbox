import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getWordDetail, type Db } from "@/lib/db/words"
import { updateWordWith } from "@/lib/words/updateWord"

import {
  createTestUser,
  createWord,
  deleteTestUser,
  sense,
  type TestUser,
} from "./helpers"

describe("updateWord (R4.3, R4.4)", () => {
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

  async function detail(id: string) {
    return (await getWordDetail(a.client as Db, id))!
  }

  it("AC: saves edited synonyms and keeps sense ids", async () => {
    const { id } = await createWord(a, "light", [
      sense({ pos: "noun", def_zh: "光" }),
      sense({ pos: "adjective", def_zh: "輕的" }),
    ])
    const before = await detail(id)
    const [noun, adj] = before.senses

    const result = await updateWordWith(a.client as Db, id, {
      ipa: "/laɪt/",
      senses: [
        { ...noun, synonyms: ["brightness", "glow"] },
        { ...adj, def_zh: "輕盈的" },
        {
          pos: "verb",
          def_en: "to make something start burning",
          def_zh: "點燃",
          synonyms: [],
          antonyms: [],
          examples: [],
        },
      ],
    })
    expect(result).toEqual({ ok: true })

    const after = await detail(id)
    expect(after.ipa).toBe("/laɪt/")
    expect(after.senses).toMatchObject([
      { id: noun.id, synonyms: ["brightness", "glow"] },
      { id: adj.id, def_zh: "輕盈的" },
      { position: 3, pos: "verb", def_zh: "點燃", examples: [] },
    ])
  })

  it("removes senses that are left out", async () => {
    const { id } = await createWord(a, "bank", [
      sense({ def_zh: "銀行" }),
      sense({ def_zh: "河岸" }),
    ])
    const [, riverbank] = (await detail(id)).senses
    expect(
      await updateWordWith(a.client as Db, id, {
        ipa: null,
        senses: [riverbank],
      }),
    ).toEqual({ ok: true })
    const after = await detail(id)
    expect(after.senses.map((s) => s.def_zh)).toEqual(["河岸"])
    expect(after.senses[0]).toMatchObject({ id: riverbank.id, position: 1 })
    expect(after.ipa).toBeNull()
  })

  it("rejects invalid content with field errors and writes nothing (R4.4)", async () => {
    const { id } = await createWord(a, "quick", [sense({ def_zh: "快的" })])
    const [s] = (await detail(id)).senses
    const result = await updateWordWith(a.client as Db, id, {
      ipa: "/changed/",
      senses: [{ ...s, def_zh: " ", examples: ["a", "b", "c"] }],
    })
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        "senses.0.def_zh": "請輸入中文解釋",
        "senses.0.examples": "例句最多 2 句",
      },
    })
    const after = await detail(id)
    expect(after.ipa).not.toBe("/changed/")
    expect(after.senses[0].def_zh).toBe("快的")
  })

  it("cannot edit another user's word (R1.4)", async () => {
    const { id } = await createWord(a, "secret", [sense({ def_zh: "秘密" })])
    const result = await updateWordWith(b.client as Db, id, {
      ipa: null,
      senses: [sense({ def_zh: "被竄改" })],
    })
    expect(result).toEqual({ ok: false, message: "找不到這個單字" })
    expect((await detail(id)).senses[0].def_zh).toBe("秘密")
  })

  it("rejects a sense id that belongs to another word", async () => {
    const w1 = await createWord(a, "one", [sense({ def_zh: "一" })])
    const w2 = await createWord(a, "two", [sense({ def_zh: "二" })])
    const [foreign] = (await detail(w2.id)).senses
    const result = await updateWordWith(a.client as Db, w1.id, {
      ipa: null,
      senses: [foreign],
    })
    expect(result.ok).toBe(false)
    expect((await detail(w1.id)).senses[0].def_zh).toBe("一")
  })

  it("rejects a malformed word id", async () => {
    expect(
      await updateWordWith(a.client as Db, "nope", {
        ipa: null,
        senses: [sense()],
      }),
    ).toEqual({ ok: false, message: "找不到這個單字" })
  })
})
