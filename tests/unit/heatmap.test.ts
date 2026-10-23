import { describe, expect, it } from "vitest"

import {
  buildHeatmapGrid,
  HEATMAP_WEEKS,
  heatLevel,
  heatmapStart,
  weekday,
  type HeatmapCell,
} from "@/lib/domain/heatmap"

describe("heatLevel (R8.4)", () => {
  it.each([
    [0, 0],
    [1, 1],
    [8, 1],
    [9, 2],
    [10, 2], // R8 AC: 10 answers today is the third level (level 2)
    [16, 2],
    [17, 3],
    [32, 3],
    [33, 4],
    [500, 4],
  ])("%i answers → level %i", (count, level) => {
    expect(heatLevel(count)).toBe(level)
  })
})

describe("weekday", () => {
  it.each([
    ["2026-10-18", 0], // Sunday
    ["2026-10-22", 4],
    ["2026-10-24", 6],
    ["2024-02-29", 4],
  ])("%s → %i", (date, day) => {
    expect(weekday(date)).toBe(day)
  })
})

describe("heatmapStart", () => {
  it("is the Sunday 52 weeks before the current week's Sunday", () => {
    // The Sunday of the week containing 2026-10-22 (Thursday) is 2026-10-18
    expect(heatmapStart("2026-10-22")).toBe("2025-10-19")
    expect(weekday(heatmapStart("2026-10-22"))).toBe(0)
  })

  it("handles today on a Sunday or Saturday", () => {
    expect(heatmapStart("2026-10-18")).toBe("2025-10-19")
    expect(heatmapStart("2026-10-24")).toBe("2025-10-19")
    expect(heatmapStart("2026-10-25")).toBe("2025-10-26")
  })
})

describe("buildHeatmapGrid (R8.3)", () => {
  const today = "2026-10-22" // Thursday

  const cells = (grid: (HeatmapCell | null)[][]) =>
    grid.flat().filter((c): c is HeatmapCell => c !== null)

  it("has 53 weeks of 7 days, Sundays in the first row", () => {
    const grid = buildHeatmapGrid(new Map(), today)
    expect(grid).toHaveLength(HEATMAP_WEEKS)
    for (const week of grid) expect(week).toHaveLength(7)
    expect(grid[0][0]?.date).toBe("2025-10-19")
    for (const week of grid.slice(0, -1)) {
      expect(weekday(week[0]!.date)).toBe(0)
      expect(weekday(week[6]!.date)).toBe(6)
    }
  })

  it("ends with today in the last week and hides later days", () => {
    const last = buildHeatmapGrid(new Map(), today).at(-1)!
    expect(last.map((c) => c?.date ?? null)).toEqual([
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      null,
      null,
    ])
  })

  it("fills the last week completely when today is a Saturday", () => {
    const grid = buildHeatmapGrid(new Map(), "2026-10-24")
    expect(grid.at(-1)!.every((c) => c !== null)).toBe(true)
    expect(grid.at(-1)![6]!.date).toBe("2026-10-24")
  })

  it("shows only today in the last week when today is a Sunday", () => {
    const last = buildHeatmapGrid(new Map(), "2026-10-25").at(-1)!
    expect(last[0]?.date).toBe("2026-10-25")
    expect(last.slice(1)).toEqual([null, null, null, null, null, null])
  })

  it("lists consecutive dates across year ends and leap days", () => {
    const dates = cells(buildHeatmapGrid(new Map(), "2024-03-05")).map(
      (c) => c.date,
    )
    expect(dates).toContain("2023-12-31")
    expect(dates).toContain("2024-01-01")
    expect(dates).toContain("2024-02-29")
    expect(new Set(dates).size).toBe(dates.length)
    expect(dates.at(-1)).toBe("2024-03-05")
    expect(dates).toEqual([...dates].sort())
  })

  it("places counts on their dates with the matching level", () => {
    const counts = new Map([
      [today, 10],
      ["2026-01-01", 40],
      ["2025-10-19", 1],
      ["2025-10-18", 99], // before the first cell, not shown
    ])
    const byDate = new Map(
      cells(buildHeatmapGrid(counts, today)).map((c) => [c.date, c]),
    )
    expect(byDate.get(today)).toEqual({ date: today, count: 10, level: 2 })
    expect(byDate.get("2026-01-01")).toMatchObject({ count: 40, level: 4 })
    expect(byDate.get("2025-10-19")).toMatchObject({ count: 1, level: 1 })
    expect(byDate.get("2026-10-21")).toMatchObject({ count: 0, level: 0 })
    expect(byDate.has("2025-10-18")).toBe(false)
  })
})
