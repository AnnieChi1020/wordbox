import "server-only"

import { getAiClient, type AiClient, type JsonRequest } from "./client"

/** R2.10：20 秒逾時；AI_TIMEOUT_MS 只供 E2E 縮短等待時間。 */
export const AI_TIMEOUT_MS = 20_000

export function defaultTimeoutMs() {
  const fromEnv = Number(process.env.AI_TIMEOUT_MS)
  return Number.isInteger(fromEnv) && fromEnv > 0 ? fromEnv : AI_TIMEOUT_MS
}

export type AiErrorReason = "timeout" | "format" | "api"

/**
 * 呼叫模型並取得原始 JSON（design §5.4）：逾時以 AbortController 中斷，不自動重試。
 * 驗證由呼叫端以 Zod 處理。
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
    // JSON.parse 失敗代表輸出不完整（拒答、截斷）
    if (error instanceof SyntaxError) return { ok: false, reason: "format" }
    console.error("AI request failed", error)
    return { ok: false, reason: "api" }
  } finally {
    clearTimeout(timer)
  }
}
