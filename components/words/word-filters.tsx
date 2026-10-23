"use client"

import { Flag, Loader2, Star, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useOptimistic, useTransition } from "react"

import { Button } from "@/components/ui/button"
import {
  DEFAULT_LIST_PARAMS,
  hasActiveFilters,
  serializeListParams,
  SORT_OPTIONS,
  toggleStar,
  type ListParams,
  type SortKey,
} from "@/lib/words/listParams"

const STAR_LEVELS = [0, 1, 2, 3, 4, 5]

/** R3.2–R3.4: filters and sorting; the state is written to the URL and survives a reload. */
export function WordFilters({ params }: { params: ListParams }) {
  const router = useRouter()
  const sortId = useId()
  const [pending, startTransition] = useTransition()
  // Reflect the click immediately while the data loads in the background
  const [current, setCurrent] = useOptimistic(params)

  function apply(next: ListParams) {
    startTransition(() => {
      setCurrent(next)
      const qs = serializeListParams(next)
      router.replace(qs ? `/words?${qs}` : "/words", { scroll: false })
    })
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <fieldset className="flex flex-wrap items-center gap-1.5">
        <legend className="sr-only">依熟悉度篩選</legend>
        {STAR_LEVELS.map((star) => (
          <Button
            key={star}
            type="button"
            variant={current.stars.includes(star) ? "default" : "outline"}
            size="sm"
            aria-pressed={current.stars.includes(star)}
            aria-label={`${star} 星`}
            onClick={() =>
              apply({ ...current, stars: toggleStar(current.stars, star) })
            }
            className="min-w-11 gap-0.5 tabular-nums"
          >
            {star}
            <Star aria-hidden className="size-3" />
          </Button>
        ))}
        <Button
          type="button"
          variant={current.importantOnly ? "default" : "outline"}
          size="sm"
          aria-pressed={current.importantOnly}
          onClick={() =>
            apply({ ...current, importantOnly: !current.importantOnly })
          }
        >
          <Flag aria-hidden />
          只看重要
        </Button>
      </fieldset>

      <div className="flex items-center gap-2 sm:ml-auto">
        {pending && (
          <Loader2
            aria-label="更新中"
            className="text-muted-foreground size-4 animate-spin"
          />
        )}
        {hasActiveFilters(current) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              apply({ ...DEFAULT_LIST_PARAMS, sort: current.sort })
            }
          >
            <X aria-hidden />
            清除篩選
          </Button>
        )}
        <label htmlFor={sortId} className="sr-only">
          排序
        </label>
        <select
          id={sortId}
          value={current.sort}
          onChange={(e) =>
            apply({ ...current, sort: e.target.value as SortKey })
          }
          className="border-input bg-background dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-lg border px-2 text-sm outline-none focus-visible:ring-3"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
