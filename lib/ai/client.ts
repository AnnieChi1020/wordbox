import "server-only"

import type { z } from "zod"

export type JsonRequest = {
  /** structured output 的 schema 名稱，也用來挑選 mock fixture */
  name: string
  schema: z.ZodType
  system: string
  user: string
  /** 使用者原始輸入；mock 依此挑選 fixture */
  input: string
  signal: AbortSignal
}

/** 回傳模型產生的原始 JSON；驗證由呼叫端以 Zod 處理。 */
export interface AiClient {
  completeJson(request: JsonRequest): Promise<unknown>
}

/** NFR6：AI_MOCK=1 時使用 fixtures，不呼叫 OpenAI。 */
export async function getAiClient(): Promise<AiClient> {
  if (process.env.AI_MOCK === "1") {
    const { mockClient } = await import("./mock")
    return mockClient
  }
  const { createOpenAiClient } = await import("./openai")
  return createOpenAiClient()
}
