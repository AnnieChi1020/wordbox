import { z } from "zod"

import { POS_VALUES } from "@/lib/domain/pos"

/** R4.3、R4.4：編輯單字內容的規則（前端與伺服器共用）。 */

const word = z.string().trim().min(1)

export const EditSenseSchema = z.object({
  /** 既有義項的 id；新增的義項沒有 id（design §4.3 update_word_content） */
  id: z.uuid().optional(),
  pos: z.enum(POS_VALUES, { error: "請選擇詞性" }),
  def_en: z.string().trim().min(1, "請輸入英文解釋").max(300, "英文解釋太長"),
  def_zh: z.string().trim().min(1, "請輸入中文解釋").max(100, "中文解釋太長"),
  synonyms: z.array(word.max(64)).max(5, "同義詞最多 5 個"),
  antonyms: z.array(word.max(64)).max(5, "反義詞最多 5 個"),
  examples: z.array(word.max(300)).max(2, "例句最多 2 句"),
})

export const EditWordSchema = z.object({
  ipa: z
    .string()
    .trim()
    .max(100, "音標太長")
    .nullable()
    .transform((v) => v || null),
  senses: z
    .array(EditSenseSchema)
    .min(1, "至少要有 1 個義項")
    .max(3, "最多 3 個義項"),
})

export type EditWordInput = z.input<typeof EditWordSchema>
export type EditWord = z.output<typeof EditWordSchema>

/** 以逗號（含全形、頓號）分隔的清單；去除空白與重複（不分大小寫）。 */
export function splitList(text: string): string[] {
  return dedupe(text.split(/[,，、]/))
}

/** 每行一句。 */
export function splitLines(text: string): string[] {
  return dedupe(text.split(/\r?\n/))
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>()
  return items
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter((s) => {
      const key = s.toLowerCase()
      if (!s || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

/** 驗證錯誤 → { "senses.0.def_zh": "請輸入中文解釋", ... } */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "form"
    errors[path] ??= issue.message
  }
  return errors
}
