import type { Db } from "./words"

export type DashboardStats = {
  total: number
  /** index = box（0–5 星） */
  byBox: number[]
  /** local_date → 答題數；只含有作答的日期 */
  daily: Map<string, number>
}

type StatsRow = {
  total: number
  by_box: number[]
  daily: { date: string; count: number }[]
}

/** R8.1、R8.2、R8.6：Dashboard 統計；daily 只含 since 之後（design §4.3、D17）。 */
export async function getDashboardStats(
  db: Db,
  since: string,
): Promise<DashboardStats> {
  const { data, error } = await db.rpc("get_dashboard_stats", {
    p_since: since,
  })
  if (error) throw error
  const row = data as StatsRow
  return {
    total: row.total,
    byBox: row.by_box,
    daily: new Map(row.daily.map((d) => [d.date, d.count])),
  }
}
