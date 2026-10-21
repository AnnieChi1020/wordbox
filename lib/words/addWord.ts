import type { GenerateWordResult } from "@/lib/ai/generateWord"
import {
  createWord,
  findWordIdByText,
  getProfile,
  type Db,
} from "@/lib/db/words"
import { localToday } from "@/lib/domain/dates"
import {
  INPUT_FORMAT_MESSAGE,
  isValidInput,
  normalizeInput,
} from "@/lib/domain/normalize"

export type AddWordResult =
  | { status: "exists"; wordId: string }
  | { status: "invalid"; suggestions: string[] }
  | { status: "created"; wordId: string }
  | { status: "error"; message: string }

export const ADD_WORD_MESSAGES = {
  format: INPUT_FORMAT_MESSAGE,
  unauthenticated: "登入已過期，請重新登入",
  aiTimeout: "AI 回應逾時，請重試",
  aiFormat: "AI 回傳的內容有誤，請重試",
  aiApi: "AI 服務暫時無法使用，請重試",
  save: "儲存失敗，請重試",
} as const

export type AddWordDeps = {
  db: Db
  generate: (input: string) => Promise<GenerateWordResult>
  now?: Date
}

/** design §6 addWord：正規化 → 查重 → AI → create_word（R2.2–R2.8）。 */
export async function addWordWith(
  { db, generate, now = new Date() }: AddWordDeps,
  rawInput: string,
): Promise<AddWordResult> {
  // 1. R2.2、R2.3（前端已檢查，這裡不信任 client）
  const text = normalizeInput(rawInput)
  if (!isValidInput(text)) {
    return { status: "error", message: ADD_WORD_MESSAGES.format }
  }

  const { data: auth } = await db.auth.getClaims()
  if (!auth?.claims.sub) {
    return { status: "error", message: ADD_WORD_MESSAGES.unauthenticated }
  }

  try {
    // JWT 可能仍有效但使用者已不存在（帳號刪除、本地 db reset）；在呼叫 AI 前擋下
    const profile = await getProfile(db)
    if (!profile) {
      return { status: "error", message: ADD_WORD_MESSAGES.unauthenticated }
    }

    // 2. R2.4：已有相同的字就不呼叫 AI
    const existingId = await findWordIdByText(db, text)
    if (existingId) return { status: "exists", wordId: existingId }

    // 3. R2.5、R2.6、R2.10
    const generated = await generate(text)
    if (generated.status === "invalid") {
      return { status: "invalid", suggestions: generated.suggestions }
    }
    if (generated.status === "error") {
      const message = {
        timeout: ADD_WORD_MESSAGES.aiTimeout,
        format: ADD_WORD_MESSAGES.aiFormat,
        api: ADD_WORD_MESSAGES.aiApi,
      }[generated.reason]
      return { status: "error", message }
    }

    // 4. R2.7、R2.8：box、is_important 由資料庫預設；next_due_on = 當地今天
    const today = localToday(profile.timezone, now)
    const { id, existed } = await createWord(db, {
      text,
      ipa: generated.ipa,
      senses: generated.senses,
      today,
    })
    // AI 生成期間另一個請求已新增同一個字（唯一索引衝突）
    return existed
      ? { status: "exists", wordId: id }
      : { status: "created", wordId: id }
  } catch (error) {
    console.error("addWord failed", error)
    return { status: "error", message: ADD_WORD_MESSAGES.save }
  }
}
