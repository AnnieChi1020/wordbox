"use client"

import { createContext, useCallback, useContext, useState } from "react"

type WordState = {
  important: ReadonlyMap<string, boolean>
  setImportant: (wordId: string, value: boolean) => void
  /** Deleted words, hidden from the list before the server re-renders (R4.7) */
  deleted: ReadonlySet<string>
  markDeleted: (wordId: string) => void
}

const WordStateContext = createContext<WordState | null>(null)

/**
 * Important state shared by the list and the popup: toggling it in either place keeps both in sync
 * without reloading the list (the loaded pages and scroll position are kept).
 */
export function WordStateProvider({ children }: { children: React.ReactNode }) {
  const [important, setMap] = useState<ReadonlyMap<string, boolean>>(new Map())
  const setImportant = useCallback((wordId: string, value: boolean) => {
    setMap((prev) => new Map(prev).set(wordId, value))
  }, [])
  const [deleted, setDeleted] = useState<ReadonlySet<string>>(new Set())
  const markDeleted = useCallback((wordId: string) => {
    setDeleted((prev) => new Set(prev).add(wordId))
  }, [])
  return (
    <WordStateContext value={{ important, setImportant, deleted, markDeleted }}>
      {children}
    </WordStateContext>
  )
}

function useWordState() {
  const ctx = useContext(WordStateContext)
  if (!ctx) throw new Error("must be used within WordStateProvider")
  return ctx
}

export function useDeletedWords() {
  const { deleted, markDeleted } = useWordState()
  return { deleted, markDeleted }
}

/** Returns the current important value (local updates take precedence over server data) and an update function. */
export function useImportant(wordId: string, serverValue: boolean) {
  const ctx = useContext(WordStateContext)
  if (!ctx)
    throw new Error("useImportant must be used within WordStateProvider")
  const value = ctx.important.get(wordId) ?? serverValue
  const set = useCallback(
    (next: boolean) => ctx.setImportant(wordId, next),
    [ctx, wordId],
  )
  return [value, set] as const
}
