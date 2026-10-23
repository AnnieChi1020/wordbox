/** R2.11 parts of speech, in the same order as the database enum part_of_speech. */
export const POS_VALUES = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "pronoun",
  "preposition",
  "conjunction",
  "interjection",
  "determiner",
  "phrase",
] as const

export type PartOfSpeech = (typeof POS_VALUES)[number]

export const POS_ABBR: Record<PartOfSpeech, string> = {
  noun: "n.",
  verb: "v.",
  adjective: "adj.",
  adverb: "adv.",
  pronoun: "pron.",
  preposition: "prep.",
  conjunction: "conj.",
  interjection: "interj.",
  determiner: "det.",
  phrase: "phr.",
}

export function isPartOfSpeech(value: unknown): value is PartOfSpeech {
  return (POS_VALUES as readonly unknown[]).includes(value)
}

/** R3.1: the senses' parts of speech, deduplicated in sense order, shown as abbreviations. */
export function posTags(senses: readonly { pos: PartOfSpeech }[]): string[] {
  return [...new Set(senses.map((s) => s.pos))].map((pos) => POS_ABBR[pos])
}
