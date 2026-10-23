import type { Db } from "./words"

export type DashboardStats = {
  total: number
  /** index = box (0–5 stars) */
  byBox: number[]
  /** local_date → answer count; only dates with answers */
  daily: Map<string, number>
}

type StatsRow = {
  total: number
  by_box: number[]
  daily: { date: string; count: number }[]
}

/** R8.1, R8.2, R8.6: dashboard stats; daily covers only dates from since (design §4.3, D17). */
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
