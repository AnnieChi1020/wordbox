import { dedupeKey } from "./normalize"
import type { PartOfSpeech } from "./pos"
import { pick, shuffle, type Rng } from "./random"

export const QUESTION_TYPES = [
  "word_to_zh",
  "word_to_synonym",
  "word_to_antonym",
  "zh_to_word",
  "cloze",
] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

/** The blank that replaces the word in a cloze prompt (design §8). */
export const CLOZE_BLANK = "___"

/** Number of distractors per question (R6.2). */
export const DISTRACTOR_COUNT = 3

export type QuestionSense = {
  id: string
  pos: PartOfSpeech
  def_zh: string
  synonyms: string[]
  antonyms: string[]
  examples: string[]
}

export type QuestionWord = { id: string; text: string; senses: QuestionSense[] }

/** A complete question; `answer` stays on the server and is removed before sending to the client (D15). */
export type Question = {
  type: QuestionType
  wordId: string
  senseId: string
  prompt: string
  pos: PartOfSpeech
  answer: string
  options: string[]
}

/** A draft for when the user's words yield too few candidates, completed by the AI or the cache (R6.5). */
export type QuestionDraft = Omit<Question, "options"> & {
  /** The quiz word's synonyms (all senses), given to the AI to avoid */
  synonyms: string[]
  /** The quiz word's antonyms (all senses), given to the AI to avoid for word_to_antonym */
  antonyms: string[]
  distractors: string[]
  missing: number
  /** Options excluded by R6.4, compared by dedupeKey */
  excluded: ReadonlySet<string>
}

export function isQuestionType(value: unknown): value is QuestionType {
  return QUESTION_TYPES.includes(value as QuestionType)
}

/**
 * R6.1: no word_to_synonym for a sense without synonyms, no word_to_antonym for one without antonyms,
 * and no cloze without an example that contains the word.
 */
export function availableTypes(
  word: Pick<QuestionWord, "text">,
  sense: QuestionSense,
): QuestionType[] {
  return QUESTION_TYPES.filter((type) => {
    if (type === "word_to_synonym") return sense.synonyms.length > 0
    if (type === "word_to_antonym") return sense.antonyms.length > 0
    if (type === "cloze") return clozeExamples(word.text, sense).length > 0
    return true
  })
}

/**
 * R6.1, D27: replaces every whole-word, case-insensitive occurrence of text in the example with CLOZE_BLANK.
 * Spaces inside a phrase match any run of whitespace. Returns null when the word does not occur in exactly this form.
 */
export function clozeSentence(example: string, text: string): string | null {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return null
  const body = words
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+")
  // Letters or hyphens on either side mean the match is part of another word (run in running, well-known)
  const pattern = new RegExp(`(?<![A-Za-z-])${body}(?![A-Za-z-])`, "gi")
  const blanked = example.replace(pattern, CLOZE_BLANK)
  return blanked === example ? null : blanked
}

function clozeExamples(text: string, sense: QuestionSense): string[] {
  return sense.examples
    .map((example) => clozeSentence(example, text))
    .filter((s) => s !== null)
}

/**
 * R6.1–R6.4: build a question from the user's words (design §7.5).
 * Returns a complete question when there are enough candidates; otherwise returns a draft with the partial candidates found, for completeQuestion to fill in.
 */
export function buildQuestion(
  target: QuestionWord,
  sense: QuestionSense,
  type: QuestionType,
  pool: readonly QuestionWord[],
  rng: Rng,
): { question: Question } | { needsAi: QuestionDraft } {
  const others = pool.filter((w) => w.id !== target.id)
  const answer = correctAnswer(target, sense, type, rng)
  const prompt = questionPrompt(target, sense, type, rng)
  const excluded = exclusions(target, sense, type, answer, others)

  const candidates = shuffle(libraryCandidates(type, others), rng)
    // Stable sort: same part of speech first, everything else keeps its random order (R6.3)
    .sort((a, b) => Number(b.pos.has(sense.pos)) - Number(a.pos.has(sense.pos)))
    .map((c) => c.text)
  const distractors = filterDistractors(candidates, excluded).slice(
    0,
    DISTRACTOR_COUNT,
  )

  const draft: QuestionDraft = {
    type,
    wordId: target.id,
    senseId: sense.id,
    prompt,
    pos: sense.pos,
    answer,
    synonyms: target.senses.flatMap((s) => s.synonyms),
    antonyms: target.senses.flatMap((s) => s.antonyms),
    distractors,
    missing: DISTRACTOR_COUNT - distractors.length,
    excluded,
  }
  if (draft.missing > 0) return { needsAi: draft }
  return { question: toQuestion(draft, distractors, rng) }
}

/**
 * Completes a draft with cached or AI options; returns null if it is still short after filtering (R6.6).
 */
export function completeQuestion(
  draft: QuestionDraft,
  extra: readonly string[],
  rng: Rng,
): Question | null {
  const distractors = filterDistractors(
    [...draft.distractors, ...extra],
    draft.excluded,
  ).slice(0, DISTRACTOR_COUNT)
  if (distractors.length < DISTRACTOR_COUNT) return null
  return toQuestion(draft, distractors, rng)
}

