import type { SupabaseClient } from "@supabase/supabase-js"

import type { Sense } from "@/lib/ai/schemas"

import type { Database } from "./types"

export type Db = SupabaseClient<Database>

/** 使用者自己的單字中，不分大小寫相同的那一個（R2.4）。RLS 限定只查得到自己的字。 */
export async function findWordIdByText(
  db: Db,
  text: string,
): Promise<string | null> {
  // ilike 的萬用字元需要跳脫；輸入已通過 R2.3，只可能含字母、空白、-、'
  const pattern = text.replace(/[\\%_]/g, "\\$&")
  const { data, error } = await db
    .from("words")
    .select("id")
    .ilike("text", pattern)
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

export async function getProfileTimezone(db: Db): Promise<string | null> {
  const { data, error } = await db
    .from("profiles")
    .select("timezone")
    .maybeSingle()
  if (error) throw error
  return data?.timezone ?? null
}

/** create_word RPC；唯一索引衝突時回傳既有的字（design §4.3）。 */
export async function createWord(
  db: Db,
  word: { text: string; ipa: string | null; senses: Sense[]; today: string },
): Promise<{ id: string; existed: boolean }> {
  const { data, error } = await db.rpc("create_word", {
    p_text: word.text,
    p_ipa: word.ipa as string, // RPC 參數接受 null；產生的型別未標示
    p_senses: word.senses,
    p_today: word.today,
  })
  if (error) throw error
  return data as { id: string; existed: boolean }
}
