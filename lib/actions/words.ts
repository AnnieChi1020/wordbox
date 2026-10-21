"use server"

import { generateWord } from "@/lib/ai/generateWord"
import { createClient } from "@/lib/db/server"
import { listWords, setWordImportant } from "@/lib/db/words"
import { isUuid } from "@/lib/domain/ids"
import { addWordWith, type AddWordResult } from "@/lib/words/addWord"
import type { EditWordInput } from "@/lib/words/editSchema"
import { parseListParams } from "@/lib/words/listParams"
import { deleteWordWith } from "@/lib/words/deleteWord"
import {
  regenerateWordWith,
  type WordActionResult,
} from "@/lib/words/regenerateWord"
import { updateWordWith, type UpdateWordResult } from "@/lib/words/updateWord"

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

export type ActionResult = { ok: true } | { ok: false; message: string }

/** R3.5：切換 important（前端 optimistic update）。傳入目標值，重複送出結果相同。 */
export async function setImportant(
  wordId: string,
  value: boolean,
): Promise<ActionResult> {
  if (!isUuid(wordId) || typeof value !== "boolean") {
    return { ok: false, message: "參數錯誤" }
  }
  try {
    const updated = await setWordImportant(await createClient(), wordId, value)
    return updated ? { ok: true } : { ok: false, message: "找不到這個單字" }
  } catch (error) {
    console.error("setImportant failed", error)
    return { ok: false, message: "更新失敗，請重試" }
  }
}

/** R4.3：儲存編輯內容。 */
export async function updateWord(
  wordId: string,
  input: EditWordInput,
): Promise<UpdateWordResult> {
  return updateWordWith(await createClient(), wordId, input)
}

/** R4.5：重新生成（AI 呼叫記錄為 regenerate）。 */
export async function regenerateWord(
  wordId: string,
): Promise<WordActionResult> {
  return regenerateWordWith(
    await createClient(),
    (text) => generateWord(text, { kind: "regenerate" }),
    wordId,
  )
}

/** R4.7：刪除單字。 */
export async function deleteWord(wordId: string): Promise<WordActionResult> {
  return deleteWordWith(await createClient(), wordId)
}
