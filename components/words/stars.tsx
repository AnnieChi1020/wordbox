import { Star } from "lucide-react"

import { cn } from "@/lib/utils"
import { MAX_STARS, starsFromBox, starsLabel } from "@/lib/domain/stars"

/** 熟悉度星數（唯讀）；以 aria-label 提供文字替代（NFR5）。 */
export function Stars({ box, className }: { box: number; className?: string }) {
  const { filled } = starsFromBox(box)
  return (
    <span
      role="img"
      aria-label={starsLabel(box)}
      className={cn("inline-flex shrink-0 gap-0.5", className)}
    >
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <Star
          key={i}
          aria-hidden
          data-filled={i < filled || undefined}
          className="text-muted-foreground/50 size-3.5 data-filled:fill-amber-500 data-filled:text-amber-700"
        />
      ))}
    </span>
  )
}
