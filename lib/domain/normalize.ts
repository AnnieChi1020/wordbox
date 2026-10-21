/** R2.3：1–64 字元，以英文字母開頭，只包含英文字母、空白、連字號、撇號。 */
const INPUT_PATTERN = /^[A-Za-z][A-Za-z '\-]{0,63}$/

/** R2.3 不符合時顯示的訊息（前端與伺服器共用）。 */
export const INPUT_FORMAT_MESSAGE =
  "請輸入英文單字或片語：以英文字母開頭，只能包含英文字母、空白、連字號（-）與撇號（'），最多 64 個字元"

/** R2.2：去除前後空白、連續空白合併為一個。 */
export function normalizeInput(raw: string): string {
  return raw.trim().replace(/\s+/g, " ")
}

/** 檢查已正規化的輸入是否符合 R2.3。 */
export function isValidInput(s: string): boolean {
  return INPUT_PATTERN.test(s)
}

/** 查重用的 key（R2.4，不分大小寫）；與資料庫的 lower(text) 一致。 */
export function dedupeKey(s: string): string {
  return normalizeInput(s).toLowerCase()
}

/**
 * R2.7：儲存用的字典標準寫法。AI 的 headword 只能改變大小寫；
 * 拼字、詞形或空白不同（例如 ran → run）或格式無效時，改用輸入的全小寫。
 */
export function canonicalText(input: string, headword: string | null): string {
  const fallback = normalizeInput(input).toLowerCase()
  if (headword === null) return fallback
  const candidate = normalizeInput(headword)
  return isValidInput(candidate) && candidate.toLowerCase() === fallback
    ? candidate
    : fallback
}
