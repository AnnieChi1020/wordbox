"use client"

import { ArrowRight, Check, List, RotateCw, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Stars } from "@/components/words/stars"
import { countDueWords } from "@/lib/actions/review"
import type { ClientQuestion } from "@/lib/review/startSession"

import type { AnsweredResult } from "./question-card"

/** 一題的結果；略過（判定失敗）的題目 result 為 null。 */
export type SessionOutcome = {
  question: ClientQuestion
  result: AnsweredResult | null
}

/** 題目中的英文單字：zh_to_word 的單字是正確答案，略過時只能顯示題目。 */
function wordLabel({ question, result }: SessionOutcome): string {
  if (question.type !== "zh_to_word") return question.prompt
  return result?.correctOption ?? question.prompt
}

/**
 * R7.5：答對題數、每個字的對錯與星數變化，以及「再來一輪」和「回單字列表」。
 * 已沒有到期的字時顯示「今天到期的字都複習完了」。
 */
export function SessionSummary({
  outcomes,
  onRestart,
  onDueCount,
}: {
  outcomes: SessionOutcome[]
  onRestart: () => void
  onDueCount: (count: number) => void
}) {
  const answered = outcomes.filter((o) => o.result !== null)
  const correct = answered.filter((o) => o.result?.isCorrect).length
  const [dueCount, setDueCount] = useState<number | null>(null)
  const [restarting, setRestarting] = useState(false)

  useEffect(() => {
    let active = true
    countDueWords()
      .then((count) => {
        if (!active) return
        setDueCount(count)
        onDueCount(count)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [onDueCount])

  return (
    <section aria-labelledby="summary-heading" className="space-y-6">
      <div className="space-y-1 text-center">
        <h2 id="summary-heading" className="text-2xl font-semibold">
          答對 {correct} / {answered.length} 題
        </h2>
        {answered.length < outcomes.length && (
          <p className="text-muted-foreground text-sm">
            略過 {outcomes.length - answered.length} 題（不計分）
          </p>
        )}
        <p aria-live="polite" className="text-muted-foreground min-h-5 text-sm">
          {dueCount === 0 && "今天到期的字都複習完了"}
          {dueCount !== null && dueCount > 0 && `還有 ${dueCount} 個字今天到期`}
        </p>
      </div>

      <ul aria-label="這一輪的結果" className="divide-y rounded-lg border">
        {outcomes.map((outcome) => {
          const { question, result } = outcome
          return (
            <li key={question.questionId}>
              <Link
                href={`/words?word=${question.wordId}`}
                className="hover:bg-muted focus-visible:ring-ring/50 flex items-center gap-3 px-3 py-3 outline-none focus-visible:ring-3"
              >
                {result === null ? (
                  <span className="text-muted-foreground w-5 text-center text-xs">
                    —
                  </span>
                ) : result.isCorrect ? (
                  <Check aria-hidden className="size-5 text-green-600" />
                ) : (
                  <X aria-hidden className="size-5 text-red-600" />
                )}
                <span className="sr-only">
                  {result === null
                    ? "略過"
                    : result.isCorrect
                      ? "答對"
                      : "答錯"}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {wordLabel(outcome)}
                </span>
                {result && (
                  <span className="flex shrink-0 items-center gap-1.5">
                    <Stars box={result.boxBefore} />
                    <ArrowRight
                      aria-label="變為"
                      className="text-muted-foreground size-3.5"
                    />
                    <Stars box={result.boxAfter} />
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap justify-center gap-2">
        <Button
          size="lg"
          disabled={restarting}
          onClick={() => {
            setRestarting(true)
            onRestart()
          }}
        >
          <RotateCw aria-hidden className={restarting ? "animate-spin" : ""} />
          再來一輪
        </Button>
        <Link
          href="/words"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <List aria-hidden />
          回單字列表
        </Link>
      </div>
    </section>
  )
}
