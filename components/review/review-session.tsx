"use client"

import { Loader2, Play } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { startReviewSession } from "@/lib/actions/review"
import type { ClientQuestion } from "@/lib/review/startSession"

import { QuestionCard, type AnsweredResult } from "./question-card"
import { SessionSummary, type SessionOutcome } from "./session-summary"

type Phase =
  | { kind: "intro"; loading: boolean }
  | {
      kind: "playing"
      questions: ClientQuestion[]
      index: number
      results: (AnsweredResult | null)[]
    }
  | { kind: "done"; outcomes: SessionOutcome[] }

const START_FAILED = "出題失敗，請重試"

/**
 * The /review flow: ReviewIntro → QuestionCard → SessionSummary (design §8).
 * Questions live only in client state; each answer is written to the database as it is given, so leaving mid-session keeps the answers so far (R7.3).
 */
export function ReviewSession({
  initialDueCount,
}: {
  initialDueCount: number
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "intro", loading: false })
  const [dueCount, setDueCount] = useState(initialDueCount)

  async function start() {
    setPhase({ kind: "intro", loading: true })
    let result
    try {
      result = await startReviewSession()
    } catch {
      result = { ok: false as const, message: START_FAILED }
    }
    if (!result.ok) {
      toast.error(result.message)
      setPhase({ kind: "intro", loading: false })
      return
    }
    if (result.questions.length === 0) {
      toast.error(START_FAILED)
      setPhase({ kind: "intro", loading: false })
      return
    }
    setPhase({
      kind: "playing",
      questions: result.questions,
      index: 0,
      results: result.questions.map(() => null),
    })
  }

  if (phase.kind === "done") {
    return (
      <SessionSummary
        outcomes={phase.outcomes}
        onRestart={start}
        onDueCount={setDueCount}
      />
    )
  }

  if (phase.kind === "playing") {
    const { questions, index, results } = phase
    return (
      <QuestionCard
        key={questions[index].questionId}
        question={questions[index]}
        index={index}
        total={questions.length}
        onAnswered={(result) =>
          setPhase((p) =>
            p.kind === "playing"
              ? {
                  ...p,
                  results: p.results.map((r, i) =>
                    i === p.index ? result : r,
                  ),
                }
              : p,
          )
        }
        onNext={() => {
          if (index + 1 < questions.length) {
            setPhase({ ...phase, index: index + 1 })
          } else {
            setPhase({
              kind: "done",
              outcomes: questions.map((question, i) => ({
                question,
                result: results[i],
              })),
            })
          }
        }}
      />
    )
  }

  return (
    <ReviewIntro dueCount={dueCount} loading={phase.loading} onStart={start} />
  )
}

function ReviewIntro({
  dueCount,
  loading,
  onStart,
}: {
  dueCount: number
  loading: boolean
  onStart: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border px-4 py-12 text-center">
      <p className="text-lg font-medium">
        {dueCount > 0 ? `今天有 ${dueCount} 個字到期` : "今天沒有到期的字"}
      </p>
      <p className="text-muted-foreground text-sm">
        {dueCount > 0
          ? "每輪最多 8 題，答對的字會延後複習，答錯的字明天再複習。"
          : "還是可以複習一輪，會優先出熟悉度較低的字。"}
      </p>
      <Button
        size="lg"
        onClick={onStart}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? (
          <Loader2 aria-hidden className="animate-spin" />
        ) : (
          <Play aria-hidden />
        )}
        {loading ? "出題中…" : "開始複習"}
      </Button>
    </div>
  )
}
