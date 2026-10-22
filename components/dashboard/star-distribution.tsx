import { Stars } from "@/components/words/stars"

/**
 * R8.2：0–5 星各有幾個字。單一系列，所有長條同色；數量直接標在每列右側（不需圖例）。
 * 螢幕閱讀器依序讀到「熟悉度 n / 5」與「m 個字」。
 */
export function StarDistribution({ byBox }: { byBox: number[] }) {
  const max = Math.max(...byBox, 1)
  return (
    <section aria-labelledby="star-distribution" className="max-w-xl space-y-3">
      <h2 id="star-distribution" className="font-medium">
        熟悉度分布
      </h2>
      <ul className="space-y-2">
        {byBox.map((count, box) => (
          <li
            key={box}
            className="grid grid-cols-[auto_1fr_3rem] items-center gap-3"
          >
            <Stars box={box} />
            <div aria-hidden className="h-4">
              <div
                className="bg-chart-bar h-full rounded-r-[4px]"
                style={{
                  width: `${(count / max) * 100}%`,
                  minWidth: count > 0 ? 2 : 0,
                }}
              />
            </div>
            <span className="text-right text-sm tabular-nums">
              {count}
              <span className="sr-only"> 個字</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
