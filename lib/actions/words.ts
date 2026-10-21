"use server"

import { generateWord } from "@/lib/ai/generateWord"
import { createClient } from "@/lib/db/server"
import { addWordWith, type AddWordResult } from "@/lib/words/addWord"

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
