import { z } from "zod"

import { POS_VALUES } from "@/lib/domain/pos"

/** design §5.1。OpenAI strict structured outputs 要求欄位全部必填，選填以 null 表示。 */
export const SenseSchema = z.object({
  pos: z.enum(POS_VALUES),
  def_en: z.string().trim().min(1),
  def_zh: z.string().trim().min(1),
  synonyms: z.array(z.string().trim().min(1)).max(5),
  antonyms: z.array(z.string().trim().min(1)).max(5),
  examples: z.array(z.string().trim().min(1)).min(1).max(2),
})

export const GenerateWordSchema = z.object({
  is_valid: z.boolean(),
  suggestions: z.array(z.string()).max(3), // is_valid=false 時使用
  headword: z.string().nullable(), // 字典標準寫法；is_valid=false 時為 null（R2.7）
  ipa: z.string().nullable(),
  senses: z.array(SenseSchema).max(3), // is_valid=true 時 1–3 個
})

export type Sense = z.infer<typeof SenseSchema>
export type GenerateWordOutput = z.infer<typeof GenerateWordSchema>

/** design §5.3：干擾選項，一律 3 個。 */
export const DistractorsSchema = z.object({
  options: z.array(z.string().trim().min(1)).length(3),
})
