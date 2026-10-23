import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { setWordImportant, type Db } from "@/lib/db/words"

import {
  createTestUser,
  createWord,
  deleteTestUser,
  type TestUser,
} from "./helpers"

describe("setWordImportant (R3.5)", () => {
  let a: TestUser
  let b: TestUser
  let wordId: string

  async function isImportant() {
    const { data } = await (a.client as Db)
      .from("words")
      .select("is_important")
      .eq("id", wordId)
      .single()
    return data!.is_important
  }

  beforeAll(async () => {
    a = await createTestUser()
    b = await createTestUser()
    wordId = (await createWord(a, "apple")).id
  })
  afterAll(async () => {
    await deleteTestUser(a)
    await deleteTestUser(b)
  })

  it("sets and clears the flag on the owner's word", async () => {
    expect(await setWordImportant(a.client as Db, wordId, true)).toBe(true)
    expect(await isImportant()).toBe(true)
    // Takes the target value: a repeated submission gives the same result
    expect(await setWordImportant(a.client as Db, wordId, true)).toBe(true)
    expect(await isImportant()).toBe(true)
    expect(await setWordImportant(a.client as Db, wordId, false)).toBe(true)
    expect(await isImportant()).toBe(false)
  })

  it("does not touch other users' words (R1.4)", async () => {
    expect(await setWordImportant(b.client as Db, wordId, true)).toBe(false)
    expect(await isImportant()).toBe(false)
  })

  it("returns false for a missing word", async () => {
    expect(
      await setWordImportant(
        a.client as Db,
        "00000000-0000-4000-8000-000000000000",
        true,
      ),
    ).toBe(false)
  })
})
