import { describe, expect, it } from "vitest"

import {
  DEFAULT_LIST_PARAMS,
  hasActiveFilters,
  parseListParams,
  serializeListParams,
  toggleStar,
} from "@/lib/words/listParams"

describe("parseListParams (R3.4)", () => {
  it("defaults to newest first with no filters", () => {
    expect(parseListParams({})).toEqual(DEFAULT_LIST_PARAMS)
  })

  it("parses design §3 example `?stars=0,1&important=1&sort=created_desc`", () => {
    expect(
      parseListParams({ stars: "0,1", important: "1", sort: "created_desc" }),
    ).toEqual({ stars: [0, 1], importantOnly: true, sort: "created_desc" })
  })

  it("sorts and dedupes stars and drops invalid values", () => {
    expect(parseListParams({ stars: "5,1,x,1,6,-1,2.5," }).stars).toEqual([
      1, 5,
    ])
  })

  it("ignores unknown sort and important values", () => {
    expect(parseListParams({ sort: "random", important: "yes" })).toEqual(
      DEFAULT_LIST_PARAMS,
    )
  })

  it("uses the first value when a param is repeated", () => {
    expect(parseListParams({ sort: ["alpha_asc", "stars_desc"] }).sort).toBe(
      "alpha_asc",
    )
  })

  it("ignores unrelated params such as `word`", () => {
    expect(parseListParams({ word: "abc" })).toEqual(DEFAULT_LIST_PARAMS)
  })
})

describe("serializeListParams", () => {
  it("omits defaults", () => {
    expect(serializeListParams(DEFAULT_LIST_PARAMS)).toBe("")
  })

  it("round-trips through parse", () => {
    const params = {
      stars: [0, 1],
      importantOnly: true,
      sort: "alpha_asc" as const,
    }
    const qs = serializeListParams(params)
    expect(qs).toBe("stars=0%2C1&important=1&sort=alpha_asc")
    expect(
      parseListParams(Object.fromEntries(new URLSearchParams(qs))),
    ).toEqual(params)
  })
})

describe("filters helpers", () => {
  it("detects active filters but not a non-default sort", () => {
    expect(hasActiveFilters(DEFAULT_LIST_PARAMS)).toBe(false)
    expect(
      hasActiveFilters({ ...DEFAULT_LIST_PARAMS, sort: "alpha_asc" }),
    ).toBe(false)
    expect(hasActiveFilters({ ...DEFAULT_LIST_PARAMS, stars: [0] })).toBe(true)
    expect(
      hasActiveFilters({ ...DEFAULT_LIST_PARAMS, importantOnly: true }),
    ).toBe(true)
  })

  it("toggles a star in sorted order", () => {
    expect(toggleStar([0, 3], 1)).toEqual([0, 1, 3])
    expect(toggleStar([0, 1, 3], 1)).toEqual([0, 3])
  })
})
