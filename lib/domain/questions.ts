import { dedupeKey } from "./normalize"
import type { PartOfSpeech } from "./pos"
import { pick, shuffle, type Rng } from "./random"

export const QUESTION_TYPES = [
  "word_to_zh",
  "word_to_synonym",
  "word_to_antonym",
  "zh_to_word",
] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

/** 每題的干擾選項數（R6.2）。 */
export const DISTRACTOR_COUNT = 3

export type QuestionSense = {
  id: string
  pos: PartOfSpeech
  def_zh: string
  synonyms: string[]
  antonyms: string[]
}

export type QuestionWord = { id: string; text: string; senses: QuestionSense[] }

/** 完整的題目；`answer` 只留在伺服器，傳給 client 前移除（D15）。 */
export type Question = {
  type: QuestionType
  wordId: string
  senseId: string
  prompt: string
  pos: PartOfSpeech
  answer: string
  options: string[]
}

/** 字庫候選不足時的草稿，由 AI 或快取補足（R6.5）。 */
export type QuestionDraft = Omit<Question, "options"> & {
  /** 目標字的同義詞（所有義項），提供給 AI 避開 */
  synonyms: string[]
  distractors: string[]
  missing: number
  /** R6.4 排除的選項，以 dedupeKey 比較 */
  excluded: ReadonlySet<string>
}

export function isQuestionType(value: unknown): value is QuestionType {
  return QUESTION_TYPES.includes(value as QuestionType)
}

/** R6.1：沒有同義詞的義項不出 word_to_synonym，沒有反義詞的不出 word_to_antonym。 */
export function availableTypes(sense: QuestionSense): QuestionType[] {
  return QUESTION_TYPES.filter((type) => {
    if (type === "word_to_synonym") return sense.synonyms.length > 0
    if (type === "word_to_antonym") return sense.antonyms.length > 0
    return true
  })
}

/**
 * R6.1–R6.4：以字庫出題（design §7.5）。
 * 候選足夠時回傳完整題目；不足時回傳草稿與已找到的部分候選，交由 completeQuestion 補足。
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
  const prompt = type === "zh_to_word" ? sense.def_zh : target.text
  const excluded = exclusions(target, sense, type, answer, others)

  const candidates = shuffle(libraryCandidates(type, others), rng)
    // 穩定排序：同詞性優先，其餘維持隨機順序（R6.3）
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
    distractors,
    missing: DISTRACTOR_COUNT - distractors.length,
    excluded,
  }
  if (draft.missing > 0) return { needsAi: draft }
  return { question: toQuestion(draft, distractors, rng) }
}

/**
 * 以 AI 或快取的選項補足草稿；過濾後仍不足時回傳 null（R6.6）。
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

/** R6.4：去除空字串、重複（不分大小寫）與排除清單中的選項，保留順序。 */
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
 * R7.3：作答時依資料庫的內容找出選項中的正確答案（design §6）。
 * 干擾選項已排除所有同義詞（反義詞題另排除所有反義詞），因此應恰好一個符合；否則回傳 null（選項遭竄改或內容已變動）。
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
      return [word.text]
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

/** design §7.5 的候選來源；pos 為候選所屬義項的詞性，用於同詞性優先。 */
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
      return others.map((w) => ({
        text: w.text,
        pos: new Set(w.senses.map((s) => s.pos)),
      }))
  }
}

/** R6.4 與 design §7.5 的排除規則。 */
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
  if (type === "word_to_antonym") {
    // 排除所有義項的反義詞，作答判定才會恰好一個符合（D25）
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
