import { updateWordContent, type Db } from "@/lib/db/words"
import { isUuid } from "@/lib/domain/ids"

import { EditWordSchema, fieldErrors } from "./editSchema"

export type UpdateWordResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

/** R4.3, R4.4: validate, then update in place with update_word_content (design D9). */
export async function updateWordWith(
  db: Db,
  wordId: string,
  input: unknown,
): Promise<UpdateWordResult> {
  if (!isUuid(wordId)) return { ok: false, message: "找不到這個單字" }

  // Validate again on the server; do not trust the client
  const parsed = EditWordSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: "內容有誤，請修正標示的欄位",
      fieldErrors: fieldErrors(parsed.error),
    }
  }

  try {
    const updated = await updateWordContent(db, wordId, parsed.data)
    return updated ? { ok: true } : { ok: false, message: "找不到這個單字" }
  } catch (error) {
    console.error("updateWord failed", error)
    return { ok: false, message: "儲存失敗，請重試" }
  }
}
