import { randomUUID } from "node:crypto"

import type { Page } from "@playwright/test"

import { adminClient } from "../support/local-supabase"
import { expect, seedWords, test } from "./fixtures"

/** The test user's timezone is null → today is computed in UTC */
const utcDate = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10)

async function seedLogs(userId: string, dates: Record<string, number>) {
  const rows = Object.entries(dates).flatMap(([localDate, n]) =>
    Array.from({ length: n }, () => ({
      user_id: userId,
      question_id: randomUUID(),
      question_type: "word_to_zh",
      is_correct: true,
      was_due: true,
      box_before: 0,
      box_after: 1,
      local_date: localDate,
    })),
  )
  const { error } = await adminClient().from("review_logs").insert(rows)
  if (error) throw error
}

const cell = (page: Page, date: string) =>
  page.getByRole("gridcell").and(page.locator(`[data-date="${date}"]`))

const starRow = (page: Page, box: number) =>
  page
    .getByRole("region", { name: "熟悉度分布" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("img", { name: `熟悉度 ${box} / 5` }) })

test.describe("Dashboard（R8）", () => {
  const today = utcDate()
  const yesterday = utcDate(-1)

  test.beforeEach(async ({ signedIn }) => {
    await seedWords(signedIn.id, [
      { text: "apple", box: 0 },
      { text: "pear", box: 0 },
      { text: "plum", box: 2 },
      { text: "grape", box: 5 },
    ])
    await seedLogs(signedIn.id, { [today]: 10, [yesterday]: 3 })
  })

  test("顯示總數、星數分布與熱力圖（R8.1–R8.4）", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(
      page.getByRole("region", { name: "總單字數" }).getByText("4"),
    ).toBeVisible()
    for (const [box, count] of [
      [0, 2],
      [1, 0],
      [2, 1],
      [3, 0],
      [4, 0],
      [5, 1],
    ]) {
      await expect(starRow(page, box)).toContainText(String(count))
    }

    // R8 AC: 10 answers today → the third level (level 2)
    await expect(cell(page, today)).toHaveAttribute("data-level", "2")
    await expect(cell(page, yesterday)).toHaveAttribute("data-level", "1")
    await expect(page.getByRole("gridcell")).toHaveCount(
      52 * 7 + new Date(`${today}T00:00:00Z`).getUTCDay() + 1,
    )
    await expect(page.getByText("過去一年共答 13 題，作答 2 天")).toBeVisible()
  })

  test("hover 或點擊格子顯示日期與題數（R8.5）", async ({ page }) => {
    await page.goto("/dashboard")
    await cell(page, today).hover()
    await expect(page.getByText("10 題", { exact: true })).toBeVisible()

    await cell(page, yesterday).click()
    await expect(page.getByText("3 題", { exact: true })).toBeVisible()
  })

  test("可以用鍵盤在格子間移動（NFR5）", async ({ page }) => {
    await page.goto("/dashboard")
    // The whole chart is a single Tab stop, on today by default
    await cell(page, today).focus()
    await expect(cell(page, today)).toBeFocused()
    await expect(cell(page, today)).toHaveAttribute("aria-label", /：10 題$/)
    await expect(page.locator('[role="gridcell"][tabindex="0"]')).toHaveCount(1)

    // When today is a Sunday there is no cell above; use the left and right keys instead
    await page.keyboard.press("ArrowLeft")
    const lastWeek = utcDate(-7)
    await expect(cell(page, lastWeek)).toBeFocused()
    await page.keyboard.press("End")
    await expect(cell(page, today)).toBeFocused()
    // Cells after today do not exist, so focus does not move
    await page.keyboard.press("ArrowRight")
    await expect(cell(page, today)).toBeFocused()
  })

  test("刪除單字後總數減 1，熱力圖不變（R8 AC、R4.7 AC）", async ({
    page,
    signedIn,
  }) => {
    await page.goto("/dashboard")
    await expect(cell(page, today)).toHaveAttribute("data-level", "2")

    await adminClient()
      .from("words")
      .delete()
      .eq("user_id", signedIn.id)
      .eq("text", "grape")
    await page.reload()
    await expect(
      page.getByRole("region", { name: "總單字數" }).getByText("3"),
    ).toBeVisible()
    await expect(starRow(page, 5)).toContainText("0")
    await expect(cell(page, today)).toHaveAttribute("data-level", "2")
    await expect(page.getByText("過去一年共答 13 題，作答 2 天")).toBeVisible()
  })

  test("360px 寬度沒有頁面水平捲動（NFR1）", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto("/dashboard")
    await expect(cell(page, today)).toBeVisible()
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test("沒有單字時顯示空狀態", async ({ page, signedIn }) => {
  expect(signedIn.id).toBeTruthy()
  await page.goto("/dashboard")
  await expect(page.getByText("還沒有任何單字")).toBeVisible()
  await page.getByRole("link", { name: "去新增單字" }).click()
  await expect(page).toHaveURL("/words")
})
