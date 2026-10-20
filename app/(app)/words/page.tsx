import type { Metadata } from "next"

export const metadata: Metadata = { title: "單字 | Wordbox" }

export default function WordsPage() {
  return (
    <main className="flex-1 p-4">
      <h1 className="text-xl font-semibold">單字</h1>
    </main>
  )
}
