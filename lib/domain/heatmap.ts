import { addDays } from "./dates"

/** Number of weeks in the heatmap (including this week, R8.3). */
export const HEATMAP_WEEKS = 53

export type HeatLevel = 0 | 1 | 2 | 3 | 4

/** R8.4: five levels: 0, 1–8, 9–16, 17–32, 33+. */
export function heatLevel(count: number): HeatLevel {
  if (count <= 0) return 0
  if (count <= 8) return 1
  if (count <= 16) return 2
  if (count <= 32) return 3
  return 4
}

/** Day of the week of a `YYYY-MM-DD` date, 0 = Sunday. */
export function weekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** The heatmap's first cell (the first column's Sunday): 52 weeks before the Sunday of today's week. */
export function heatmapStart(today: string): string {
  return addDays(today, -weekday(today) - (HEATMAP_WEEKS - 1) * 7)
}

export type HeatmapCell = { date: string; count: number; level: HeatLevel }

/**
 * R8.3: 53 columns (weeks) × 7 rows (Sunday in the first row), accessed as grid[week][weekday].
 * The last column contains today; cells after today are null (not shown).
 */
export function buildHeatmapGrid(
  counts: ReadonlyMap<string, number>,
  today: string,
): (HeatmapCell | null)[][] {
  const start = heatmapStart(today)
  return Array.from({ length: HEATMAP_WEEKS }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = addDays(start, week * 7 + day)
      if (date > today) return null
      const count = counts.get(date) ?? 0
      return { date, count, level: heatLevel(count) }
    }),
  )
}
