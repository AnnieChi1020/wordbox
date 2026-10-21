"use client"

import type { ClientQuestion } from "@/lib/review/startSession"

import type { AnsweredResult } from "./question-card"

/** 一題的結果；略過（判定失敗）的題目 result 為 null。 */
export type SessionOutcome = {
  question: ClientQuestion
  result: AnsweredResult | null
}

/** R7.5：結算畫面（T2.9 完成）。 */
export function SessionSummary({
  outcomes,
}: {
  outcomes: SessionOutcome[]
  onRestart: () => void
  onDueCount: (count: number) => void
}) {
  const correct = outcomes.filter((o) => o.result?.isCorrect).length
  return (
    <p className="text-lg font-medium">
      答對 {correct} / {outcomes.length} 題
    </p>
  )
}
