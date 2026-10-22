"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"

import {
  buildHeatmapGrid,
  weekday,
  type HeatmapCell,
} from "@/lib/domain/heatmap"
import { cn } from "@/lib/utils"

const CELL = 12
const GAP = 3
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"]
/** 左側只標示週日、二、四、六（design §8.1） */
const DAY_LABEL_ROWS = new Set([0, 2, 4, 6])
const LEVEL_BG = [
  "bg-heat-0",
  "bg-heat-1",
  "bg-heat-2",
  "bg-heat-3",
  "bg-heat-4",
] as const
const LEVEL_RANGES = ["0 題", "1–8 題", "9–16 題", "17–32 題", "33 題以上"]

type Pos = { week: number; day: number }
/** tooltip 的位置（可捲動內容中的座標）與對齊方式 */
type Active = Pos & { x: number; y: number; transform: string }

function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  return `${y} 年 ${m} 月 ${d} 日（${WEEKDAYS[weekday(date)]}）`
}

function cellLabel(cell: HeatmapCell): string {
  return `${formatDate(cell.date)}：${cell.count} 題`
}

/** 每週有某月 1 日時，在該欄上方標示月份。 */
function monthLabels(grid: (HeatmapCell | null)[][]) {
  const labels: { week: number; text: string }[] = []
  grid.forEach((week, i) => {
    const first = week.find((c) => c?.date.endsWith("-01"))
    if (!first) return
    // 與前一個標籤太近時略過，避免文字重疊
    if (labels.length && i - labels.at(-1)!.week < 3) return
    labels.push({ week: i, text: `${Number(first.date.slice(5, 7))}月` })
  })
  return labels
}

/**
 * R8.3–R8.5：最近 53 週的每日答題數。
 * hover、點擊或鍵盤焦點時顯示 tooltip；整張圖只有一個 Tab 停點，以方向鍵移動（NFR5）。
 */
