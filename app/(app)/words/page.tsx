import type { Metadata } from "next"

import { AddWordForm } from "@/components/words/add-word-form"

export const metadata: Metadata = { title: "單字 | Wordbox" }

export default function WordsPage() {
  return (
    <main className="flex-1 space-y-6 p-4">
      <h1 className="text-xl font-semibold">單字</h1>
      <AddWordForm />
    </main>
  )
}
