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
  "type" | "prompt" | "pos" | "answer" | "synonyms" | "antonyms"
>

export type GenerateDistractorsResult =
  | { status: "ok"; options: string[] }
  | { status: "error"; reason: AiErrorReason }

type Deps = {
  client?: AiClient
  log?: (entry: AiCallLog) => Promise<void>
  timeoutMs?: number
}

/** The English word in the question: the correct answer for zh_to_word, the prompt for the other types. */
export function quizWord(request: DistractorRequest): string {
  return request.type === "zh_to_word" ? request.answer : request.prompt
}

/**
 * R6.5: generate 3 distractors with the AI (design §5.3).
 * Returns an error on timeout, API failure, invalid format, or duplicate options; the R6.4 filtering is up to the caller.
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
    // A logging failure does not affect building questions
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
      // The mock produces options in a different language per question type
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
