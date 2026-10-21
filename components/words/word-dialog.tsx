"use client"

import { Pencil } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Fragment, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { WordDetail } from "@/lib/db/words"
import { POS_ABBR } from "@/lib/domain/pos"
import { starsLabel } from "@/lib/domain/stars"

import { ImportantToggle } from "./important-toggle"
import { SpeakButton } from "./speak-button"
import { WordEditForm } from "./word-edit-form"
import { Stars } from "./stars"
import { useImportant } from "./word-state"

/** R4：單字 popup（檢視）。開關完全由 URL 的 ?word=<id> 決定（R4.9）。 */
export function WordDialog({ word }: { word: WordDetail }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // 以 URL 為準：上一頁、重新開啟同一個字都不會與本地狀態不一致
  const open = searchParams.get("word") === word.id
  const [editing, setEditing] = useState(false)
  const [important, setImportant] = useImportant(word.id, word.is_important)

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
            {!editing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <Pencil aria-hidden />
                編輯
              </Button>
            )}
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
