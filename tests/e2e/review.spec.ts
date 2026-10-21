import type { Page } from "@playwright/test"

import { adminClient } from "../support/local-supabase"
import { expect, seedWords, test } from "./fixtures"

/**
 * seedWords 的中文解釋為「<word> 的解釋」且沒有同義詞，
 * 因此只會出 word_to_zh 或 zh_to_word，可由題目推得正確答案。
 */
async function correctAnswer(page: Page): Promise<string> {
  const heading = page.getByRole("heading", { level: 2 })
  const prompt = (await heading.locator("span").first().textContent())!.trim()
  const text = (await heading.textContent())!
  return text.includes("的英文是")
    ? prompt.replace(/ 的解釋$/, "")
    : `${prompt} 的解釋`
}

function option(page: Page, text: string) {
  return page
    .getByRole("list", { name: "選項" })
    .getByRole("button")
    .filter({ hasText: new RegExp(`^\\d${escape(text)}`) })
}

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function wrongOption(page: Page, answer: string) {
  const options = page.getByRole("list", { name: "選項" }).getByRole("button")
  for (const button of await options.all()) {
    const label = (await button.textContent())!.replace(/^\d/, "")
    if (label !== answer) return button
  }
  throw new Error("no wrong option")
}

async function reviewLogs(userId: string) {
  const { data } = await adminClient()
    .from("review_logs")
    .select("is_correct")
    .eq("user_id", userId)
  return data ?? []
}

test.describe("複習 UI（R7.1、R7.2）", () => {
  test.beforeEach(async ({ signedIn }) => {
    await seedWords(signedIn.id, [{ text: "apple" }, { text: "pear" }])
  })

  test("作答後鎖定並標示對錯，依序完成一輪", async ({ page, signedIn }) => {
    await page.goto("/review")
    await expect(page.getByText("今天有 2 個字到期")).toBeVisible()
    await page.getByRole("button", { name: "開始複習" }).click()

    // 第 1 題：答對
    await expect(page.getByText("1 / 2")).toBeVisible()
    const answer1 = await correctAnswer(page)
    await option(page, answer1).click()
    await expect(page.getByText("答對了！")).toBeVisible()
    await expect(option(page, answer1)).toHaveAttribute("data-state", "correct")
    for (const button of await page
      .getByRole("list", { name: "選項" })
      .getByRole("button")
      .all()) {
      await expect(button).toBeDisabled()
    }
    // 焦點在「下一題」，Enter 繼續（NFR5）
    await expect(page.getByRole("button", { name: "下一題" })).toBeFocused()
    await page.keyboard.press("Enter")

    // 第 2 題：答錯
    await expect(page.getByText("2 / 2")).toBeVisible()
    const answer2 = await correctAnswer(page)
    const wrong = await wrongOption(page, answer2)
    await wrong.click()
    await expect(
      page.getByText(`答錯了，正確答案是「${answer2}」`),
    ).toBeVisible()
    await expect(wrong).toHaveAttribute("data-state", "wrong")
    await expect(option(page, answer2)).toHaveAttribute("data-state", "correct")

    await expect
      .poll(async () =>
        (await reviewLogs(signedIn.id)).map((l) => l.is_correct).sort(),
      )
      .toEqual([false, true])

    await page.getByRole("button", { name: "看結果" }).click()
    await expect(page.getByText("答對 1 / 2 題")).toBeVisible()
  })

  test("可以用數字鍵作答（NFR5）", async ({ page }) => {
    await page.goto("/review")
    await page.getByRole("button", { name: "開始複習" }).click()
    await expect(page.getByText("1 / 2")).toBeVisible()

    await page.keyboard.press("2")
    const second = page
      .getByRole("list", { name: "選項" })
      .getByRole("button")
      .nth(1)
    await expect(second).toHaveAttribute("data-state", /correct|wrong/)
  })

  test("判定失敗時可重試同一題", async ({ page, signedIn }) => {
    await page.goto("/review")
    await page.getByRole("button", { name: "開始複習" }).click()
    await expect(page.getByText("1 / 2")).toBeVisible()

    // 讓下一個 server action 請求失敗
    let failed = false
    await page.route("**/review", async (route) => {
      if (!failed && route.request().method() === "POST") {
        failed = true
        return route.abort()
      }
      return route.continue()
    })

    const answer = await correctAnswer(page)
    await option(page, answer).click()
    await expect(page.getByRole("button", { name: "重試" })).toBeVisible()
    expect(await reviewLogs(signedIn.id)).toEqual([])

    await page.getByRole("button", { name: "重試" }).click()
    await expect(page.getByText("答對了！")).toBeVisible()
    await expect
      .poll(async () => (await reviewLogs(signedIn.id)).length)
      .toBe(1)
  })
})
