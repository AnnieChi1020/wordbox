import "server-only"

import OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"

import type { AiClient } from "./client"

/** NFR3: the API key is read only on the server. */
export function createOpenAiClient(): AiClient {
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL
  if (!apiKey || !model) {
    throw new Error("OPENAI_API_KEY and OPENAI_MODEL must be set")
  }
  // No automatic retry; the user retries manually (design §5.4)
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
      // When the model refuses or is cut off, output_text is not complete JSON; the caller treats it as an invalid format
      return JSON.parse(response.output_text)
    },
  }
}