/** R6.4: drops blanks, duplicates (case-insensitive), and excluded options, keeping the order. */
export function filterDistractors(
  candidates: readonly string[],
  excluded: ReadonlySet<string>,
): string[] {
  const seen = new Set(excluded)
  const result: string[] = []
  for (const raw of candidates) {
    const text = raw.trim()
    const key = dedupeKey(text)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(text)
  }
  return result
}

/**
 * R7.3: when answering, find the correct option among the options from the database content (design §6).
 * Distractors exclude every synonym (and every antonym for antonym questions), so exactly one should match; otherwise returns null (options were tampered with or the content changed).
 */
export function findCorrectOption(
  type: QuestionType,
  word: { text: string },
  sense: { def_zh: string; synonyms: string[]; antonyms: string[] },
  options: readonly string[],
): string | null {
  const accepted = new Set(acceptedAnswers(type, word, sense).map(dedupeKey))
  const matches = options.filter((o) => accepted.has(dedupeKey(o)))
  return matches.length === 1 ? matches[0] : null
}

function acceptedAnswers(
  type: QuestionType,
  word: { text: string },
  sense: { def_zh: string; synonyms: string[]; antonyms: string[] },
): string[] {
  switch (type) {
    case "word_to_zh":
      return [sense.def_zh]
    case "word_to_synonym":
      return sense.synonyms
    case "word_to_antonym":
      return sense.antonyms
    case "zh_to_word":
    case "cloze":
      return [word.text]
  }
}

function questionPrompt(
  target: QuestionWord,
  sense: QuestionSense,
  type: QuestionType,
  rng: Rng,
): string {
  switch (type) {
    case "zh_to_word":
      return sense.def_zh
    case "cloze": {
      const sentence = pick(clozeExamples(target.text, sense), rng)
      if (sentence === undefined) throw new Error("sense has no cloze example")
      return sentence
    }
    default:
      return target.text
  }
}

function correctAnswer(
  target: QuestionWord,
  sense: QuestionSense,
  type: QuestionType,
  rng: Rng,
): string {
  switch (type) {
    case "word_to_zh":
      return sense.def_zh
    case "zh_to_word":
    case "cloze":
      return target.text
    case "word_to_synonym": {
      const synonym = pick(sense.synonyms, rng)
      if (synonym === undefined) throw new Error("sense has no synonyms")
      return synonym
    }
    case "word_to_antonym": {
      const antonym = pick(sense.antonyms, rng)
      if (antonym === undefined) throw new Error("sense has no antonyms")
      return antonym
    }
  }
}

/** Candidate sources from design §7.5; pos is the part of speech of the candidate's sense, used to prefer the same part of speech. */
function libraryCandidates(
  type: QuestionType,
  others: readonly QuestionWord[],
): { text: string; pos: Set<PartOfSpeech> }[] {
  switch (type) {
    case "word_to_zh":
      return others.flatMap((w) =>
        w.senses.map((s) => ({ text: s.def_zh, pos: new Set([s.pos]) })),
      )
    case "word_to_synonym":
      return others.flatMap((w) =>
        w.senses.flatMap((s) =>
          s.synonyms.map((text) => ({ text, pos: new Set([s.pos]) })),
        ),
      )
    case "word_to_antonym":
      return others.flatMap((w) =>
        w.senses.flatMap((s) =>
          s.antonyms.map((text) => ({ text, pos: new Set([s.pos]) })),
        ),
      )
    case "zh_to_word":
    case "cloze":
      return others.map((w) => ({
        text: w.text,
        pos: new Set(w.senses.map((s) => s.pos)),
      }))
  }
}

/** Exclusion rules from R6.4 and design §7.5. */
function exclusions(
  target: QuestionWord,
  sense: QuestionSense,
  type: QuestionType,
  answer: string,
  others: readonly QuestionWord[],
): Set<string> {
  const keys = [
    answer,
    target.text,
    ...target.senses.flatMap((s) => s.synonyms),
  ]
  if (type === "word_to_zh") {
    keys.push(...target.senses.map((s) => s.def_zh))
  }
  if (type === "word_to_antonym" || type === "cloze") {
    // Exclude the antonyms of every sense: for antonym questions so exactly one option matches (D25),
    // for cloze because an antonym often fits the same sentence (D28)
    keys.push(...target.senses.flatMap((s) => s.antonyms))
  }
  if (type === "zh_to_word") {
    const question = dedupeKey(sense.def_zh)
    for (const w of others) {
      if (w.senses.some((s) => dedupeKey(s.def_zh) === question)) {
        keys.push(w.text)
      }
    }
  }
  return new Set(keys.map(dedupeKey))
}

function toQuestion(
  draft: QuestionDraft,
  distractors: string[],
  rng: Rng,
): Question {
  return {
    type: draft.type,
    wordId: draft.wordId,
    senseId: draft.senseId,
    prompt: draft.prompt,
    pos: draft.pos,
    answer: draft.answer,
    options: shuffle([draft.answer, ...distractors], rng),
  }
}
