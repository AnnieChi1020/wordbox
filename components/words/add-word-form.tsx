"use client"

import { Loader2, Plus, RotateCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { addWord } from "@/lib/actions/words"
import {
  INPUT_FORMAT_MESSAGE,
  isValidInput,
  normalizeInput,
} from "@/lib/domain/normalize"

type Outcome =
  | { kind: "idle" }
  | { kind: "invalid"; text: string; suggestions: string[] }
  | { kind: "error"; text: string; message: string }

/** R2.1：單字列表頂端的新增輸入框。 */
export function AddWordForm() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const errorId = useId()
  const [value, setValue] = useState("")
  const [formatError, setFormatError] = useState(false)
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" })
  const [pendingText, setPendingText] = useState("")
  const [pending, startTransition] = useTransition()

  /** 以 ?word=<id> 開啟 popup；用 push 讓「上一頁」可以關閉（R4.8）。 */
  function openWord(wordId: string) {
    const params = new URLSearchParams(window.location.search)
    params.set("word", wordId)
    router.push(`/words?${params}`)
  }

  function submit(raw: string) {
    // R2.2、R2.3：正規化後不合格就不送出
    const text = normalizeInput(raw)
    if (!isValidInput(text)) {
      setFormatError(true)
      inputRef.current?.focus()
      return
    }
    setFormatError(false)
    setOutcome({ kind: "idle" })
    setPendingText(text)

    startTransition(async () => {
      const result = await addWord(text)
      switch (result.status) {
        case "created":
          setValue("")
          openWord(result.wordId)
          break
        case "exists": // R2.4
          setValue("")
          toast.info("這個字已經在你的列表裡")
          openWord(result.wordId)
          break
        case "invalid": // R2.6
          setOutcome({ kind: "invalid", text, suggestions: result.suggestions })
          break
        case "error": // R2.10
          setOutcome({ kind: "error", text, message: result.message })
          toast.error(result.message)
          break
      }
    })
  }

  return (
    <div className="space-y-3">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          submit(value)
        }}
        className="flex gap-2"
      >
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setFormatError(false)
          }}
          readOnly={pending}
          placeholder="輸入英文單字或片語"
          aria-label="新增單字"
          aria-invalid={formatError || undefined}
          aria-describedby={formatError ? errorId : undefined}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="go"
          className="h-10"
        />
        {/* R2.9：生成中停用送出 */}
        <Button type="submit" disabled={pending} className="h-10 shrink-0">
          {pending ? (
            <Loader2 aria-hidden className="animate-spin" />
          ) : (
            <Plus aria-hidden />
          )}
          新增
        </Button>
      </form>

      {formatError && (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {INPUT_FORMAT_MESSAGE}
        </p>
      )}

      <div aria-live="polite">
        {pending ? (
          <GeneratingSkeleton text={pendingText} />
        ) : outcome.kind === "invalid" ? (
          <div className="rounded-lg border p-3 text-sm">
            <p>
              找不到「<span className="font-medium">{outcome.text}</span>
              」這個字
            </p>
            {outcome.suggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">你是不是要找：</span>
                {outcome.suggestions.map((s) => (
                  <Button
                    key={s}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setValue(s)
                      submit(s)
                    }}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : outcome.kind === "error" ? (
          <div className="border-destructive/30 bg-destructive/5 flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            <p className="text-destructive">{outcome.message}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => submit(outcome.text)}
            >
              <RotateCw aria-hidden />
              重試
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function GeneratingSkeleton({ text }: { text: string }) {
  return (
    <div className="space-y-2 rounded-lg border p-3" aria-busy="true">
      <p className="text-muted-foreground text-sm">
        正在用 AI 整理「
        <span className="text-foreground font-medium">{text}</span>」…
      </p>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}
