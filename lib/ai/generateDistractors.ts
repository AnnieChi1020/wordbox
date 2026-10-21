import "server-only"

import { dedupeKey } from "@/lib/domain/normalize"
import type { QuestionDraft } from "@/lib/domain/questions"

import type { AiClient } from "./client"
import { logAiCall, type AiCallLog } from "./log"
import { DISTRACTORS_SYSTEM_PROMPT, distractorsUserMessage } from "./prompts"
import { defaultTimeoutMs, requestJson, type AiErrorReason } from "./request"
import { DistractorsSchema } from "./schemas"

export type DistractorRequest = Pick<
  QuestionDraft,
  "type" | "prompt" | "pos" | "answer" | "synonyms"
>

export type GenerateDistractorsResult =
  | { status: "ok"; options: string[] }
  | { status: "error"; reason: AiErrorReason }

type Deps = {
  client?: AiClient
  log?: (entry: AiCallLog) => Promise<void>
  timeoutMs?: number
}

/** 題目中的英文單字：zh_to_word 的正確答案，其他題型的題目。 */
export function quizWord(request: DistractorRequest): string {
  return request.type === "zh_to_word" ? request.answer : request.prompt
}

/**
 * R6.5：以 AI 生成 3 個干擾選項（design §5.3）。
 * 逾時、API 失敗、格式不符或選項重複時回傳 error；R6.4 的過濾由呼叫端處理。
 */
export async function generateDistractors(
  request: DistractorRequest,
  { client, log = logAiCall, timeoutMs = defaultTimeoutMs() }: Deps = {},
): Promise<GenerateDistractorsResult> {
  const word = quizWord(request)
  const result = await callModel(request, word, client, timeoutMs)
  try {
    await log({
      kind: "distractors",
      input: word,
      success: result.status === "ok",
    })
  } catch (error) {
    // 紀錄失敗不影響出題
    console.error("failed to log AI call", error)
  }
  return result
}

async function callModel(
  request: DistractorRequest,
  word: string,
  client: AiClient | undefined,
  timeoutMs: number,
): Promise<GenerateDistractorsResult> {
  const response = await requestJson(
    {
      // mock 依題型產生不同語言的選項
      name: `distractors_${request.type}`,
      schema: DistractorsSchema,
      system: DISTRACTORS_SYSTEM_PROMPT,
      user: distractorsUserMessage({ ...request, word }),
      input: word,
    },
    { client, timeoutMs },
  )
  if (!response.ok) return { status: "error", reason: response.reason }

  const parsed = DistractorsSchema.safeParse(response.raw)
  if (!parsed.success) return { status: "error", reason: "format" }

  const options = parsed.data.options
  if (new Set(options.map(dedupeKey)).size !== options.length) {
    return { status: "error", reason: "format" }
  }
  return { status: "ok", options }
}
