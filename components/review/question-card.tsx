"use client"

import { Check, Loader2, RotateCw, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { submitAnswer } from "@/lib/actions/review"
import { POS_ABBR } from "@/lib/domain/pos"
import type { QuestionType } from "@/lib/domain/questions"
import type { ClientQuestion } from "@/lib/review/startSession"
import type { AnswerResult } from "@/lib/review/submitAnswer"
import { cn } from "@/lib/utils"

export type AnsweredResult = Extract<AnswerResult, { ok: true }>

type Status =
  | { kind: "idle" }
  | { kind: "submitting"; selected: string }
  | { kind: "failed"; selected: string; message: string }
  | { kind: "answered"; selected: string; result: AnsweredResult }

const FAILED_MESSAGE = "連線失敗，請重試"

/** R6.1：各題型的題目敘述。 */
function questionText(type: QuestionType): [before: string, after: string] {
  switch (type) {
    case "word_to_zh":
      return ["", "的中文意思是？"]
    case "word_to_synonym":
      return ["哪一個是", "的同義詞？"]
    case "zh_to_word":
      return ["", "的英文是？"]
  }
}

/**
 * R7.1、R7.2：一次一題。作答後立即送出判定（R7.3），鎖定選項並以顏色與圖示標示對錯。
 * 判定失敗時可重送同一個 questionId，或略過這題。
 */
export function QuestionCard({
  question,
  index,
  total,
  onAnswered,
  onNext,
}: {
  question: ClientQuestion
  index: number
  total: number
  onAnswered: (result: AnsweredResult) => void
  onNext: () => void
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const nextRef = useRef<HTMLButtonElement>(null)
  const [before, after] = questionText(question.type)
  const isLast = index + 1 === total

  async function choose(selected: string) {
    setStatus({ kind: "submitting", selected })
    let result: AnswerResult
    try {
      result = await submitAnswer({
        questionId: question.questionId,
        wordId: question.wordId,
        senseId: question.senseId,
        questionType: question.type,
        options: question.options,
        selected,
      })
    } catch {
      result = { ok: false, message: FAILED_MESSAGE }
    }
    if (result.ok) {
      setStatus({ kind: "answered", selected, result })
      onAnswered(result)
    } else {
      setStatus({ kind: "failed", selected, message: result.message })
      toast.error(result.message)
    }
  }

  // 作答後把焦點移到「下一題」，Enter 即可繼續
  useEffect(() => {
    if (status.kind === "answered") nextRef.current?.focus()
  }, [status.kind])

  // 數字鍵 1–4 作答（NFR5）
  useEffect(() => {
    if (status.kind !== "idle") return
    function onKeyDown(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return
      const option = question.options[Number(e.key) - 1]
      if (option === undefined) return
      e.preventDefault()
      void choose(option)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- choose 只依賴 question
  }, [status.kind, question])

  const locked = status.kind !== "idle"
  const answered = status.kind === "answered" ? status : null

  return (
    <section aria-labelledby="question-prompt" className="space-y-5">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          <span aria-hidden>
            {index + 1} / {total}
          </span>
          <span className="sr-only">
            第 {index + 1} 題，共 {total} 題
          </span>
        </p>
        <div
          aria-hidden
          className="bg-muted h-1.5 overflow-hidden rounded-full"
        >
          <div
            className="bg-primary h-full transition-[width]"
            style={{
              width: `${((index + (answered ? 1 : 0)) / total) * 100}%`,
            }}
          />
        </div>
      </div>

      <h2 id="question-prompt" className="text-lg leading-relaxed">
        {before}
        <span className={cn("mr-1 text-2xl font-semibold", before && "ml-1")}>
          {question.prompt}
        </span>
        <span className="text-muted-foreground mr-1 text-sm">
          {POS_ABBR[question.pos]}
        </span>
        {after}
      </h2>

      <ol className="grid gap-2" aria-label="選項">
        {question.options.map((option, i) => {
          const isCorrect = answered?.result.correctOption === option
          const isWrongPick =
            answered !== null && answered.selected === option && !isCorrect
          const isPending =
            status.kind === "submitting" && status.selected === option
          return (
            <li key={option}>
              <button
                type="button"
                disabled={locked}
                onClick={() => choose(option)}
                data-state={
                  isCorrect ? "correct" : isWrongPick ? "wrong" : undefined
                }
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                  "hover:bg-muted focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
                  "disabled:cursor-default disabled:hover:bg-transparent",
                  "data-[state=correct]:border-green-600 data-[state=correct]:bg-green-50 dark:data-[state=correct]:bg-green-950",
                  "data-[state=wrong]:border-red-600 data-[state=wrong]:bg-red-50 dark:data-[state=wrong]:bg-red-950",
                  locked && !isCorrect && !isWrongPick && "opacity-60",
                )}
              >
                <span
                  aria-hidden
                  className="text-muted-foreground bg-muted flex size-6 shrink-0 items-center justify-center rounded text-xs"
                >
                  {i + 1}
                </span>
                <span className="flex-1">{option}</span>
                {isPending && (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                )}
                {isCorrect && (
                  <>
                    <Check aria-hidden className="size-5 text-green-700" />
                    <span className="sr-only">正確答案</span>
                  </>
                )}
                {isWrongPick && (
                  <>
                    <X aria-hidden className="size-5 text-red-600" />
                    <span className="sr-only">你的答案</span>
                  </>
                )}
              </button>
            </li>
          )
        })}
      </ol>

      <p aria-live="polite" className="min-h-6 font-medium">
        {answered &&
          (answered.result.isCorrect ? (
            <span className="text-green-800 dark:text-green-400">答對了！</span>
          ) : (
            <span className="text-red-700 dark:text-red-400">
              答錯了，正確答案是「{answered.result.correctOption}」
            </span>
          ))}
      </p>

      {status.kind === "failed" && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => choose(status.selected)}>
            <RotateCw aria-hidden />
            重試
          </Button>
          <Button variant="outline" onClick={onNext}>
            略過這題
          </Button>
        </div>
      )}

      {answered && (
        <Button ref={nextRef} size="lg" onClick={onNext}>
          {isLast ? "看結果" : "下一題"}
        </Button>
      )}
    </section>
  )
}
