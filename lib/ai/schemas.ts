import { z } from "zod"

import { POS_VALUES } from "@/lib/domain/pos"

/** design §5.1. OpenAI strict structured outputs require every field, so optional fields use null. */
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
  suggestions: z.array(z.string()).max(3), // used when is_valid=false
  headword: z.string().nullable(), // dictionary headword spelling; null when is_valid=false (R2.7)
  ipa: z.string().nullable(),
  senses: z.array(SenseSchema).max(3), // 1–3 when is_valid=true
})

export type Sense = z.infer<typeof SenseSchema>
export type GenerateWordOutput = z.infer<typeof GenerateWordSchema>

/** design §5.3: distractors, always 3. */
export const DistractorsSchema = z.object({
  options: z.array(z.string().trim().min(1)).length(3),
})
