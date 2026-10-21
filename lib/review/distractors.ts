import type { GenerateDistractorsResult } from "@/lib/ai/generateDistractors"
import { getCachedDistractors, saveCachedDistractors } from "@/lib/db/reviews"
import type { Db } from "@/lib/db/words"
import {
  completeQuestion,
  type Question,
  type QuestionDraft,
} from "@/lib/domain/questions"
import type { Rng } from "@/lib/domain/random"

export type GenerateDistractors = (
  draft: QuestionDraft,
) => Promise<GenerateDistractorsResult>

/**
 * R6.5：字庫候選不足時補足干擾選項（design §5.3）。
 * 先用快取；快取過濾後不夠時才呼叫 AI 並覆寫快取。無法補足時回傳 null（R6.6）。
 */
export async function completeWithDistractors(
  { db, generate }: { db: Db; generate: GenerateDistractors },
  draft: QuestionDraft,
  rng: Rng,
): Promise<Question | null> {
  const cached = await getCachedDistractors(db, draft.senseId, draft.type)
  if (cached) {
    const question = completeQuestion(draft, cached, rng)
    if (question) return question
  }

  const generated = await generate(draft)
  if (generated.status === "error") return null
  const question = completeQuestion(draft, generated.options, rng)
  if (!question) return null

  try {
    await saveCachedDistractors(
      db,
      draft.senseId,
      draft.type,
      generated.options,
    )
  } catch (error) {
    // 快取寫入失敗不影響這次出題
    console.error("failed to cache distractors", error)
  }
  return question
}
