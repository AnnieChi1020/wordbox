"use client"

import { Loader2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { loadMoreWords } from "@/lib/actions/words"
import type { WordListItem } from "@/lib/db/words"
import { posTags } from "@/lib/domain/pos"

import { ImportantToggle } from "./important-toggle"
import { Stars } from "./stars"
import { useDeletedWords, useImportant } from "./word-state"

type Props = {
  /** 伺服器端查詢的第一頁 */
  initialWords: WordListItem[]
  total: number
  /** 目前的篩選與排序；載入下一頁與開啟 popup 時沿用（R3.4） */
  listQuery: string
}

/** R3.1：單字列表；捲動到底時載入下一頁（design D11）。 */
export function WordList({ initialWords, total, listQuery }: Props) {
  const [words, setWords] = useState(initialWords)
  const [source, setSource] = useState(initialWords)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  // 同步的載入狀態：避免捲動與按鈕同時觸發而重複載入同一頁
  const inFlight = useRef(false)
  const loaded = useRef(initialWords)

  // 篩選、排序或資料變動後伺服器重新渲染第一頁 → 重設列表
  if (source !== initialWords) {
    setSource(initialWords)
    setWords(initialWords)
    setFailed(false)
  }

  useEffect(() => {
    loaded.current = words
  }, [words])

  const hasMore = words.length < total
  const { deleted } = useDeletedWords()
  const visible = words.filter((w) => !deleted.has(w.id))

  async function loadMore() {
    if (inFlight.current || loaded.current.length >= total) return
    inFlight.current = true
    setLoading(true)
    const base = loaded.current
    try {
      const page = await loadMoreWords(listQuery, base.length)
      // 載入期間列表已重設（篩選改變等）→ 丟棄這次結果
      if (loaded.current !== base) return
      const seen = new Set(base.map((w) => w.id))
      const next = [...base, ...page.words.filter((w) => !seen.has(w.id))]
      loaded.current = next
      setWords(next)
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }

  // 每次渲染後重新觀察：載入完成時若底部仍在可視範圍內，會繼續載入
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore || failed) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore()
      },
      { rootMargin: "400px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  })

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        {total - (words.length - visible.length)} 個單字
      </p>
      <ul aria-label="單字列表" className="divide-y rounded-lg border">
        {visible.map((word) => (
          <WordRow key={word.id} word={word} listQuery={listQuery} />
        ))}
      </ul>
      {hasMore && (
        <div ref={sentinel} className="flex justify-center">
          {/* 自動載入之外，也可用鍵盤操作（NFR5） */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadMore()}
            disabled={loading}
          >
            {loading && <Loader2 aria-hidden className="animate-spin" />}
            {failed
              ? "載入失敗，重試"
              : `載入更多（還有 ${total - words.length} 個）`}
          </Button>
        </div>
      )}
    </div>
  )
}

function WordRow({
  word,
  listQuery,
}: {
  word: WordListItem
  listQuery: string
}) {
  const [important, setImportant] = useImportant(word.id, word.is_important)
  const params = new URLSearchParams(listQuery)
  params.set("word", word.id)
  return (
    <li className="flex items-center gap-1 pr-1.5">
      {/* R3.6：點擊單字列開啟 popup */}
      <Link
        href={`/words?${params}`}
        scroll={false}
        prefetch={false}
        className="hover:bg-muted/50 focus-visible:ring-ring/50 flex min-w-0 flex-1 items-center gap-3 rounded-l-lg px-3 py-3 outline-none focus-visible:ring-3"
      >
        {/* 單字與詞性在剩餘寬度內換行，星等固定在右側不被擠壓 */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="min-w-0 font-medium wrap-break-word">
            {word.text}
          </span>
          <span className="flex gap-1">
            {posTags(word.senses).map((tag) => (
              <Badge key={tag} variant="secondary" className="font-normal">
                {tag}
              </Badge>
            ))}
          </span>
        </div>
        <Stars box={word.box} />
      </Link>
      <ImportantToggle
        wordId={word.id}
        important={important}
        onChange={setImportant}
      />
    </li>
  )
}

export function WordListSkeleton() {
  return (
    <div aria-busy="true" aria-label="載入單字列表" className="space-y-2">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="bg-muted h-12 animate-pulse rounded-lg" />
      ))}
    </div>
  )
}
