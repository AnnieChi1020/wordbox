import "server-only"

import { createClient } from "@/lib/db/server"

export type AiCallKind = "generate" | "regenerate" | "distractors"

export type AiCallLog = { kind: AiCallKind; input: string; success: boolean }

/** R2.12：記錄每次 AI 呼叫；user_id 由資料庫預設為 auth.uid()。 */
export async function logAiCall(entry: AiCallLog): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("ai_generation_logs").insert(entry)
  if (error) throw error
}
