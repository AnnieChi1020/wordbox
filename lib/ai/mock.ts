import "server-only"

import { dedupeKey } from "@/lib/domain/normalize"

import type { AiClient } from "./client"
import aple from "./fixtures/aple.json"
import apple from "./fixtures/apple.json"
import giveUp from "./fixtures/give-up.json"
import malformed from "./fixtures/malformed.json"
import run from "./fixtures/run.json"

/** 觸發特殊情境的輸入（皆符合 R2.3，可從 UI 輸入）。 */
export const MOCK_TIMEOUT_INPUT = "mock timeout"
export const MOCK_MALFORMED_INPUT = "mock malformed"

const WORD_FIXTURES: Record<string, unknown> = {
  apple,
  run,
  "give up": giveUp,
  aple,
  [MOCK_MALFORMED_INPUT]: malformed,
}

/** 沒有 fixture 的字一律視為有效，產生一個可辨識的通用條目，方便 E2E 大量新增。 */
function genericEntry(input: string) {
  const text = input.toLowerCase()
  return {
    is_valid: true,
    suggestions: [],
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

export const mockClient: AiClient = {
  async completeJson({ input, signal }) {
    const key = dedupeKey(input)
    if (key === MOCK_TIMEOUT_INPUT) return waitForAbort(signal)
    return structuredClone(WORD_FIXTURES[key] ?? genericEntry(input))
  },
}
