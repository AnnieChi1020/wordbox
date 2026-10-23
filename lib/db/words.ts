import type { SupabaseClient } from "@supabase/supabase-js"

import type { Sense } from "@/lib/ai/schemas"
import type { PartOfSpeech } from "@/lib/domain/pos"
import {
  likePattern,
  type ListParams,
  type SortKey,
} from "@/lib/words/listParams"

import type { Database } from "./types"

export type Db = SupabaseClient<Database>

/** The user's own word that matches case-insensitively (R2.4). RLS limits the query to the user's own words. */
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

/** The current user's profile; null when the session is valid but the user has been deleted. */
export async function getProfile(
  db: Db,
): Promise<{ timezone: string | null } | null> {
  const { data, error } = await db
    .from("profiles")
    .select("timezone")
    .maybeSingle()
  if (error) throw error
  return data
}

/** create_word RPC; returns the existing word on a unique index conflict (design §4.3). */
export async function createWord(
  db: Db,
  word: { text: string; ipa: string | null; senses: Sense[]; today: string },
): Promise<{ id: string; existed: boolean }> {
  const { data, error } = await db.rpc("create_word", {
    p_text: word.text,
    p_ipa: word.ipa as string, // the RPC parameter accepts null; the generated type does not say so
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

/** Sort columns; ties are ordered by date added, newest first (R3.3), and finally by id for a stable order. */
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

/** Rows per list load (NFR4: limits how much is sent and rendered). */
export const WORDS_PAGE_SIZE = 100

/** R3.1–R3.3: the list query; filtering, sorting, and pagination happen in the database (design §6, D11). */
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

  if (params.q) query = query.ilike("text_key", likePattern(params.q))
  if (params.stars.length > 0) query = query.in("box", params.stars)
  if (params.importantOnly) query = query.eq("is_important", true)
  for (const [column, ascending] of SORT_COLUMNS[params.sort]) {
    query = query.order(column, { ascending })
  }

  // The sort ends with id, so pages never repeat or skip rows
  const { data, count, error } = await query
    .order("id")
    .range(offset, offset + limit - 1)
  if (error) throw error
  return { words: data, total: count ?? 0 }
}

/** Whether the user has any words (tells the R3.7 empty state apart from R3.8 no filter results). */
export async function hasAnyWord(db: Db): Promise<boolean> {
  const { count, error } = await db
    .from("words")
    .select("id", { count: "exact", head: true })
  if (error) throw error
  return (count ?? 0) > 0
}

/** R3.5: set important; returns whether a row was updated (false for another user's word or a missing one). */
export async function setWordImportant(
  db: Db,
  wordId: string,
  value: boolean,
): Promise<boolean> {
  const { data, error } = await db
    .from("words")
    .update({ is_important: value })
    .eq("id", wordId)
    .select("id")
  if (error) throw error
  return data.length > 0
}

export type WordDetail = {
  id: string
  text: string
  ipa: string | null
  box: number
  is_important: boolean
  senses: {
    id: string
    position: number
    pos: PartOfSpeech
    def_en: string
    def_zh: string
    synonyms: string[]
    antonyms: string[]
    examples: string[]
  }[]
}

/** R4.1: the full content shown in the popup; null for another user's word or a missing one. */
export async function getWordDetail(
  db: Db,
  wordId: string,
): Promise<WordDetail | null> {
  const { data, error } = await db
    .from("words")
    .select(
      "id, text, ipa, box, is_important, senses(id, position, pos, def_en, def_zh, synonyms, antonyms, examples)",
    )
    .eq("id", wordId)
    .order("position", { referencedTable: "senses" })
    .maybeSingle()
  if (error) throw error
  return data
}

/** update_word_content RPC (R4.3, design §4.3); returns false when the word is not found. */
export async function updateWordContent(
  db: Db,
  wordId: string,
  content: { ipa: string | null; senses: (Sense & { id?: string })[] },
): Promise<boolean> {
  const { error } = await db.rpc("update_word_content", {
    p_word_id: wordId,
    p_ipa: content.ipa as string, // the RPC parameter accepts null; the generated type does not say so
    p_senses: content.senses,
  })
  if (error?.code === "P0002") return false // word not found / sense does not belong to this word
  if (error) throw error
  return true
}

/** replace_word_content RPC (R4.5); returns false when the word is not found. */
export async function replaceWordContent(
  db: Db,
  wordId: string,
  content: { ipa: string | null; senses: Sense[] },
): Promise<boolean> {
  const { error } = await db.rpc("replace_word_content", {
    p_word_id: wordId,
    p_ipa: content.ipa as string, // the RPC parameter accepts null; the generated type does not say so
    p_senses: content.senses,
  })
  if (error?.code === "P0002") return false
  if (error) throw error
  return true
}

/** R4.7: delete a word (its senses cascade); returns whether anything was deleted. */
export async function deleteWordById(db: Db, wordId: string): Promise<boolean> {
  const { data, error } = await db
    .from("words")
    .delete()
    .eq("id", wordId)
    .select("id")
  if (error) throw error
  return data.length > 0
}
