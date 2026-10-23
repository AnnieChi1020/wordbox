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

/** Inputs that trigger special cases (all satisfy R2.3, so they can be typed in the UI). */
export const MOCK_TIMEOUT_INPUT = "mock timeout"
export const MOCK_MALFORMED_INPUT = "mock malformed"
/** Building a question for this word makes distractor generation fail (R6.6) */
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

/** Words without a fixture are always valid and get a recognizable generic entry, so E2E tests can add many words. */
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

/** Recognizable distractors that never collide with real words or Chinese definitions (R6.4). */
const MOCK_DISTRACTORS: Record<string, string[]> = {
  distractors_word_to_zh: ["干擾選項甲", "干擾選項乙", "干擾選項丙"],
  distractors_word_to_synonym: ["decoy alpha", "decoy bravo", "decoy charlie"],
  distractors_word_to_antonym: ["decoy alpha", "decoy bravo", "decoy charlie"],
  distractors_zh_to_word: ["decoy alpha", "decoy bravo", "decoy charlie"],
  distractors_cloze: ["decoy alpha", "decoy bravo", "decoy charlie"],
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
