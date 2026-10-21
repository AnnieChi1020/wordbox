/** R3.2–R3.4：單字列表的篩選與排序，以 URL search params 表示。 */

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

export type ListParams = {
  /** 已排序、不重複的 0–5；空陣列 = 不篩選 */
  stars: number[]
  importantOnly: boolean
  sort: SortKey
}

export const DEFAULT_LIST_PARAMS: ListParams = {
  stars: [],
  importantOnly: false,
  sort: DEFAULT_SORT,
}

type RawParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** 解析 URL；不合法的值一律忽略，不報錯。 */
export function parseListParams(raw: RawParams): ListParams {
  const stars = (first(raw.stars) ?? "")
    .split(",")
    .filter((s) => /^[0-5]$/.test(s))
    .map(Number)
  const sort = first(raw.sort)
  return {
    stars: [...new Set(stars)].sort((a, b) => a - b),
    importantOnly: first(raw.important) === "1",
    sort: SORT_OPTIONS.some((o) => o.value === sort)
      ? (sort as SortKey)
      : DEFAULT_SORT,
  }
}

/** 轉成 query string；預設值省略，讓網址保持簡潔。 */
export function serializeListParams(params: ListParams): string {
  const search = new URLSearchParams()
  if (params.stars.length > 0) search.set("stars", params.stars.join(","))
  if (params.importantOnly) search.set("important", "1")
  if (params.sort !== DEFAULT_SORT) search.set("sort", params.sort)
  return search.toString()
}

export function hasActiveFilters(params: ListParams): boolean {
  return params.stars.length > 0 || params.importantOnly
}

export function toggleStar(stars: number[], star: number): number[] {
  return stars.includes(star)
    ? stars.filter((s) => s !== star)
    : [...stars, star].sort((a, b) => a - b)
}
