"use server"

import { generateDistractors } from "@/lib/ai/generateDistractors"
import { createClient } from "@/lib/db/server"
import {
  countDueWith,
  startSessionWith,
  type StartSessionResult,
} from "@/lib/review/startSession"
import {
  submitAnswerWith,
  type AnswerInput,
  type AnswerResult,
} from "@/lib/review/submitAnswer"

/** R5, R6: start a review session. */
export async function startReviewSession(): Promise<StartSessionResult> {
  return startSessionWith({
    db: await createClient(),
    generate: (draft) => generateDistractors(draft),
  })
}

/** R7.5: the number of words due today. */
export async function countDueWords(): Promise<number> {
  return countDueWith(await createClient())
}

/** R7.3: answer a question; the client sends questionId and the options back unchanged (D15). */
export async function submitAnswer(input: AnswerInput): Promise<AnswerResult> {
  return submitAnswerWith({ db: await createClient() }, input)
}
