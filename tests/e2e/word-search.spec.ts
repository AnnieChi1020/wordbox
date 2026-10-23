import type { Page } from "@playwright/test"

import { expect, seedWords, test } from "./fixtures"

function rows(page: Page) {
  return page.getByRole("list", { name: "單字列表" }).getByRole("listitem")
}

async function visibleTexts(page: Page) {
  return rows(page)
    .getByRole("link")
    .evaluateAll((links) =>
      links.map((a) => a.querySelector("span")!.textContent),
    )
}

function searchBox(page: Page) {
  return page.getByRole("search").getByRole("textbox", { name: "搜尋單字" })
}

test.describe("單字搜尋（R3.9）", () => {
  test.beforeEach(async ({ page, signedIn }) => {
    await seedWords(signedIn.id, [
      { text: "give up", box: 0 },
      { text: "upset", box: 1 },
      { text: "apple", box: 1 },
      { text: "Monday", box: 2 },
    ])
    await page.goto("/words?sort=alpha_asc")
    await expect.poll(() => visibleTexts(page)).toHaveLength(4)
  })

  test("部分比對、不分大小寫，重新整理後保留", async ({ page }) => {
    await searchBox(page).fill("UP")
    await expect(page).toHaveURL("/words?q=up&sort=alpha_asc")
    await expect.poll(() => visibleTexts(page)).toEqual(["give up", "upset"])

    await searchBox(page).fill("APP")
    await expect.poll(() => visibleTexts(page)).toEqual(["apple"])

    // AC: kept after a reload
    await page.reload()
    await expect(searchBox(page)).toHaveValue("app")
    await expect.poll(() => visibleTexts(page)).toEqual(["apple"])
  })

  test("與星數篩選同時生效", async ({ page }) => {
    await page.getByRole("button", { name: "1 星" }).click()
    await expect.poll(() => visibleTexts(page)).toEqual(["apple", "upset"])
    await searchBox(page).fill("up")
    await expect.poll(() => visibleTexts(page)).toEqual(["upset"])
    await expect(page).toHaveURL("/words?q=up&stars=1&sort=alpha_asc")
  })

  test("% 不會比對到所有字；無結果時可清除搜尋與篩選（R3.8）", async ({
    page,
  }) => {
    await searchBox(page).fill("%")
    await expect(page.getByText("沒有符合條件的單字")).toBeVisible()

    await page.getByRole("main").getByRole("link", { name: "清除篩選" }).click()
    await expect(page).toHaveURL("/words?sort=alpha_asc")
    await expect(searchBox(page)).toHaveValue("")
    await expect.poll(() => visibleTexts(page)).toHaveLength(4)
  })

  test("輸入時不新增瀏覽紀錄", async ({ page }) => {
    const before = await page.evaluate(() => history.length)
    await searchBox(page).pressSequentially("give", { delay: 50 })
    await expect.poll(() => visibleTexts(page)).toEqual(["give up"])
    await searchBox(page).fill("mon")
    await expect.poll(() => visibleTexts(page)).toEqual(["Monday"])
    expect(await page.evaluate(() => history.length)).toBe(before)
  })

  test("可用鍵盤清除搜尋（NFR5）", async ({ page }) => {
    await searchBox(page).fill("up")
    await expect.poll(() => visibleTexts(page)).toHaveLength(2)

    await page.getByRole("button", { name: "清除搜尋" }).focus()
    await page.keyboard.press("Enter")
    await expect(searchBox(page)).toHaveValue("")
    await expect(searchBox(page)).toBeFocused()
    await expect.poll(() => visibleTexts(page)).toHaveLength(4)

    // Esc also clears
    await searchBox(page).fill("app")
    await expect.poll(() => visibleTexts(page)).toEqual(["apple"])
    await page.keyboard.press("Escape")
    await expect(searchBox(page)).toHaveValue("")
    await expect(page).toHaveURL("/words?sort=alpha_asc")
  })

  test("開啟與關閉 popup 後保留搜尋", async ({ page }) => {
    await searchBox(page).fill("up")
    await expect.poll(() => visibleTexts(page)).toHaveLength(2)
    await rows(page).getByRole("link").first().click()
    await expect(page).toHaveURL(
      /\/words\?q=up&sort=alpha_asc&word=[0-9a-f-]{36}$/,
    )
    await page.keyboard.press("Escape")
    await expect(page).toHaveURL("/words?q=up&sort=alpha_asc")
    await expect(searchBox(page)).toHaveValue("up")
    await expect.poll(() => visibleTexts(page)).toEqual(["give up", "upset"])
  })
})
