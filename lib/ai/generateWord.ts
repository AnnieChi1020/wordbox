import "server-only"

import { dedupeKey, isValidInput, normalizeInput } from "@/lib/domain/normalize"

import { getAiClient, type AiClient } from "./client"
import { logAiCall, type AiCallLog } from "./log"
import { GENERATE_WORD_SYSTEM_PROMPT, generateWordUserMessage } from "./prompts"
import { GenerateWordSchema, type Sense } from "./schemas"

/** R2.10：20 秒逾時；AI_TIMEOUT_MS 只供 E2E 縮短等待時間。 */
export const AI_TIMEOUT_MS = 20_000

function defaultTimeoutMs() {
  const fromEnv = Number(process.env.AI_TIMEOUT_MS)
  return Number.isInteger(fromEnv) && fromEnv > 0 ? fromEnv : AI_TIMEOUT_MS
}

export type GenerateWordResult =
  | { status: "valid"; ipa: string | null; senses: Sense[] }
  | { status: "invalid"; suggestions: string[] }
  | { status: "error"; reason: "timeout" | "format" | "api" }

type Deps = {
  kind?: "generate" | "regenerate"
  client?: AiClient
  log?: (entry: AiCallLog) => Promise<void>
  timeoutMs?: number
}

/**
 * R2.5–R2.7、R2.10、R4.5：以 AI 驗證並生成單字內容。
 * 逾時、API 失敗或格式不符時回傳 error，不自動重試（design §5.4）。
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
    // 紀錄失敗不影響使用者操作
    console.error("failed to log AI call", error)
  }
  return result
}

async function callModel(
  input: string,
  client: AiClient | undefined,
  timeoutMs: number,
): Promise<GenerateWordResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let raw: unknown
  try {
    raw = await (client ?? (await getAiClient())).completeJson({
      name: "word_entry",
      schema: GenerateWordSchema,
      system: GENERATE_WORD_SYSTEM_PROMPT,
      user: generateWordUserMessage(input),
      input,
      signal: controller.signal,
    })
  } catch (error) {
    if (controller.signal.aborted) return { status: "error", reason: "timeout" }
    // JSON.parse 失敗代表輸出不完整（拒答、截斷）
    if (error instanceof SyntaxError)
      return { status: "error", reason: "format" }
    console.error("AI request failed", error)
    return { status: "error", reason: "api" }
  } finally {
    clearTimeout(timer)
  }

  const parsed = GenerateWordSchema.safeParse(raw)
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
    ipa: output.ipa?.trim() || null,
    senses: output.senses.map((sense) => cleanSense(sense, input)),
  }
}

/** 建議必須是可直接重新送出的有效輸入（R2.6），去除重複與原輸入本身。 */
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

/** 同義詞與反義詞不分大小寫去除重複，並排除單字本身。 */
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
