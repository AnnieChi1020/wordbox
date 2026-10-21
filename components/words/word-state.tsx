"use client"

import { createContext, useCallback, useContext, useState } from "react"

type WordState = {
  important: ReadonlyMap<string, boolean>
  setImportant: (wordId: string, value: boolean) => void
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
  return (
    <WordStateContext value={{ important, setImportant }}>
      {children}
    </WordStateContext>
  )
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
