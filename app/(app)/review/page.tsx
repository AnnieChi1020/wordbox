import type { Metadata } from "next"

export const metadata: Metadata = { title: "複習 | Wordbox" }

export default function ReviewPage() {
  return (
    <main className="flex-1 p-4">
      <h1 className="text-xl font-semibold">複習</h1>
      <p className="text-muted-foreground mt-2">即將推出</p>
    </main>
  )
}
