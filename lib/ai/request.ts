import "server-only"

import { getAiClient, type AiClient, type JsonRequest } from "./client"

/** R2.10: 20-second timeout; AI_TIMEOUT_MS exists only to shorten waits in E2E tests. */
export const AI_TIMEOUT_MS = 20_000

export function defaultTimeoutMs() {
  const fromEnv = Number(process.env.AI_TIMEOUT_MS)
  return Number.isInteger(fromEnv) && fromEnv > 0 ? fromEnv : AI_TIMEOUT_MS
}

export type AiErrorReason = "timeout" | "format" | "api"

/**
 * Calls the model and returns the raw JSON (design §5.4): a timeout aborts through AbortController, with no automatic retry.
 * The caller validates the result with Zod.
 */
export async function requestJson(
  request: Omit<JsonRequest, "signal">,
  { client, timeoutMs }: { client?: AiClient; timeoutMs: number },
): Promise<{ ok: true; raw: unknown } | { ok: false; reason: AiErrorReason }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const raw = await (client ?? (await getAiClient())).completeJson({
      ...request,
      signal: controller.signal,
    })
    return { ok: true, raw }
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, reason: "timeout" }
    // A JSON.parse failure means the output is incomplete (refusal, truncation)
    if (error instanceof SyntaxError) return { ok: false, reason: "format" }
    console.error("AI request failed", error)
    return { ok: false, reason: "api" }
  } finally {
    clearTimeout(timer)
  }
}