export function Heatmap({
  daily,
  today,
}: {
  daily: [date: string, count: number][]
  today: string
}) {
  const grid = useMemo(
    () => buildHeatmapGrid(new Map(daily), today),
    [daily, today],
  )
  const todayPos: Pos = { week: grid.length - 1, day: weekday(today) }
  const [focus, setFocus] = useState<Pos>(todayPos)
  const [active, setActive] = useState<Active | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef(new Map<string, HTMLDivElement>())

  // 手機寬度預設顯示最近幾週
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  const cells = grid.flat().filter((c): c is HeatmapCell => c !== null)
  const total = cells.reduce((sum, c) => sum + c.count, 0)
  const activeDays = cells.filter((c) => c.count > 0).length

  function activate(pos: Pos | null) {
    const el = pos && cellRefs.current.get(`${pos.week}-${pos.day}`)
    if (!pos || !el) return setActive(null)
    // offsetParent 為 relative 的熱力圖容器（中間的 row、grid 是 display: contents）
    const width = (el.offsetParent as HTMLElement | null)?.offsetWidth ?? 0
    // 捲動容器會裁切超出的部分：靠近左右邊緣時改為靠邊對齊，前兩列顯示在格子下方
    const edge = 120
    const [x, tx] =
      el.offsetLeft < edge
        ? [el.offsetLeft, "0%"]
        : el.offsetLeft > width - edge
          ? [el.offsetLeft + CELL, "-100%"]
          : [el.offsetLeft + CELL / 2, "-50%"]
    const below = pos.day < 2
    setActive({
      ...pos,
      x,
      y: below ? el.offsetTop + CELL + 6 : el.offsetTop - 6,
      transform: `translate(${tx}, ${below ? "0%" : "-100%"})`,
    })
  }

  function focusCell(pos: Pos) {
    setFocus(pos)
    activate(pos)
    cellRefs.current.get(`${pos.week}-${pos.day}`)?.focus()
  }

  function onKeyDown(e: KeyboardEvent) {
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }
    if (e.key === "Escape") {
      activate(null)
      return
    }
    let next: Pos | null = null
    if (e.key in delta) {
      const [dw, dd] = delta[e.key]
      next = { week: focus.week + dw, day: focus.day + dd }
    } else if (e.key === "Home") {
      next = { week: 0, day: focus.day }
    } else if (e.key === "End") {
      next = todayPos
    }
    if (!next) return
    e.preventDefault()
    // 超出範圍或今天之後的格子不移動
    if (grid[next.week]?.[next.day]) focusCell(next)
  }

  const activeCell = active ? grid[active.week][active.day] : null

  return (
    <section aria-labelledby="heatmap-heading" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="heatmap-heading" className="font-medium">
          每日答題數
        </h2>
        <p className="text-muted-foreground text-sm">
          過去一年共答 {total} 題，作答 {activeDays} 天
        </p>
      </div>

      <div ref={scrollRef} className="overflow-x-auto pb-2">
        <div
          className="relative inline-grid"
          style={{
            gridTemplateColumns: `auto repeat(${grid.length}, ${CELL}px)`,
            gridTemplateRows: `auto repeat(7, ${CELL}px)`,
            gap: GAP,
          }}
        >
          {monthLabels(grid).map(({ week, text }) => (
            <span
              key={week}
              aria-hidden
              className="text-muted-foreground text-xs whitespace-nowrap"
              style={{ gridColumn: week + 2, gridRow: 1 }}
            >
              {text}
            </span>
          ))}
          {/* 左側標籤欄：一整條固定不捲動的底色，捲動時格子不會從縫隙露出 */}
          <div
            aria-hidden
            className="bg-background sticky left-0 z-[1] grid pr-1"
            style={{
              gridColumn: 1,
              gridRow: "1 / -1",
              gridTemplateRows: "subgrid",
              marginRight: -GAP,
              paddingRight: GAP + 4,
            }}
          >
            {WEEKDAYS.map((label, day) => (
              <span
                key={day}
                className="text-muted-foreground text-xs leading-3"
                style={{ gridRow: day + 2 }}
              >
                {DAY_LABEL_ROWS.has(day) ? label : ""}
              </span>
            ))}
          </div>

          <div
            ref={gridRef}
            role="grid"
            aria-label="每日答題數熱力圖，以方向鍵移動"
            className="contents"
            onKeyDown={onKeyDown}
            onPointerLeave={() =>
              activate(
                gridRef.current?.contains(document.activeElement)
                  ? focus
                  : null,
              )
            }
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                activate(null)
              }
            }}
          >
            {WEEKDAYS.map((_, day) => (
              <div key={day} role="row" className="contents">
                {grid.map((week, w) => {
                  const cell = week[day]
                  if (!cell) return null
                  const pos = { week: w, day }
                  const isFocus = focus.week === w && focus.day === day
                  const isActive = active?.week === w && active.day === day
                  return (
                    <div
                      key={w}
                      ref={(el) => {
                        const key = `${w}-${day}`
                        if (el) cellRefs.current.set(key, el)
                        else cellRefs.current.delete(key)
                      }}
                      role="gridcell"
                      tabIndex={isFocus ? 0 : -1}
                      aria-label={cellLabel(cell)}
                      data-date={cell.date}
                      data-level={cell.level}
                      data-active={isActive || undefined}
                      onPointerEnter={() => activate(pos)}
                      onClick={() => focusCell(pos)}
                      onFocus={() => {
                        setFocus(pos)
                        activate(pos)
                      }}
                      className={cn(
                        "rounded-[2px] outline-none",
                        LEVEL_BG[cell.level],
                        "data-active:ring-foreground data-active:ring-2",
                        "focus-visible:ring-foreground focus-visible:ring-2",
                      )}
                      style={{ gridColumn: w + 2, gridRow: day + 2 }}
                    />
                  )
                })}
              </div>
            ))}
          </div>

          {active && activeCell && (
            <div
              aria-hidden
              className="bg-popover text-popover-foreground pointer-events-none absolute z-10 rounded-md border px-2 py-1 text-xs whitespace-nowrap shadow-md"
              style={{
                left: active.x,
                top: active.y,
                transform: active.transform,
              }}
            >
              <strong className="text-sm">{activeCell.count} 題</strong>
              <span className="text-muted-foreground ml-1.5">
                {formatDate(activeCell.date)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        aria-label="圖例：顏色越深答題數越多"
        className="text-muted-foreground flex items-center justify-end gap-1 text-xs"
      >
        <span className="mr-1">少</span>
        {LEVEL_BG.map((bg, level) => (
          <span
            key={level}
            title={LEVEL_RANGES[level]}
            className={cn("size-3 rounded-[2px]", bg)}
          />
        ))}
        <span className="ml-1">多</span>
      </div>

      <details className="text-sm">
        <summary className="text-muted-foreground cursor-pointer">
          以表格檢視
        </summary>
        {activeDays === 0 ? (
          <p className="text-muted-foreground mt-2">還沒有作答紀錄</p>
        ) : (
          <table className="mt-2 w-full max-w-xs">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="font-normal">日期</th>
                <th className="text-right font-normal">題數</th>
              </tr>
            </thead>
            <tbody>
              {cells
                .filter((c) => c.count > 0)
                .reverse()
                .map((c) => (
                  <tr key={c.date}>
                    <td>{formatDate(c.date)}</td>
                    <td className="text-right tabular-nums">{c.count}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </details>
    </section>
  )
}
