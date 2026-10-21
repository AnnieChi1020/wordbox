import type { Page } from "@playwright/test"

import { adminClient } from "../support/local-supabase"
import { expect, getWords, seedWords, test } from "./fixtures"
import {
  correctAnswer,
  option,
  reviewLogs,
  wrongOption,
} from "./review-helpers"

/** T2.10：Phase 2 完整流程與 R7 的 AC。 */

async function startRound(page: Page, total: number) {
  await page.goto("/review")
  await page.getByRole("button", { name: "開始複習" }).click()
  await expect(page.getByText(`1 / ${total}`)).toBeVisible()
}

async function next(page: Page, isLast: boolean) {
  await page.getByRole("button", { name: isLast ? "看結果" : "下一題" }).click()
}

function rowStars(page: Page, text: string) {
  return page
    .getByRole("list", { name: "單字列表" })
    .getByRole("listitem")
    .filter({ hasText: new RegExp(`^${text}`) })
    .getByRole("img", { name: /熟悉度/ })
}

test("Phase 2 使用流程", async ({ page, signedIn }) => {
  test.slow()

  await test.step("沒有單字時引導去新增（R5.2）", async () => {
    await page.goto("/review")
    await expect(page.getByText("還沒有可以複習的單字")).toBeVisible()
    await page.getByRole("link", { name: "去新增單字" }).click()
    await expect(page).toHaveURL("/words")
  })

  await test.step("新增 2 個字", async () => {
    for (const text of ["apple", "pear"]) {
      await page.getByRole("textbox", { name: "新增單字" }).fill(text)
      await page.getByRole("button", { name: "新增" }).click()
      await expect(page.getByRole("dialog", { name: text })).toBeVisible()
      await page.keyboard.press("Escape")
      await expect(page.getByRole("dialog")).toHaveCount(0)
    }
  })

  await test.step("只有 2 個字也能完成一輪（R7 AC：干擾選項由 AI 補足）", async () => {
    await page.getByRole("link", { name: "複習" }).first().click()
    await expect(page.getByText("今天有 2 個字到期")).toBeVisible()
    await page.getByRole("button", { name: "開始複習" }).click()
    for (const n of [1, 2]) {
      await expect(page.getByText(`${n} / 2`)).toBeVisible()
      await expect(
        page.getByRole("list", { name: "選項" }).getByRole("button"),
      ).toHaveCount(4)
      await page.keyboard.press("1")
      await next(page, n === 2)
    }
  })

  await test.step("結算畫面與資料庫一致（R7.5）", async () => {
    const logs = await reviewLogs(signedIn.id)
    expect(logs).toHaveLength(2)
    const correct = logs.filter((l) => l.is_correct).length
    await expect(
      page.getByRole("heading", { name: `答對 ${correct} / 2 題` }),
    ).toBeVisible()
    await expect(page.getByText("今天到期的字都複習完了")).toBeVisible()
  })

  await test.step("回單字列表，星數已更新", async () => {
    await page.getByRole("link", { name: "回單字列表" }).click()
    await expect(page).toHaveURL("/words")
    // 新字答對或答錯都變成 box 1
    for (const text of ["apple", "pear"]) {
      await expect(rowStars(page, text)).toHaveAccessibleName("熟悉度 1 / 5")
    }
  })
})

test("答對與答錯後列表的星數正確變化（R7.4）", async ({ page, signedIn }) => {
  await seedWords(signedIn.id, [
    { text: "apple", box: 3 },
    { text: "pear", box: 3 },
  ])
  await startRound(page, 2)

  // 第 1 題答對、第 2 題答錯
  const right = await correctAnswer(page)
  await option(page, right).click()
  await next(page, false)
  await expect(page.getByText("2 / 2")).toBeVisible()
  await (await wrongOption(page, await correctAnswer(page))).click()
  await next(page, true)

  const results = page.getByRole("list", { name: "這一輪的結果" })
  await expect(results.getByRole("img", { name: "熟悉度 4 / 5" })).toHaveCount(
    1,
  )
  await expect(results.getByRole("img", { name: "熟悉度 1 / 5" })).toHaveCount(
    1,
  )

  await page.goto("/words")
  const boxes = Object.fromEntries(
    (await getWords(signedIn.id)).map((w) => [w.text, w.box]),
  )
  expect(Object.values(boxes).sort()).toEqual([1, 4])
  for (const [text, box] of Object.entries(boxes)) {
    await expect(rowStars(page, text)).toHaveAccessibleName(`熟悉度 ${box} / 5`)
  }
})

test("作答 3 題後離開頁面，前 3 題已寫入紀錄（R7 AC）", async ({
  page,
  signedIn,
}) => {
  await seedWords(
    signedIn.id,
    ["apple", "pear", "plum", "grape", "lemon"].map((text) => ({ text })),
  )
  await startRound(page, 5)
  for (const n of [1, 2, 3]) {
    await expect(page.getByText(`${n} / 5`)).toBeVisible()
    await page.keyboard.press("1")
    await expect(page.getByRole("button", { name: "下一題" })).toBeVisible()
    if (n < 3) await next(page, false)
  }

  // 第 4 題前離開
  await page.goto("/words")
  expect(await reviewLogs(signedIn.id)).toHaveLength(3)
  const { data } = await adminClient()
    .from("words")
    .select("text, box")
    .eq("user_id", signedIn.id)
  expect(data!.filter((w) => w.box === 1)).toHaveLength(3)
  expect(data!.filter((w) => w.box === 0)).toHaveLength(2)
})
