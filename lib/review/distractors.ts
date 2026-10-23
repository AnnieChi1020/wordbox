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
 * R6.5: fills in distractors when the user's words yield too few candidates (design §5.3).
 * Uses the cache first; calls the AI and overwrites the cache only if the cache falls short after filtering. Returns null when it cannot fill the gap (R6.6).
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
    // A cache write failure does not affect this question
    console.error("failed to cache distractors", error)
  }
  return question
}
