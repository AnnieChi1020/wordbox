import type { Metadata } from "next"
import { Suspense } from "react"

import { ReviewSession } from "@/components/review/review-session"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/db/server"
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
  const dueCount = await countDueWith(await createClient())
  return <ReviewSession initialDueCount={dueCount} />
}
