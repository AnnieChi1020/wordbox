import type { QuestionType, QuestionWord } from "@/lib/domain/questions"
import type { WordState } from "@/lib/domain/selection"

import type { Db } from "./words"

/** R6.5: the AI distractor cache for one sense and question type; null when there is none. */
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

/** Writes or overwrites the cache (design §5.3). */
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

/** PostgREST's per-request row limit (max_rows in supabase/config.toml). */
const MAX_ROWS = 1000

/** For building questions: every word's review state and senses (shared by word selection and distractor candidates, design §6). */
export async function listReviewWords(db: Db): Promise<ReviewWord[]> {
  const words: ReviewWord[] = []
  for (let offset = 0; ; offset += MAX_ROWS) {
    const { data, error } = await db
      .from("words")
      .select(
        "id, text, box, next_due_on, senses(id, pos, def_zh, synonyms, antonyms)",
      )
      .order("id")
      .range(offset, offset + MAX_ROWS - 1)
    if (error) throw error
    for (const { next_due_on, ...word } of data) {
      words.push({ ...word, nextDueOn: next_due_on })
    }
    if (data.length < MAX_ROWS) return words
  }
}

/** The number of due words (next_due_on ≤ local today) (R7.5). */
export async function countDueWords(db: Db, today: string): Promise<number> {
  const { count, error } = await db
    .from("words")
    .select("id", { count: "exact", head: true })
    .lte("next_due_on", today)
  if (error) throw error
  return count ?? 0
}
