import { BookOpen } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { buttonVariants } from "@/components/ui/button"
import { AddWordForm } from "@/components/words/add-word-form"
import { WordFilters } from "@/components/words/word-filters"
import { WordList, WordListSkeleton } from "@/components/words/word-list"
import { createClient } from "@/lib/db/server"
import { hasAnyWord, listWords } from "@/lib/db/words"
import {
  DEFAULT_LIST_PARAMS,
  hasActiveFilters,
  parseListParams,
  serializeListParams,
} from "@/lib/words/listParams"

export const metadata: Metadata = { title: "單字 | Wordbox" }

export default function WordsPage({ searchParams }: PageProps<"/words">) {
  return (
    <main className="flex-1 space-y-6 p-4">
      <h1 className="text-xl font-semibold">單字</h1>
      <AddWordForm />
      <Suspense fallback={<WordListSkeleton />}>
        <WordListSection searchParams={searchParams} />
      </Suspense>
    </main>
  )
}

async function WordListSection({
  searchParams,
}: {
  searchParams: PageProps<"/words">["searchParams"]
}) {
  const params = parseListParams(await searchParams)
  const db = await createClient()
  const { words, total } = await listWords(db, params)

  // R3.7：完全沒有單字時只顯示空狀態
  if (
    words.length === 0 &&
    !(hasActiveFilters(params) && (await hasAnyWord(db)))
  ) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-12 text-center">
        <BookOpen aria-hidden className="text-muted-foreground size-8" />
        <p className="font-medium">還沒有任何單字</p>
        <p className="text-muted-foreground text-sm">
          在上方輸入框輸入英文單字或片語，AI 會幫你整理解釋、例句與同義詞。
        </p>
      </div>
    )
  }

  const listQuery = serializeListParams(params)
  return (
    <section aria-label="單字列表區" className="space-y-3">
      <WordFilters params={params} />
      {words.length === 0 ? (
        // R3.8
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-12 text-center">
          <p className="font-medium">沒有符合條件的單字</p>
          <Link
            href={`/words?${serializeListParams({ ...DEFAULT_LIST_PARAMS, sort: params.sort })}`}
            scroll={false}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            清除篩選
          </Link>
        </div>
      ) : (
        <WordList initialWords={words} total={total} listQuery={listQuery} />
      )}
    </section>
  )
}
