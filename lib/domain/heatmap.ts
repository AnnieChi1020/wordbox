import { addDays } from "./dates"

/** 熱力圖的週數（含本週，R8.3）。 */
export const HEATMAP_WEEKS = 53

export type HeatLevel = 0 | 1 | 2 | 3 | 4

/** R8.4：0、1–8、9–16、17–32、33+ 五種深淺。 */
export function heatLevel(count: number): HeatLevel {
  if (count <= 0) return 0
  if (count <= 8) return 1
  if (count <= 16) return 2
  if (count <= 32) return 3
  return 4
}

/** `YYYY-MM-DD` 的星期幾，0 = 週日。 */
export function weekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** 熱力圖第一格（第一欄的週日）：today 所在週的週日往前 52 週。 */
export function heatmapStart(today: string): string {
  return addDays(today, -weekday(today) - (HEATMAP_WEEKS - 1) * 7)
}

export type HeatmapCell = { date: string; count: number; level: HeatLevel }

/**
 * R8.3：53 欄（週）× 7 列（週日在第一列），以 grid[週][星期幾] 存取。
 * 最後一欄包含 today；today 之後的格子為 null（不顯示）。
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
