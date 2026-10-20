/** R2.3：1–64 字元，以英文字母開頭，只包含英文字母、空白、連字號、撇號。 */
const INPUT_PATTERN = /^[A-Za-z][A-Za-z '\-]{0,63}$/

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
