import { BookOpen, Plus } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { ReviewSession } from "@/components/review/review-session"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/db/server"
import { hasAnyWord } from "@/lib/db/words"
import { countDueWith } from "@/lib/review/startSession"

export const metadata: Metadata = { title: "複習 | Wordbox" }

export default function ReviewPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 space-y-6 p-4">
      <h1 className="text-xl font-semibold">複習</h1>
      <Suspense fallback={<Skeleton className="h-52 w-full rounded-lg" />}>
        <ReviewSection />
      </Suspense>
    </main>
  )
}

async function ReviewSection() {
  const db = await createClient()
  // R5.2：沒有任何單字時引導去新增
  if (!(await hasAnyWord(db))) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-12 text-center">
        <BookOpen aria-hidden className="text-muted-foreground size-8" />
        <p className="font-medium">還沒有可以複習的單字</p>
        <p className="text-muted-foreground text-sm">
          先新增幾個單字，就可以開始複習了。
        </p>
        <Link href="/words" className={buttonVariants()}>
          <Plus aria-hidden />
          去新增單字
        </Link>
      </div>
    )
  }
  return <ReviewSession initialDueCount={await countDueWith(db)} />
}
