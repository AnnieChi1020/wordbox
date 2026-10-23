import { BookOpen, Plus } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { Heatmap } from "@/components/dashboard/heatmap"
import { StarDistribution } from "@/components/dashboard/star-distribution"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/db/server"
import { getDashboardStats } from "@/lib/db/stats"
import { getProfile } from "@/lib/db/words"
import { localToday } from "@/lib/domain/dates"
import { heatmapStart } from "@/lib/domain/heatmap"

export const metadata: Metadata = { title: "統計 | Wordbox" }

export default function DashboardPage() {
  return (
    <main className="flex-1 space-y-6 p-4">
      <h1 className="text-xl font-semibold">統計</h1>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardSection />
      </Suspense>
    </main>
  )
}

/** design §8.1: compute today in the profile time zone and fetch all stats in one query (D17). */
async function DashboardSection() {
  const db = await createClient()
  const profile = await getProfile(db)
  const today = localToday(profile?.timezone ?? null)
  const stats = await getDashboardStats(db, heatmapStart(today))

  if (stats.total === 0 && stats.daily.size === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-12 text-center">
        <BookOpen aria-hidden className="text-muted-foreground size-8" />
        <p className="font-medium">還沒有任何單字</p>
        <p className="text-muted-foreground text-sm">
          新增單字並開始複習後，這裡會顯示你的學習紀錄。
        </p>
        <Link href="/words" className={buttonVariants()}>
          <Plus aria-hidden />
          去新增單字
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* R8.1: a single number, shown as the number itself */}
      <section aria-labelledby="total-words" className="space-y-1">
        <h2 id="total-words" className="text-muted-foreground text-sm">
          總單字數
        </h2>
        <p className="text-4xl font-semibold tabular-nums">{stats.total}</p>
      </section>
      <StarDistribution byBox={stats.byBox} />
      <Heatmap daily={[...stats.daily]} today={today} />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-16 w-32" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}
