"use client"

import { Pencil, Sparkles, Trash2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Fragment, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { deleteWord, regenerateWord } from "@/lib/actions/words"
import type { WordDetail } from "@/lib/db/words"
import { POS_ABBR } from "@/lib/domain/pos"
import { starsLabel } from "@/lib/domain/stars"

import { ConfirmAction } from "./confirm-action"
import { ImportantToggle } from "./important-toggle"
import { SpeakButton } from "./speak-button"
import { Stars } from "./stars"
import { WordEditForm } from "./word-edit-form"
import { useDeletedWords, useImportant } from "./word-state"

/** R4：單字 popup（檢視）。開關完全由 URL 的 ?word=<id> 決定（R4.9）。 */
export function WordDialog({ word }: { word: WordDetail }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // 以 URL 為準：上一頁、重新開啟同一個字都不會與本地狀態不一致
  const open = searchParams.get("word") === word.id
  const [editing, setEditing] = useState(false)
  const [important, setImportant] = useImportant(word.id, word.is_important)
  const { markDeleted } = useDeletedWords()
  const [regenerating, setRegenerating] = useState(false)

  /** R4.5、R4.6：失敗時保留原內容並顯示錯誤 */
  async function regenerate() {
    setRegenerating(true)
    const result = await regenerateWord(word.id).catch(() => ({
      ok: false as const,
      message: "重新生成失敗，原內容未變更，請重試",
    }))
    if (result.ok) {
      toast.success("已重新生成")
      router.refresh()
    } else {
      toast.error(result.message)
    }
    setRegenerating(false)
  }

  /** R4.7：刪除後關閉 popup 並從列表移除 */
  async function remove() {
    const result = await deleteWord(word.id).catch(() => ({
      ok: false as const,
      message: "刪除失敗，請重試",
    }))
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    toast.success(`已刪除「${word.text}」`)
    markDeleted(word.id)
    close()
    // 更新總數與空狀態
    router.refresh()
  }

  /** R4.8：關閉按鈕、Esc、點擊背景；只改 URL，不需等待伺服器 */
  function close() {
    setEditing(false)
    const params = new URLSearchParams(window.location.search)
    params.delete("word")
    const qs = params.toString()
    window.history.replaceState(null, "", qs ? `/words?${qs}` : "/words")
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        className={
          // 手機寬度全螢幕（R4.8）；較寬時置中，內容超出時捲動
          "flex flex-col gap-0 overflow-hidden p-0 max-sm:inset-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-0 max-sm:rounded-none sm:max-h-[85dvh] sm:max-w-lg"
        }
      >
        <DialogHeader className="gap-3 border-b p-4 pr-12">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <DialogTitle className="text-2xl font-semibold">
              {word.text}
            </DialogTitle>
            {word.ipa && (
              <span className="text-muted-foreground text-sm">{word.ipa}</span>
            )}
            <SpeakButton text={word.text} />
          </div>
          <div className="flex items-center gap-2">
            <Stars box={word.box} />
            <span className="text-muted-foreground text-xs">
              {starsLabel(word.box)}
            </span>
            <ImportantToggle
              wordId={word.id}
              important={important}
              onChange={setImportant}
              className="ml-auto"
            />
          </div>
          <DialogDescription className="sr-only">
            {word.text} 的解釋、同義詞、反義詞與例句
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <WordEditForm
            word={word}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false)
              // 重新載入 popup 與列表（詞性 tag 可能改變）
              router.refresh()
            }}
          />
        ) : regenerating ? (
          <SensesSkeleton text={word.text} />
        ) : (
          <ol
            className="flex-1 space-y-5 overflow-y-auto p-4"
            aria-label="義項"
          >
            {word.senses.map((sense, i) => (
              <li key={sense.id} className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {i + 1}.
                  </span>
                  <Badge variant="secondary" title={sense.pos}>
                    {POS_ABBR[sense.pos]}
                  </Badge>
                  <p className="text-base font-medium">{sense.def_zh}</p>
                </div>
                <p className="text-muted-foreground">{sense.def_en}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <WordGroup label="同義" words={sense.synonyms} />
                  <WordGroup label="反義" words={sense.antonyms} />
                </dl>
                {sense.examples.length > 0 && (
                  <ul className="space-y-1 border-l-2 pl-3" aria-label="例句">
                    {sense.examples.map((example) => (
                      <li key={example} className="italic">
                        <Highlight text={example} term={word.text} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}

        {!editing && (
          <div className="flex items-center gap-2 border-t p-3">
            {/* R4.7 */}
            <ConfirmAction
              destructive
              disabled={regenerating}
              title={`刪除「${word.text}」？`}
              description="單字與所有解釋都會刪除，無法復原。複習紀錄會保留在統計中。"
              confirmLabel="刪除"
              onConfirm={remove}
            >
              <Trash2 aria-hidden />
              刪除
            </ConfirmAction>
            <div className="ml-auto flex gap-2">
              {/* R4.5 */}
              <ConfirmAction
                disabled={regenerating}
                title={`重新生成「${word.text}」？`}
                description="AI 會重新生成音標與所有義項並取代目前的內容（包含你編輯過的部分）。熟悉度與重要標記不變。"
                confirmLabel="重新生成"
                onConfirm={regenerate}
              >
                <Sparkles aria-hidden />
                重新生成
              </ConfirmAction>
              <Button
                type="button"
                size="sm"
                disabled={regenerating}
                onClick={() => setEditing(true)}
              >
                <Pencil aria-hidden />
                編輯
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function WordGroup({ label, words }: { label: string; words: string[] }) {
  if (words.length === 0) return null
  return (
    <>
      <dt className="text-muted-foreground text-xs leading-6">{label}</dt>
      <dd className="flex flex-wrap gap-1">
        {words.map((w) => (
          <Badge key={w} variant="outline" className="font-normal">
            {w}
          </Badge>
        ))}
      </dd>
    </>
  )
}

/** 例句中標示單字本身（不分大小寫）。 */
function Highlight({ text, term }: { text: string; term: string }) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const parts = text.split(new RegExp(`(${escaped})`, "gi"))
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        className="text-foreground bg-transparent font-semibold not-italic"
      >
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

function SensesSkeleton({ text }: { text: string }) {
  return (
    <div className="flex-1 space-y-3 p-4" aria-busy="true">
      <p className="text-muted-foreground text-sm">
        正在用 AI 重新整理「{text}」…
      </p>
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-5 w-1/4" />
      <Skeleton className="h-4 w-3/5" />
    </div>
  )
}
