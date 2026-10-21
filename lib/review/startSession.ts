import {
  countDueWords,
  listReviewWords,
  type ReviewWord,
} from "@/lib/db/reviews"
import { getProfile, type Db } from "@/lib/db/words"
import { localToday } from "@/lib/domain/dates"
import {
  availableTypes,
  buildQuestion,
  type Question,
} from "@/lib/domain/questions"
import { defaultRng, pick, shuffle, type Rng } from "@/lib/domain/random"
import { orderSessionCandidates, SESSION_SIZE } from "@/lib/domain/selection"

import {
  completeWithDistractors,
  type GenerateDistractors,
} from "./distractors"

/** 傳給 client 的題目：不含正確答案（D15）。 */
export type ClientQuestion = Omit<Question, "answer"> & { questionId: string }

export type StartSessionResult =
  { ok: true; questions: ClientQuestion[] } | { ok: false; message: string }

export type StartSessionDeps = {
  db: Db
  generate: GenerateDistractors
  rng?: Rng
  now?: Date
  newId?: () => string
}

export const START_SESSION_MESSAGES = {
  unauthenticated: "登入已過期，請重新登入",
  failed: "出題失敗，請重試",
} as const

/**
 * R5、R6：開始一輪複習（design §6）。
 * 依候選序列取字出題；需要 AI 的題目平行處理（D14），無法出題的字略過並遞補（R6.6）。
 */
export async function startSessionWith({
  db,
  generate,
  rng = defaultRng,
  now = new Date(),
  newId = () => crypto.randomUUID(),
}: StartSessionDeps): Promise<StartSessionResult> {
  try {
    const profile = await getProfile(db)
    if (!profile) {
      return { ok: false, message: START_SESSION_MESSAGES.unauthenticated }
    }
    const today = localToday(profile.timezone, now)
    const words = await listReviewWords(db)
    const candidates = orderSessionCandidates(words, today, rng)

    const questions: Question[] = []
    let next = 0
    while (questions.length < SESSION_SIZE && next < candidates.length) {
      const batch = candidates.slice(
        next,
        next + SESSION_SIZE - questions.length,
      )
      next += batch.length
      const results = await Promise.all(
        batch.map((word) => questionFor(word, words, { db, generate }, rng)),
      )
      for (const q of results) if (q) questions.push(q)
    }

    return {
      ok: true,
      questions: questions.map((q) => ({
        questionId: newId(),
        type: q.type,
        wordId: q.wordId,
        senseId: q.senseId,
        prompt: q.prompt,
        pos: q.pos,
        options: q.options,
      })),
    }
  } catch (error) {
    console.error("startReviewSession failed", error)
    return { ok: false, message: START_SESSION_MESSAGES.failed }
  }
}

/**
 * R6.1、R6.6：隨機選義項與題型；字庫不足時以快取或 AI 補足，失敗則換該義項的其他題型。
 * 所有題型都無法出題時回傳 null。
 */
async function questionFor(
  word: ReviewWord,
  pool: readonly ReviewWord[],
  deps: { db: Db; generate: GenerateDistractors },
  rng: Rng,
): Promise<Question | null> {
  const sense = pick(word.senses, rng)
  if (!sense) return null
  for (const type of shuffle(availableTypes(sense), rng)) {
    const built = buildQuestion(word, sense, type, pool, rng)
    if ("question" in built) return built.question
    try {
      const question = await completeWithDistractors(deps, built.needsAi, rng)
      if (question) return question
    } catch (error) {
      console.error("failed to complete distractors", error)
    }
  }
  return null
}

/** R7.5：今天到期的單字數；ReviewIntro 與結算畫面使用。 */
export async function countDueWith(
  db: Db,
  now: Date = new Date(),
): Promise<number> {
  const profile = await getProfile(db)
  if (!profile) return 0
  return countDueWords(db, localToday(profile.timezone, now))
}
