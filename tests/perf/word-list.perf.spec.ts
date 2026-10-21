import { expect, seedWords, test } from "../e2e/fixtures"

const WORD_COUNT = 2000
const BUDGET_MS = 300 // NFR4

/** 依 seed 規則計算符合條件的字數 */
function countWhere(predicate: (i: number) => boolean) {
  return Array.from({ length: WORD_COUNT }, (_, i) => i).filter(predicate)
    .length
}

test(`${WORD_COUNT} 個字時篩選與排序在 ${BUDGET_MS}ms 內完成（NFR4）`, async ({
  page,
  signedIn,
}, info) => {
  // 10 位數的字母編碼確保 2,000 個字都不重複
  const code = (i: number) =>
    Array.from(
      { length: 10 },
      (_, k) => "abcdefghij"[Math.floor(i / 10 ** k) % 10],
    ).join("")
  await seedWords(
    signedIn.id,
    Array.from({ length: WORD_COUNT }, (_, i) => ({
      text: `word ${code(i)}`,
      box: i % 6,
      important: i % 5 === 0,
      pos: ["noun", "verb"].slice(0, (i % 2) + 1),
    })),
  )
  await page.goto("/words")
  await expect(page.getByText(`${WORD_COUNT} 個單字`)).toBeVisible()

  const list = page.getByRole("list", { name: "單字列表" })
  const firstRow = () => list.getByRole("link").first().textContent()
  const showsCount = (n: number) => async () =>
    (await page.getByText(`${n} 個單字`, { exact: true }).count()) > 0
  const timings: string[] = []

  async function measure(
    label: string,
    act: () => Promise<unknown>,
    done: () => Promise<boolean>,
  ) {
    const started = Date.now()
    await act()
    await expect.poll(done, { intervals: [5], timeout: 5000 }).toBe(true)
    const elapsed = Date.now() - started
    timings.push(`${label} ${elapsed}ms`)
    expect.soft(elapsed, label).toBeLessThan(BUDGET_MS)
    await page.waitForTimeout(200)
  }

  await measure(
    "篩選 0 星",
    () => page.getByRole("button", { name: "0 星" }).click(),
    showsCount(countWhere((i) => i % 6 === 0)),
  )
  await measure(
    "加選 1 星",
    () => page.getByRole("button", { name: "1 星" }).click(),
    showsCount(countWhere((i) => i % 6 <= 1)),
  )
  await measure(
    "只看重要",
    () => page.getByRole("button", { name: "只看重要" }).click(),
    showsCount(countWhere((i) => i % 6 <= 1 && i % 5 === 0)),
  )
  await measure(
    "清除篩選",
    () => page.getByRole("button", { name: "清除篩選" }).click(),
    showsCount(WORD_COUNT),
  )
  for (const sort of ["alpha_asc", "stars_desc", "created_asc"]) {
    const before = await firstRow()
    await measure(
      `排序 ${sort}`,
      () => page.getByRole("combobox", { name: "排序" }).selectOption(sort),
      async () => (await firstRow()) !== before,
    )
  }

  console.log(`[${info.project.name}] ${timings.join(" | ")}`)
})
