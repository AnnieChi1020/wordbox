import "server-only"

import { dedupeKey } from "@/lib/domain/normalize"

import type { AiClient } from "./client"
import aple from "./fixtures/aple.json"
import apple from "./fixtures/apple.json"
import giveUp from "./fixtures/give-up.json"
import malformed from "./fixtures/malformed.json"
import monday from "./fixtures/monday.json"
import ran from "./fixtures/ran.json"
import run from "./fixtures/run.json"

/** 觸發特殊情境的輸入（皆符合 R2.3，可從 UI 輸入）。 */
export const MOCK_TIMEOUT_INPUT = "mock timeout"
export const MOCK_MALFORMED_INPUT = "mock malformed"
/** 以這個字出題時，干擾選項生成失敗（R6.6） */
export const MOCK_DISTRACTOR_FAIL_INPUT = "mock distractor fail"

const WORD_FIXTURES: Record<string, unknown> = {
  apple,
  run,
  "give up": giveUp,
  aple,
  monday,
  ran,
  [MOCK_MALFORMED_INPUT]: malformed,
}

/** 沒有 fixture 的字一律視為有效，產生一個可辨識的通用條目，方便 E2E 大量新增。 */
function genericEntry(input: string) {
  const text = input.toLowerCase()
  return {
    is_valid: true,
    suggestions: [],
    headword: text,
    ipa: null,
    senses: [
      {
        pos: text.includes(" ") ? "phrase" : "noun",
        def_en: `mock definition of ${text}`,
        def_zh: `${text} 的中文解釋`,
        synonyms: [],
        antonyms: [],
        examples: [`This is an example with ${text}.`],
      },
    ],
  }
}

function waitForAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const abort = () => reject(signal.reason)
    if (signal.aborted) abort()
    else signal.addEventListener("abort", abort, { once: true })
  })
}

/** 可辨識、且不會與真實單字或中文解釋衝突的干擾選項（R6.4）。 */
const MOCK_DISTRACTORS: Record<string, string[]> = {
  distractors_word_to_zh: ["干擾選項甲", "干擾選項乙", "干擾選項丙"],
  distractors_word_to_synonym: ["decoy alpha", "decoy bravo", "decoy charlie"],
  distractors_word_to_antonym: ["decoy alpha", "decoy bravo", "decoy charlie"],
  distractors_zh_to_word: ["decoy alpha", "decoy bravo", "decoy charlie"],
}

export const mockClient: AiClient = {
  async completeJson({ name, input, signal }) {
    const key = dedupeKey(input)
    if (key === MOCK_TIMEOUT_INPUT) return waitForAbort(signal)
    if (name.startsWith("distractors_")) {
      if (key === MOCK_DISTRACTOR_FAIL_INPUT) return { options: [] }
      return { options: [...(MOCK_DISTRACTORS[name] ?? [])] }
    }
    return structuredClone(WORD_FIXTURES[key] ?? genericEntry(input))
  },
}
