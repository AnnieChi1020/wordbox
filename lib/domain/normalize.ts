/** R2.3: 1–64 characters, starting with an English letter, containing only English letters, spaces, hyphens, and apostrophes. */
const INPUT_PATTERN = /^[A-Za-z][A-Za-z '\-]{0,63}$/

/** The message shown when R2.3 fails (shared by the UI and the server). */
export const INPUT_FORMAT_MESSAGE =
  "請輸入英文單字或片語：以英文字母開頭，只能包含英文字母、空白、連字號（-）與撇號（'），最多 64 個字元"

/** R2.2: trim leading and trailing whitespace and collapse runs of whitespace into one. */
export function normalizeInput(raw: string): string {
  return raw.trim().replace(/\s+/g, " ")
}

/** Checks whether normalized input satisfies R2.3. */
export function isValidInput(s: string): boolean {
  return INPUT_PATTERN.test(s)
}

/** Key for duplicate checks (R2.4, case-insensitive); matches lower(text) in the database. */
export function dedupeKey(s: string): string {
  return normalizeInput(s).toLowerCase()
}

/**
 * R2.7: the dictionary headword spelling to store. The AI's headword may change only letter case;
 * if spelling, inflection, or spacing differ (e.g. ran → run) or the format is invalid, the input in lowercase is used instead.
 */
export function canonicalText(input: string, headword: string | null): string {
  const fallback = normalizeInput(input).toLowerCase()
  if (headword === null) return fallback
  const candidate = normalizeInput(headword)
  return isValidInput(candidate) && candidate.toLowerCase() === fallback
    ? candidate
    : fallback
}
