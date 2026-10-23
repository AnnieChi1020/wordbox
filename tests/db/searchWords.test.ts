import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { listWords, type Db } from "@/lib/db/words"
import { DEFAULT_LIST_PARAMS, type ListParams } from "@/lib/words/listParams"

import {
  adminClient,
  createTestUser,
  createWord,
  deleteTestUser,
  type TestUser,
} from "./helpers"

describe("listWords search (R3.9)", () => {
  let u: TestUser
  let other: TestUser

  beforeAll(async () => {
    u = await createTestUser()
    other = await createTestUser()
    for (const text of ["give up", "upset", "apple", "Monday"]) {
      await createWord(u, text)
    }
    await createWord(other, "update")
    const { error } = await adminClient()
      .from("words")
      .update({ box: 1 })
      .eq("user_id", u.id)
      .in("text", ["upset", "apple"])
    if (error) throw error
  })
  afterAll(async () => {
    await deleteTestUser(u)
    await deleteTestUser(other)
  })

  async function search(q: string, params: Partial<ListParams> = {}) {
    const { words, total } = await listWords(u.client as Db, {
      ...DEFAULT_LIST_PARAMS,
      sort: "alpha_asc",
      ...params,
      q,
    })
    expect(total).toBe(words.length)
    return words.map((w) => w.text)
  }

  it("AC: matches the text anywhere, case-insensitively", async () => {
    expect(await search("up")).toEqual(["give up", "upset"])
    expect(await search("mon")).toEqual(["Monday"])
  })

  it("AC: combines with the star filter", async () => {
    expect(await search("up", { stars: [1] })).toEqual(["upset"])
  })

  it("AC: treats % and _ literally", async () => {
    expect(await search("%")).toEqual([])
    expect(await search("_")).toEqual([])
    expect(await search("e u")).toEqual(["give up"])
  })

  it("only returns the user's own words (R1.4)", async () => {
    expect(await search("upd")).toEqual([])
  })
})
