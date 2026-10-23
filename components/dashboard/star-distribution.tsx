import { Stars } from "@/components/words/stars"

/**
 * R8.2: how many words have 0–5 stars. One series, so all bars share a color; counts are labeled at the right of each row (no legend needed).
 * Screen readers read 「熟悉度 n / 5」 (Familiarity n / 5) followed by 「m 個字」 (m words).
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
