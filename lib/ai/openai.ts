import "server-only"

import OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"

import type { AiClient } from "./client"

/** NFR3：API key 只在伺服器端讀取。 */
export function createOpenAiClient(): AiClient {
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL
  if (!apiKey || !model) {
    throw new Error("OPENAI_API_KEY and OPENAI_MODEL must be set")
  }
  // 不自動重試，由使用者手動重試（design §5.4）
  const openai = new OpenAI({ apiKey, maxRetries: 0 })

  return {
    async completeJson({ name, schema, system, user, signal }) {
      const response = await openai.responses.create(
        {
          model,
          input: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          text: { format: zodTextFormat(schema, name) },
        },
        { signal },
      )
      // 拒答或被截斷時 output_text 不是完整 JSON，交給呼叫端視為格式錯誤
      return JSON.parse(response.output_text)
    },
  }
}
