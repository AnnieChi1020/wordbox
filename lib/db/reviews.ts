import type { QuestionType, QuestionWord } from "@/lib/domain/questions"
import type { WordState } from "@/lib/domain/selection"

import type { Db } from "./words"

/** R6.5：同一義項、同一題型的 AI 干擾選項快取；沒有時為 null。 */
export async function getCachedDistractors(
  db: Db,
  senseId: string,
  type: QuestionType,
): Promise<string[] | null> {
  const { data, error } = await db
    .from("ai_distractors")
    .select("options")
    .eq("sense_id", senseId)
    .eq("question_type", type)
    .maybeSingle()
  if (error) throw error
  return data?.options ?? null
}

/** 寫入或覆寫快取（design §5.3）。 */
export async function saveCachedDistractors(
  db: Db,
  senseId: string,
  type: QuestionType,
  options: string[],
): Promise<void> {
  const { error } = await db
    .from("ai_distractors")
    .upsert({ sense_id: senseId, question_type: type, options })
  if (error) throw error
}

export type ReviewWord = QuestionWord & WordState

/** PostgREST 單次回傳上限（supabase/config.toml 的 max_rows）。 */
const MAX_ROWS = 1000

/** 出題用：所有單字的複習狀態與義項（選字與干擾候選共用，design §6）。 */
export async function listReviewWords(db: Db): Promise<ReviewWord[]> {
  const words: ReviewWord[] = []
  for (let offset = 0; ; offset += MAX_ROWS) {
    const { data, error } = await db
      .from("words")
      .select("id, text, box, next_due_on, senses(id, pos, def_zh, synonyms)")
      .order("id")
      .range(offset, offset + MAX_ROWS - 1)
    if (error) throw error
    for (const { next_due_on, ...word } of data) {
      words.push({ ...word, nextDueOn: next_due_on })
    }
    if (data.length < MAX_ROWS) return words
  }
}

/** 到期（next_due_on ≤ 當地今天）的單字數（R7.5）。 */
export async function countDueWords(db: Db, today: string): Promise<number> {
  const { count, error } = await db
    .from("words")
    .select("id", { count: "exact", head: true })
    .lte("next_due_on", today)
  if (error) throw error
  return count ?? 0
}
