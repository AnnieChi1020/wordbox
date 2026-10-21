import { getProfile, type Db } from "@/lib/db/words"
import { localToday } from "@/lib/domain/dates"
import { isUuid } from "@/lib/domain/ids"
import { applyAnswer } from "@/lib/domain/leitner"
import { dedupeKey } from "@/lib/domain/normalize"
import {
  DISTRACTOR_COUNT,
  findCorrectOption,
  isQuestionType,
  type QuestionType,
} from "@/lib/domain/questions"

export type AnswerInput = {
  questionId: string
  wordId: string
  senseId: string
  questionType: QuestionType
  options: string[]
  selected: string
}

export type AnswerResult =
  | {
      ok: true
      isCorrect: boolean
      correctOption: string
      boxBefore: number
      boxAfter: number
    }
  | { ok: false; message: string }

export const SUBMIT_ANSWER_MESSAGES = {
  invalid: "作答資料有誤",
  unauthenticated: "登入已過期，請重新登入",
  stale: "這個單字已被刪除或修改，這題不計分",
  failed: "儲存失敗，請重試",
} as const

const MAX_OPTION_LENGTH = 200

/**
 * R7.3、R7.4：伺服器端判定對錯並更新熟悉度（design §6）。
 * 同一個 questionId 重送時回傳第一次的結果。
 */
export async function submitAnswerWith(
  { db, now = new Date() }: { db: Db; now?: Date },
  input: unknown,
): Promise<AnswerResult> {
  if (!isAnswerInput(input)) {
    return { ok: false, message: SUBMIT_ANSWER_MESSAGES.invalid }
  }
  try {
    const profile = await getProfile(db)
    if (!profile) {
      return { ok: false, message: SUBMIT_ANSWER_MESSAGES.unauthenticated }
    }
    const today = localToday(profile.timezone, now)

    // D13：作答狀態在讀取後被其他分頁改變時，重新讀取再試一次
    for (let attempt = 0; ; attempt++) {
      const result = await tryApply(db, input, today)
      if (result !== "conflict") return result
      if (attempt >= 1) {
        return { ok: false, message: SUBMIT_ANSWER_MESSAGES.failed }
      }
    }
  } catch (error) {
    console.error("submitAnswer failed", error)
    return { ok: false, message: SUBMIT_ANSWER_MESSAGES.failed }
  }
}

async function tryApply(
  db: Db,
  input: AnswerInput,
  today: string,
): Promise<AnswerResult | "conflict"> {
  const { data: word, error } = await db
    .from("words")
    .select("text, box, next_due_on, is_important, senses(def_zh, synonyms)")
    .eq("id", input.wordId)
    .eq("senses.id", input.senseId)
    .maybeSingle()
  if (error) throw error
  const sense = word?.senses[0]
  if (!word || !sense) {
    return { ok: false, message: SUBMIT_ANSWER_MESSAGES.stale }
  }

  const correctOption = findCorrectOption(
    input.questionType,
    word,
    sense,
    input.options,
  )
  if (correctOption === null) {
    return { ok: false, message: SUBMIT_ANSWER_MESSAGES.stale }
  }

  const isCorrect = input.selected === correctOption
  const outcome = applyAnswer(
    {
      box: word.box,
      nextDueOn: word.next_due_on,
      isImportant: word.is_important,
    },
    isCorrect,
    today,
  )

  const { data, error: rpcError } = await db.rpc("apply_review", {
    p_question_id: input.questionId,
    p_word_id: input.wordId,
    p_sense_id: input.senseId,
    p_question_type: input.questionType,
    p_is_correct: isCorrect,
    p_was_due: outcome.wasDue,
    p_box_before: word.box,
    p_due_before: word.next_due_on,
    p_box_after: outcome.box,
    p_due_after: outcome.nextDueOn,
    p_local_date: today,
  })
  if (rpcError?.code === "40001") return "conflict"
  if (rpcError?.code === "P0002") {
    return { ok: false, message: SUBMIT_ANSWER_MESSAGES.stale }
  }
  if (rpcError) throw rpcError

  // 重送時為第一次的結果
  const applied = data as {
    is_correct: boolean
    box_before: number
    box_after: number
  }
  return {
    ok: true,
    isCorrect: applied.is_correct,
    correctOption,
    boxBefore: applied.box_before,
    boxAfter: applied.box_after,
  }
}

function isAnswerInput(value: unknown): value is AnswerInput {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  const options = v.options
  return (
    isUuid(v.questionId) &&
    isUuid(v.wordId) &&
    isUuid(v.senseId) &&
    isQuestionType(v.questionType) &&
    Array.isArray(options) &&
    options.length === DISTRACTOR_COUNT + 1 &&
    options.every(
      (o) =>
        typeof o === "string" &&
        o.trim().length > 0 &&
        o.length <= MAX_OPTION_LENGTH,
    ) &&
    new Set(options.map((o: string) => dedupeKey(o))).size === options.length &&
    typeof v.selected === "string" &&
    options.includes(v.selected)
  )
}
