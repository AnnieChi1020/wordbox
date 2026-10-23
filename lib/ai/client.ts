import "server-only"

import type { z } from "zod"

export type JsonRequest = {
  /** Schema name for structured output, also used to pick the mock fixture */
  name: string
  schema: z.ZodType
  system: string
  user: string
  /** The user's original input; the mock picks a fixture by it */
  input: string
  signal: AbortSignal
}

/** Returns the raw JSON produced by the model; the caller validates it with Zod. */
export interface AiClient {
  completeJson(request: JsonRequest): Promise<unknown>
}

/** NFR6: with AI_MOCK=1, use fixtures instead of calling OpenAI. */
export async function getAiClient(): Promise<AiClient> {
  if (process.env.AI_MOCK === "1") {
    const { mockClient } = await import("./mock")
    return mockClient
  }
  const { createOpenAiClient } = await import("./openai")
  return createOpenAiClient()
}
