"use client"

import { Search, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  normalizeSearch,
  SEARCH_MAX_LENGTH,
  serializeListParams,
  type ListParams,
} from "@/lib/words/listParams"

/** R3.9: wait this long after the last keystroke before searching. */
const SEARCH_DELAY_MS = 300

/**
 * R3.9: the word list search box. The input keeps its own text and writes the
 * normalized search to the URL with router.replace, so typing adds no history entries.
 */
export function WordSearch({ params }: { params: ListParams }) {
  const router = useRouter()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(params.q)
  // The last search this input wrote to the URL
  const [sent, setSent] = useState(params.q)
  const [seenQ, setSeenQ] = useState(params.q)

  // The URL changed elsewhere (e.g. 「清除篩選」): show its search instead
  if (params.q !== seenQ) {
    setSeenQ(params.q)
    if (params.q !== sent) {
      setValue(params.q)
      setSent(params.q)
    }
  }

  function search(text: string) {
    const q = normalizeSearch(text)
    setSent(q)
    if (q === params.q) return
    const qs = serializeListParams({ ...params, q })
    router.replace(qs ? `/words?${qs}` : "/words", { scroll: false })
  }

  useEffect(() => {
    if (normalizeSearch(value) === sent) return
    const timer = setTimeout(() => search(value), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- search only reads the latest params
  }, [value, sent, params])

  function clear() {
    setValue("")
    search("")
    inputRef.current?.focus()
  }

  return (
    <form
      role="search"
      className="relative"
      onSubmit={(e) => {
        e.preventDefault()
        search(value)
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        搜尋單字
      </label>
      <Search
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
      />
      <Input
        ref={inputRef}
        id={inputId}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        placeholder="搜尋單字"
        maxLength={SEARCH_MAX_LENGTH}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault()
            clear()
          }
        }}
        className="h-9 pr-9 pl-8"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="清除搜尋"
          onClick={clear}
          className="absolute top-1/2 right-0.5 -translate-y-1/2"
        >
          <X aria-hidden />
        </Button>
      )}
    </form>
  )
}
