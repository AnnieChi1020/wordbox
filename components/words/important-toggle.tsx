"use client"

import { Flag } from "lucide-react"
import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"

import { setImportant } from "@/lib/actions/words"
import { cn } from "@/lib/utils"

type Props = {
  wordId: string
  important: boolean
  /** 伺服器更新成功後通知父元件更新資料 */
  onChange?: (important: boolean) => void
  className?: string
}

/** R3.5：切換 important；畫面立即反映，失敗時自動還原並提示（列表與 popup 共用）。 */
export function ImportantToggle({
  wordId,
  important,
  onChange,
  className,
}: Props) {
  const [optimistic, setOptimistic] = useOptimistic(important)
  const [, startTransition] = useTransition()

  function toggle() {
    const next = !optimistic
    startTransition(async () => {
      setOptimistic(next)
      const result = await setImportant(wordId, next).catch(() => ({
        ok: false as const,
        message: "更新失敗，請重試",
      }))
      if (result.ok) onChange?.(next)
      else toast.error(result.message)
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={optimistic}
      aria-label="重要"
      title={optimistic ? "取消重要標記" : "標記為重要"}
      className={cn(
        "text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground focus-visible:ring-ring/50 inline-flex size-9 shrink-0 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-3",
        "aria-pressed:text-red-500 aria-pressed:hover:text-red-600",
        className,
      )}
    >
      <Flag
        aria-hidden
        className="size-4 [[aria-pressed=true]_&]:fill-current"
      />
    </button>
  )
}
