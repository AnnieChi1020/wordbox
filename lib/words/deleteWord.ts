import { deleteWordById, type Db } from "@/lib/db/words"
import { isUuid } from "@/lib/domain/ids"

import { NOT_FOUND, type WordActionResult } from "./regenerateWord"

/** R4.7: delete a word and its senses; review logs are kept (Phase 2: word_id set null). */
export async function deleteWordWith(
  db: Db,
  wordId: string,
): Promise<WordActionResult> {
  if (!isUuid(wordId)) return NOT_FOUND
  try {
    return (await deleteWordById(db, wordId)) ? { ok: true } : NOT_FOUND
  } catch (error) {
    console.error("deleteWord failed", error)
    return { ok: false, message: "刪除失敗，請重試" }
  }
}
