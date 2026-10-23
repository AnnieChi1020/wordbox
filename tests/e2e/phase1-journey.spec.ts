import type { Page } from "@playwright/test"

import { expect, getWords, test } from "./fixtures"

/**
 * T1.14: the complete Phase 1 flow.
 * Sign in → add (valid / misspelled / duplicate) → filter and sort the list → edit in the popup → regenerate → delete
 */

const list = (page: Page) => page.getByRole("list", { name: "單字列表" })
const rowTexts = (page: Page) =>
  list(page)
    .getByRole("link")
    .evaluateAll((links) =>
      links.map((a) => a.querySelector("span")!.textContent),
    )

async function add(page: Page, text: string) {
  await page.getByRole("textbox", { name: "新增單字" }).fill(text)
  await page.getByRole("button", { name: "新增" }).click()
}

async function closePopup(page: Page) {
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
}

test("Phase 1 使用流程", async ({ page, signedIn }) => {
  test.slow()

  await test.step("登入後進入單字頁的空狀態", async () => {
    await page.goto("/")
    await expect(page).toHaveURL("/words")
    await expect(page.getByText("還沒有任何單字")).toBeVisible()
  })

  await test.step("新增有效的字：run、give up、monday", async () => {
    await add(page, "run")
    await expect(page.getByRole("dialog", { name: "run" })).toBeVisible()
    await closePopup(page)

    await add(page, "  GIVE   up ")
    await expect(page.getByRole("dialog", { name: "give up" })).toBeVisible()
    await closePopup(page)

    await add(page, "monday")
    await expect(page.getByRole("dialog", { name: "Monday" })).toBeVisible()
    await closePopup(page)

    await expect
      .poll(() => rowTexts(page))
      .toEqual(["Monday", "give up", "run"])
  })

  await test.step("拼錯的字：點選建議後新增", async () => {
    await add(page, "aple")
    await expect(page.getByText("找不到「aple」這個字")).toBeVisible()
    await page.getByRole("button", { name: "apple", exact: true }).click()
    await expect(page.getByRole("dialog", { name: "apple" })).toBeVisible()
    await closePopup(page)
  })

  await test.step("重複的字：不重新生成，直接開啟", async () => {
    await add(page, "RUN")
    await expect(page.getByText("這個字已經在你的列表裡")).toBeVisible()
    await expect(page.getByRole("dialog", { name: "run" })).toBeVisible()
    await closePopup(page)
    expect(await getWords(signedIn.id)).toHaveLength(4)
  })

  await test.step("標記重要、篩選與排序，重新整理後保留", async () => {
    const runRow = list(page).getByRole("listitem").filter({ hasText: /^run/ })
    await runRow.getByRole("button", { name: "重要", exact: true }).click()
    await expect(
      runRow.getByRole("button", { name: "重要", exact: true }),
    ).toHaveAttribute("aria-pressed", "true")

    await page.getByRole("combobox", { name: "排序" }).selectOption("alpha_asc")
    await expect
      .poll(() => rowTexts(page))
      .toEqual(["apple", "give up", "Monday", "run"])

    await page.getByRole("button", { name: "只看重要" }).click()
    await expect.poll(() => rowTexts(page)).toEqual(["run"])

    await page.reload()
    await expect.poll(() => rowTexts(page)).toEqual(["run"])
    await expect(page).toHaveURL("/words?important=1&sort=alpha_asc")

    await page.getByRole("button", { name: "清除篩選" }).click()
    await expect.poll(() => rowTexts(page)).toHaveLength(4)
  })

  await test.step("在 popup 編輯同義詞", async () => {
    await list(page)
      .getByRole("link", { name: /^give up/ })
      .click()
    const dialog = page.getByRole("dialog", { name: "give up" })
    await dialog.getByRole("button", { name: "編輯" }).click()
    await dialog
      .getByLabel(/同義詞/)
      .first()
      .fill("quit, abandon, throw in the towel")
    await dialog.getByRole("button", { name: "儲存" }).click()
    await expect(dialog.getByRole("list", { name: "義項" })).toContainText(
      "throw in the towel",
    )
    await closePopup(page)
  })

  await test.step("重新生成會取代內容", async () => {
    await list(page)
      .getByRole("link", { name: /^give up/ })
      .click()
    const dialog = page.getByRole("dialog", { name: "give up" })
    await dialog.getByRole("button", { name: "重新生成" }).click()
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "重新生成" })
      .click()
    await expect(page.getByText("已重新生成")).toBeVisible()
    await expect(dialog.getByRole("list", { name: "義項" })).not.toContainText(
      "throw in the towel",
    )
    await closePopup(page)
  })

  await test.step("刪除後從列表移除", async () => {
    await list(page)
      .getByRole("link", { name: /^apple/ })
      .click()
    await page
      .getByRole("dialog", { name: "apple" })
      .getByRole("button", { name: "刪除" })
      .click()
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "刪除" })
      .click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect
      .poll(() => rowTexts(page))
      .toEqual(["give up", "Monday", "run"])
    expect((await getWords(signedIn.id)).map((w) => w.text).sort()).toEqual([
      "Monday",
      "give up",
      "run",
    ])
  })

  await test.step("登出", async () => {
    await page.getByRole("button", { name: "登出" }).click()
    await expect(page).toHaveURL("/login")
  })
})
