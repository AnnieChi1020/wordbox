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

const SORT = () => ({ name: "排序" })

test("沒有單字時顯示空狀態與新增引導（R3.7）", async ({ page, signedIn }) => {
  void signedIn
  await page.goto("/words")
  await expect(page.getByText("還沒有任何單字")).toBeVisible()
  await expect(page.getByRole("combobox", SORT())).toHaveCount(0)
})

test("每列顯示單字、詞性 tag、星數與 important（R3.1）", async ({
  page,
  signedIn,
}) => {
  await seedWords(signedIn.id, [
    { text: "run", box: 3, important: true, pos: ["verb", "noun", "verb"] },
  ])
  await page.goto("/words")
  const row = rows(page).first()
  await expect(row).toContainText("run")
  // Parts of speech are deduplicated in sense order
  await expect(row.getByText(/^(v\.|n\.)$/)).toHaveText(["v.", "n."])
  // AC: box 3 → 3 filled, 2 empty
  const stars = row.getByRole("img", { name: "熟悉度 3 / 5" })
  await expect(stars).toBeVisible()
  await expect(stars.locator("[data-filled]")).toHaveCount(3)
  await expect(stars.locator("svg:not([data-filled])")).toHaveCount(2)
  await expect(
    row.getByRole("button", { name: "重要", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
})

test("單字太長時換行，星數維持在右側同一位置", async ({ page, signedIn }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await seedWords(signedIn.id, [
    { text: "run", box: 2 },
    {
      text: "bring home the bacon every single day",
      box: 2,
      pos: ["phrase"],
    },
  ])
  await page.goto("/words")
  const row = (text: string) =>
    page
      .getByRole("list", { name: "單字列表" })
      .getByRole("listitem")
      .filter({ hasText: text })
  const stars = (text: string) =>
    row(text).getByRole("img", { name: "熟悉度 2 / 5" })

  const short = (await stars("run").boundingBox())!
  const long = (await stars("bring home").boundingBox())!
  expect(long.x).toBeCloseTo(short.x, 0)
  expect(long.width).toBeCloseTo(short.width, 0)

  // A long phrase wraps, so its row is taller than a short word's row
  const shortRow = (await row("run").boundingBox())!
  const longRow = (await row("bring home").boundingBox())!
  expect(longRow.height).toBeGreaterThan(shortRow.height)
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test("新增的單字會出現在列表最上方", async ({ page, signedIn }) => {
  await seedWords(signedIn.id, [{ text: "older" }])
  await page.goto("/words")
  await page.getByRole("textbox", { name: "新增單字" }).fill("apple")
  await page.getByRole("button", { name: "新增" }).click()
  await expect(page.getByRole("dialog", { name: "apple" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect.poll(() => visibleTexts(page)).toEqual(["apple", "older"])
})

test.describe("篩選與排序", () => {
  test.beforeEach(async ({ page, signedIn }) => {
    // By date added, oldest to newest
    await seedWords(signedIn.id, [
      { text: "banana", box: 0 },
      { text: "Apple", box: 1, important: true },
      { text: "cherry", box: 2 },
      { text: "date", box: 0, important: true },
      { text: "Elder", box: 1 },
      { text: "fig", box: 5, important: true },
    ])
    await page.goto("/words")
  })

  test("預設依新增日期新→舊", async ({ page }) => {
    await expect(page.getByRole("combobox", SORT())).toHaveValue("created_desc")
    await expect
      .poll(() => visibleTexts(page))
      .toEqual(["fig", "Elder", "date", "cherry", "Apple", "banana"])
  })

  const sorts = [
    ["created_asc", ["banana", "Apple", "cherry", "date", "Elder", "fig"]],
    ["alpha_asc", ["Apple", "banana", "cherry", "date", "Elder", "fig"]],
    ["alpha_desc", ["fig", "Elder", "date", "cherry", "banana", "Apple"]],
    // Same star count: by date added, newest first
    ["stars_asc", ["date", "banana", "Elder", "Apple", "cherry", "fig"]],
    ["stars_desc", ["fig", "cherry", "Elder", "Apple", "date", "banana"]],
  ] as const

  for (const [sort, expected] of sorts) {
    test(`排序 ${sort}（R3.3）`, async ({ page }) => {
      await page.getByRole("combobox", SORT()).selectOption(sort)
      await expect(page).toHaveURL(`/words?sort=${sort}`)
      await expect.poll(() => visibleTexts(page)).toEqual([...expected])
    })
  }

  test("AC：選擇「字母 A→Z」後重新整理，排序仍保留（R3.4）", async ({
    page,
  }) => {
    await page.getByRole("combobox", SORT()).selectOption("alpha_asc")
    await expect(page).toHaveURL("/words?sort=alpha_asc")
    await page.reload()
    await expect(page.getByRole("combobox", SORT())).toHaveValue("alpha_asc")
    await expect
      .poll(() => visibleTexts(page))
      .toEqual(["Apple", "banana", "cherry", "date", "Elder", "fig"])
  })

  test("AC：「0 星 + 1 星」與「只看重要」可同時生效（R3.2）", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "0 星" }).click()
    await page.getByRole("button", { name: "1 星" }).click()
    await expect
      .poll(() => visibleTexts(page))
      .toEqual(["Elder", "date", "Apple", "banana"])
    await page.getByRole("button", { name: "只看重要" }).click()
    await expect(page).toHaveURL("/words?stars=0%2C1&important=1")
    await expect.poll(() => visibleTexts(page)).toEqual(["date", "Apple"])
    await expect(page.getByRole("button", { name: "0 星" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )

    // Kept after a reload
    await page.reload()
    await expect.poll(() => visibleTexts(page)).toEqual(["date", "Apple"])
    await expect(
      page.getByRole("button", { name: "只看重要" }),
    ).toHaveAttribute("aria-pressed", "true")
  })

  test("篩選無結果時顯示提示並可清除篩選（R3.8）", async ({ page }) => {
    await page.getByRole("combobox", SORT()).selectOption("alpha_asc")
    await page.getByRole("button", { name: "4 星" }).click()
    await expect(page.getByText("沒有符合條件的單字")).toBeVisible()

    await page.getByRole("main").getByRole("link", { name: "清除篩選" }).click()
    // Clear the filters but keep the sort order
    await expect(page).toHaveURL("/words?sort=alpha_asc")
    await expect.poll(() => visibleTexts(page)).toHaveLength(6)
  })

  test("點擊單字列以 ?word=<id> 開啟並保留篩選（R3.6）", async ({ page }) => {
    await page.getByRole("button", { name: "5 星" }).click()
    await expect.poll(() => visibleTexts(page)).toEqual(["fig"])
    await rows(page).getByRole("link").first().click()
    await expect(page).toHaveURL(/\/words\?stars=5&word=[0-9a-f-]{36}$/)
  })
})

test("超過 100 個字時捲動或按鈕載入下一頁，並沿用排序（design D11）", async ({
  page,
  signedIn,
}) => {
  const code = (i: number) =>
    Array.from(
      { length: 3 },
      (_, k) => "abcdefghij"[Math.floor(i / 10 ** (2 - k)) % 10],
    ).join("")
  await seedWords(
    signedIn.id,
    Array.from({ length: 230 }, (_, i) => ({ text: `w ${code(i)}` })),
  )
  await page.goto("/words?sort=alpha_asc")
  await expect(page.getByText("230 個單字")).toBeVisible()
  await expect(rows(page)).toHaveCount(100)

  // Scrolling to the bottom loads more automatically
  await page.getByRole("button", { name: /載入更多/ }).scrollIntoViewIfNeeded()
  await expect(rows(page)).toHaveCount(200)

  // The button also works from the keyboard
  const more = page.getByRole("button", { name: "載入更多（還有 30 個）" })
  await more.focus()
  await page.keyboard.press("Enter")
  await expect(rows(page)).toHaveCount(230)
  await expect(page.getByRole("button", { name: /載入更多/ })).toHaveCount(0)

  const texts = await visibleTexts(page)
  expect(texts).toEqual([...texts].sort())
  expect(new Set(texts).size).toBe(230)
})
