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

/** R5、R6：開始一輪複習。 */
export async function startReviewSession(): Promise<StartSessionResult> {
  return startSessionWith({
    db: await createClient(),
    generate: (draft) => generateDistractors(draft),
  })
}

/** R7.5：今天到期的單字數。 */
export async function countDueWords(): Promise<number> {
  return countDueWith(await createClient())
}

/** R7.3：作答；client 原樣帶回 questionId 與選項（D15）。 */
export async function submitAnswer(input: AnswerInput): Promise<AnswerResult> {
  return submitAnswerWith({ db: await createClient() }, input)
}
