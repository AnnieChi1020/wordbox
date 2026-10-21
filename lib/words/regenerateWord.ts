import type { GenerateWordResult } from "@/lib/ai/generateWord"
import { replaceWordContent, type Db } from "@/lib/db/words"
import { isUuid } from "@/lib/domain/ids"

export type WordActionResult = { ok: true } | { ok: false; message: string }

export const NOT_FOUND = { ok: false, message: "找不到這個單字" } as const

/**
 * R4.5、R4.6：以 AI 重新生成 IPA 與所有義項並取代舊內容。
 * box、next_due_on、is_important 與單字本身不變；失敗時不寫入任何資料。
 */
export async function regenerateWordWith(
  db: Db,
  generate: (text: string) => Promise<GenerateWordResult>,
  wordId: string,
): Promise<WordActionResult> {
  if (!isUuid(wordId)) return NOT_FOUND
  try {
    const { data: word, error } = await db
      .from("words")
      .select("text")
      .eq("id", wordId)
      .maybeSingle()
    if (error) throw error
    if (!word) return NOT_FOUND

    const generated = await generate(word.text)
    if (generated.status === "invalid") {
      return { ok: false, message: "AI 無法為這個字重新生成內容" }
    }
    if (generated.status === "error") {
      const message = {
        timeout: "AI 回應逾時，原內容未變更，請重試",
        format: "AI 回傳的內容有誤，原內容未變更，請重試",
        api: "AI 服務暫時無法使用，原內容未變更，請重試",
      }[generated.reason]
      return { ok: false, message }
    }

    // headword 不採用：重新生成不改變單字本身（R4.3、R4.5）
    const replaced = await replaceWordContent(db, wordId, {
      ipa: generated.ipa,
      senses: generated.senses,
    })
    return replaced ? { ok: true } : NOT_FOUND
  } catch (error) {
    console.error("regenerateWord failed", error)
    return { ok: false, message: "重新生成失敗，原內容未變更，請重試" }
  }
}
