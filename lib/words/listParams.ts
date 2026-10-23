import { dedupeKey } from "@/lib/domain/normalize"

/** R3.2–R3.4, R3.9: word list search, filters, and sort order, represented as URL search params. */

export const SORT_OPTIONS = [
  { value: "created_desc", label: "新增日期（新→舊）" },
  { value: "created_asc", label: "新增日期（舊→新）" },
  { value: "alpha_asc", label: "字母（A→Z）" },
  { value: "alpha_desc", label: "字母（Z→A）" },
  { value: "stars_asc", label: "熟悉度（低→高）" },
  { value: "stars_desc", label: "熟悉度（高→低）" },
] as const

export type SortKey = (typeof SORT_OPTIONS)[number]["value"]

export const DEFAULT_SORT: SortKey = "created_desc"

/** R3.9: maximum search length, matching the longest word (R2.3). */
export const SEARCH_MAX_LENGTH = 64

export type ListParams = {
  /** Normalized, lowercased search text; '' = no search */
  q: string
  /** Sorted, distinct values 0–5; an empty array = no filter */
  stars: number[]
  importantOnly: boolean
  sort: SortKey
}

export const DEFAULT_LIST_PARAMS: ListParams = {
  q: "",
  stars: [],
  importantOnly: false,
  sort: DEFAULT_SORT,
}

type RawParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** R3.9: normalized as in R2.2, lowercased to match text_key, at most 64 characters. */
export function normalizeSearch(raw: string): string {
  return dedupeKey(raw).slice(0, SEARCH_MAX_LENGTH).trimEnd()
}

/** R3.9: a substring pattern for ilike, with every character matched literally (design §7.7). */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, "\\$&")}%`
}

/** Parses the URL; invalid values are ignored without raising errors. */
export function parseListParams(raw: RawParams): ListParams {
  const stars = (first(raw.stars) ?? "")
    .split(",")
    .filter((s) => /^[0-5]$/.test(s))
    .map(Number)
  const sort = first(raw.sort)
  return {
    q: normalizeSearch(first(raw.q) ?? ""),
    stars: [...new Set(stars)].sort((a, b) => a - b),
    importantOnly: first(raw.important) === "1",
    sort: SORT_OPTIONS.some((o) => o.value === sort)
      ? (sort as SortKey)
      : DEFAULT_SORT,
  }
}

/** Converts to a query string; defaults are omitted to keep the URL short. */
export function serializeListParams(params: ListParams): string {
  const search = new URLSearchParams()
  if (params.q) search.set("q", params.q)
  if (params.stars.length > 0) search.set("stars", params.stars.join(","))
  if (params.importantOnly) search.set("important", "1")
  if (params.sort !== DEFAULT_SORT) search.set("sort", params.sort)
  return search.toString()
}

export function hasActiveFilters(params: ListParams): boolean {
  return params.q !== "" || params.stars.length > 0 || params.importantOnly
}

export function toggleStar(stars: number[], star: number): number[] {
  return stars.includes(star)
    ? stars.filter((s) => s !== star)
    : [...stars, star].sort((a, b) => a - b)
}
