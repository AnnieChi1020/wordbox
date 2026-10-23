import type { Page } from "@playwright/test"

import { adminClient } from "../support/local-supabase"
import { expect, seedWords, test } from "./fixtures"

const WORD_URL = /\/words\?word=[0-9a-f-]{36}$/

async function addRun(page: Page) {
  await page.goto("/words")
  await page.getByRole("textbox", { name: "新增單字" }).fill("run")
  await page.getByRole("button", { name: "新增" }).click()
  await expect(page).toHaveURL(WORD_URL)
  const dialog = page.getByRole("dialog", { name: "run" })
  await expect(dialog).toBeVisible()
  return dialog
}

test("顯示單字的所有欄位（R4.1）", async ({ page, signedIn }) => {
  void signedIn
  const dialog = await addRun(page)
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText("/rʌn/")
  await expect(dialog.getByRole("img", { name: "熟悉度 0 / 5" })).toBeVisible()
  await expect(
    dialog.getByRole("button", { name: "重要", exact: true }),
  ).toHaveAttribute("aria-pressed", "false")

  const senses = dialog.getByRole("list", { name: "義項" }).locator("> li")
  await expect(senses).toHaveCount(3)
  const first = senses.first()
  await expect(first).toContainText("v.")
  await expect(first).toContainText("跑；奔跑")
  await expect(first).toContainText("to move quickly on your feet")
  await expect(first).toContainText("sprint")
  await expect(first).toContainText("walk")
  await expect(first.getByRole("list", { name: "例句" })).toContainText(
    "I run in the park every morning.",
  )
})

test("重新整理後 popup 仍開啟（R4.9）", async ({ page, signedIn }) => {
  void signedIn
  await addRun(page)
  await page.reload()
  await expect(page.getByRole("dialog", { name: "run" })).toBeVisible()
})

test.describe("關閉 popup（R4.8）", () => {
  test.beforeEach(async ({ page, signedIn }) => {
    await seedWords(signedIn.id, [{ text: "apple" }])
    await page.goto("/words?sort=alpha_asc")
    await page
      .getByRole("list", { name: "單字列表" })
      .getByRole("link")
      .first()
      .click()
    await expect(page.getByRole("dialog", { name: "apple" })).toBeVisible()
  })

  const closed = async (page: Page) => {
    await expect(page.getByRole("dialog")).toHaveCount(0)
    // Filters and sort order are kept after closing
    await expect(page).toHaveURL("/words?sort=alpha_asc")
  }

  test("關閉按鈕", async ({ page }) => {
    await page.getByRole("button", { name: "關閉" }).click()
    await closed(page)
  })

  test("Esc 鍵", async ({ page }) => {
    await page.keyboard.press("Escape")
    await closed(page)
  })

  test("點擊背景", async ({ page, isMobile }) => {
    test.skip(isMobile, "手機寬度為全螢幕，沒有背景可點")
    await page.mouse.click(5, 5)
    await closed(page)
  })

  test("瀏覽器上一頁", async ({ page }) => {
    await page.goBack()
    await closed(page)
  })
})

test("AC：375px 寬度下 popup 全螢幕且可捲動（R4.8）", async ({
  page,
  signedIn,
}) => {
  void signedIn
  await page.setViewportSize({ width: 375, height: 500 })
  const dialog = await addRun(page)
  // Wait for the opening animation (zoom-in) to finish
  await expect
    .poll(async () => {
      const box = (await dialog.boundingBox())!
      return [box.x, box.y, box.width, box.height].map(Math.round)
    })
    .toEqual([0, 0, 375, 500])

  const scroller = dialog.getByRole("list", { name: "義項" })
  const { scrollHeight, clientHeight } = await scroller.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }))
  expect(scrollHeight).toBeGreaterThan(clientHeight)
  await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight))
  await expect(dialog.getByText("Let's go for a")).toBeInViewport()
})

test("popup 開啟時焦點鎖定在其中（NFR5）", async ({ page, signedIn }) => {
  void signedIn
  const dialog = await addRun(page)
  // Focus moves into the popup only after it opens (next tick); start pressing Tab after that
  await expect
    .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)))
    .toBe(true)
  const visited = new Set<string>()
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab")
    // Base UI's focus guard pulls focus back into the popup on the next frame; press keys at a human-like pace
    await page.waitForTimeout(50)
    const where = await page.evaluate(() => {
      const active = document.activeElement
      const dialogEl = document.querySelector('[role="dialog"]')
      if (dialogEl?.contains(active))
        return (
          active!.getAttribute("aria-label") ??
          active!.textContent?.trim() ??
          ""
        )
      // No element in the page behind (input, navigation, list) may receive focus
      const page = document.querySelectorAll("header, main, nav")
      return [...page].some((el) => el.contains(active))
        ? `LEAKED ${active!.tagName} ${active!.textContent?.trim().slice(0, 20)}`
        : "guard"
    })
    expect(where).not.toMatch(/^LEAKED/)
    visited.add(where)
  }
  // Focus cycles through the controls inside the popup
  expect(visited).toContain("關閉")
  expect(visited).toContain("重要")
  await expect(dialog).toBeVisible()
})

test("在 popup 切換 important 會同步到列表", async ({ page, signedIn }) => {
  const [id] = await seedWords(signedIn.id, [{ text: "apple" }])
  await page.goto(`/words?word=${id}`)
  const dialog = page.getByRole("dialog", { name: "apple" })
  await dialog.getByRole("button", { name: "重要", exact: true }).click()
  await expect
    .poll(async () => {
      const { data } = await adminClient()
        .from("words")
        .select("is_important")
        .eq("id", id)
        .single()
      return data!.is_important
    })
    .toBe(true)

  await page.keyboard.press("Escape")
  await expect(
    page
      .getByRole("list", { name: "單字列表" })
      .getByRole("button", { name: "重要", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
})

test("無效或不屬於自己的 id 不開啟 popup", async ({ page, signedIn }) => {
  void signedIn
  for (const word of ["not-a-uuid", "00000000-0000-4000-8000-000000000000"]) {
    await page.goto(`/words?word=${word}`)
    await expect(page.getByRole("heading", { name: "單字" })).toBeVisible()
    await expect(page.getByRole("dialog")).toHaveCount(0)
  }
})

test.describe("發音（R4.2）", () => {
  test("以 en-US 朗讀單字", async ({ page, signedIn }) => {
    void signedIn
    await page.addInitScript(() => {
      const spoken: { text: string; lang: string }[] = []
      Object.assign(window, { __spoken: spoken })
      window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
        spoken.push({ text: u.text, lang: u.lang })
      }
    })
    const dialog = await addRun(page)
    await dialog.getByRole("button", { name: "朗讀 run" }).click()
    expect(
      await page.evaluate(
        () => (window as unknown as { __spoken: unknown }).__spoken,
      ),
    ).toEqual([{ text: "run", lang: "en-US" }])
  })

  test("瀏覽器不支援語音合成時隱藏按鈕", async ({ page, signedIn }) => {
    void signedIn
    await page.addInitScript(() => {
      // @ts-expect-error simulate an unsupported browser
      delete window.speechSynthesis
    })
    const dialog = await addRun(page)
    await expect(dialog.getByText("/rʌn/")).toBeVisible()
    await expect(dialog.getByRole("button", { name: /朗讀/ })).toHaveCount(0)
  })
})
