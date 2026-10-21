import type { QuestionType } from "@/lib/domain/questions"

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
