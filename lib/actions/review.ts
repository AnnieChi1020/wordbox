"use server"

import { generateDistractors } from "@/lib/ai/generateDistractors"
import { createClient } from "@/lib/db/server"
import {
  countDueWith,
  startSessionWith,
  type StartSessionResult,
} from "@/lib/review/startSession"

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
