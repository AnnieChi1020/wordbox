import "server-only"

import {
  canonicalText,
  dedupeKey,
  isValidInput,
  normalizeInput,
} from "@/lib/domain/normalize"

import type { AiClient } from "./client"
import { logAiCall, type AiCallLog } from "./log"
import { GENERATE_WORD_SYSTEM_PROMPT, generateWordUserMessage } from "./prompts"
import { defaultTimeoutMs, requestJson, type AiErrorReason } from "./request"
import { GenerateWordSchema, type Sense } from "./schemas"

export type GenerateWordResult =
  | { status: "valid"; text: string; ipa: string | null; senses: Sense[] }
  | { status: "invalid"; suggestions: string[] }
  | { status: "error"; reason: AiErrorReason }

type Deps = {
  kind?: "generate" | "regenerate"
  client?: AiClient
  log?: (entry: AiCallLog) => Promise<void>
  timeoutMs?: number
}

/**
 * R2.5–R2.7, R2.10, R4.5: validate a word and generate its content with the AI.
 * Returns an error on timeout, API failure, or invalid format, without retrying automatically (design §5.4).
 */
export async function generateWord(
  input: string,
  {
    kind = "generate",
    client,
    log = logAiCall,
    timeoutMs = defaultTimeoutMs(),
  }: Deps = {},
): Promise<GenerateWordResult> {
  const result = await callModel(input, client, timeoutMs)
  try {
    await log({ kind, input, success: result.status !== "error" })
  } catch (error) {
    // A logging failure does not affect the user's action
    console.error("failed to log AI call", error)
  }
  return result
}

async function callModel(
  input: string,
  client: AiClient | undefined,
  timeoutMs: number,
): Promise<GenerateWordResult> {
  const response = await requestJson(
    {
      name: "word_entry",
      schema: GenerateWordSchema,
      system: GENERATE_WORD_SYSTEM_PROMPT,
      // Always ask in lowercase so the result does not depend on the user's casing (e.g. Apple being treated as a proper noun)
      user: generateWordUserMessage(input.toLowerCase()),
      input,
    },
    { client, timeoutMs },
  )
  if (!response.ok) return { status: "error", reason: response.reason }

  const parsed = GenerateWordSchema.safeParse(response.raw)
  if (!parsed.success) return { status: "error", reason: "format" }

  const output = parsed.data
  if (!output.is_valid) {
    return {
      status: "invalid",
      suggestions: cleanSuggestions(output.suggestions, input),
    }
  }
  if (output.senses.length === 0) return { status: "error", reason: "format" }

  return {
    status: "valid",
    text: canonicalText(input, output.headword),
    ipa: output.ipa?.trim() || null,
    senses: output.senses.map((sense) => cleanSense(sense, input)),
  }
}

/** Suggestions must be valid inputs that can be resubmitted directly (R2.6), with duplicates and the original input removed. */
function cleanSuggestions(suggestions: string[], input: string): string[] {
  const seen = new Set([dedupeKey(input)])
  const result: string[] = []
  for (const s of suggestions.map(normalizeInput)) {
    const key = dedupeKey(s)
    if (!isValidInput(s) || seen.has(key)) continue
    seen.add(key)
    result.push(s)
  }
  return result.slice(0, 3)
}

/** Deduplicate synonyms and antonyms case-insensitively and drop the word itself. */
function cleanSense(sense: Sense, input: string): Sense {
  const self = dedupeKey(input)
  const uniqueWords = (words: string[]) => {
    const seen = new Set([self])
    return words.filter((w) => {
      const key = dedupeKey(w)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  return {
    ...sense,
    synonyms: uniqueWords(sense.synonyms),
    antonyms: uniqueWords(sense.antonyms),
  }
}
