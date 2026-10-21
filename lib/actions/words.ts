"use server"

import { generateWord } from "@/lib/ai/generateWord"
import { createClient } from "@/lib/db/server"
import { listWords } from "@/lib/db/words"
import { addWordWith, type AddWordResult } from "@/lib/words/addWord"
import { parseListParams } from "@/lib/words/listParams"

/** R2：新增單字。 */
export async function addWord(input: string): Promise<AddWordResult> {
  if (typeof input !== "string") {
    return { status: "error", message: "輸入格式錯誤" }
  }
  return addWordWith(
    { db: await createClient(), generate: (text) => generateWord(text) },
    input,
  )
}

/** R3：列表捲動時載入下一頁。listQuery 為目前的篩選與排序（URL query string）。 */
export async function loadMoreWords(listQuery: string, offset: number) {
  if (
    typeof listQuery !== "string" ||
    listQuery.length > 200 ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 100_000
  ) {
    throw new Error("invalid arguments")
  }
  const params = parseListParams(
    Object.fromEntries(new URLSearchParams(listQuery)),
  )
  return listWords(await createClient(), params, { offset })
}
