import type { SupabaseClient } from "@supabase/supabase-js"

import type { Sense } from "@/lib/ai/schemas"
import type { PartOfSpeech } from "@/lib/domain/pos"
import type { ListParams, SortKey } from "@/lib/words/listParams"

import type { Database } from "./types"

export type Db = SupabaseClient<Database>

/** 使用者自己的單字中，不分大小寫相同的那一個（R2.4）。RLS 限定只查得到自己的字。 */
export async function findWordIdByText(
  db: Db,
  text: string,
): Promise<string | null> {
  const { data, error } = await db
    .from("words")
    .select("id")
    .eq("text_key", text.toLowerCase())
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

export type WordListItem = {
  id: string
  text: string
  box: number
  is_important: boolean
  senses: { pos: PartOfSpeech }[]
}

/** 排序欄位；同值時依新增日期新→舊（R3.3），最後以 id 確保順序穩定。 */
const SORT_COLUMNS: Record<SortKey, [column: string, ascending: boolean][]> = {
  created_desc: [["created_at", false]],
  created_asc: [["created_at", true]],
  alpha_asc: [["text_key", true]],
  alpha_desc: [["text_key", false]],
  stars_asc: [
    ["box", true],
    ["created_at", false],
  ],
  stars_desc: [
    ["box", false],
    ["created_at", false],
  ],
}

/** 列表每次載入的筆數（NFR4：控制傳輸量與渲染量）。 */
export const WORDS_PAGE_SIZE = 100

/** R3.1–R3.3：列表查詢；篩選、排序與分頁在資料庫端完成（design §6、D11）。 */
export async function listWords(
  db: Db,
  params: ListParams,
  {
    offset = 0,
    limit = WORDS_PAGE_SIZE,
  }: { offset?: number; limit?: number } = {},
): Promise<{ words: WordListItem[]; total: number }> {
  let query = db
    .from("words")
    .select("id, text, box, is_important, senses(pos)", { count: "exact" })
    .order("position", { referencedTable: "senses" })

  if (params.stars.length > 0) query = query.in("box", params.stars)
  if (params.importantOnly) query = query.eq("is_important", true)
  for (const [column, ascending] of SORT_COLUMNS[params.sort]) {
    query = query.order(column, { ascending })
  }

  // 排序最後以 id 決定，分頁不會重複或遺漏
  const { data, count, error } = await query
    .order("id")
    .range(offset, offset + limit - 1)
  if (error) throw error
  return { words: data, total: count ?? 0 }
}

/** 使用者是否有任何單字（區分 R3.7 空狀態與 R3.8 篩選無結果）。 */
export async function hasAnyWord(db: Db): Promise<boolean> {
  const { count, error } = await db
    .from("words")
    .select("id", { count: "exact", head: true })
  if (error) throw error
  return (count ?? 0) > 0
}
