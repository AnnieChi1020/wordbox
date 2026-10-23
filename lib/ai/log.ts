import "server-only"

import { createClient } from "@/lib/db/server"

export type AiCallKind = "generate" | "regenerate" | "distractors"

export type AiCallLog = { kind: AiCallKind; input: string; success: boolean }

/** R2.12: log every AI call; user_id defaults to auth.uid() in the database. */
export async function logAiCall(entry: AiCallLog): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("ai_generation_logs").insert(entry)
  if (error) throw error
}
