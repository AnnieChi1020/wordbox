"use client"

import { createContext, useCallback, useContext, useState } from "react"

type WordState = {
  important: ReadonlyMap<string, boolean>
  setImportant: (wordId: string, value: boolean) => void
  /** 已刪除的字；伺服器重新渲染前先從列表隱藏（R4.7） */
  deleted: ReadonlySet<string>
  markDeleted: (wordId: string) => void
}

const WordStateContext = createContext<WordState | null>(null)

/**
 * 列表與 popup 共用的 important 狀態：在任一處切換後兩邊同步，
 * 不需要重新載入列表（保留已載入的頁面與捲動位置）。
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

/** 回傳目前的 important 值（本地更新優先於伺服器資料）與更新函式。 */
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
