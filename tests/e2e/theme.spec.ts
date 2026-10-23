import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

/** Records whether <html> already has .dark right after the HTML is parsed (before hydration), to confirm there is no flash (R10.3) */
async function recordInitialTheme(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      ;(window as unknown as { __initialDark: boolean }).__initialDark =
        document.documentElement.classList.contains("dark")
    })
  })
}

const initialDark = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __initialDark: boolean }).__initialDark,
  )

const html = (page: Page) => page.locator("html")
const toggle = (page: Page) => page.getByRole("switch", { name: "深色模式" })

test.describe("系統為深色（R10.1）", () => {
  test.use({ colorScheme: "dark" })

  test("尚未切換過時以深色開啟，且載入時就已套用", async ({
    page,
    signedIn,
  }) => {
    expect(signedIn.id).toBeTruthy()
    await recordInitialTheme(page)
    await page.goto("/words")
    await expect(html(page)).toHaveClass(/\bdark\b/)
    expect(await initialDark(page)).toBe(true)
    await expect(toggle(page)).toHaveAttribute("aria-checked", "true")
  })

  test("關閉開關後重新整理仍為淺色，不再依系統設定（R10.2、R10.4）", async ({
    page,
    signedIn,
  }) => {
    expect(signedIn.id).toBeTruthy()
    await recordInitialTheme(page)
    await page.goto("/words")
    await toggle(page).click()
    await expect(html(page)).not.toHaveClass(/\bdark\b/)
    await expect(toggle(page)).toHaveAttribute("aria-checked", "false")

    await page.reload()
    await expect(html(page)).not.toHaveClass(/\bdark\b/)
    expect(await initialDark(page)).toBe(false)
    await expect(toggle(page)).toHaveAttribute("aria-checked", "false")
  })
})

test.describe("系統為淺色（R10.1）", () => {
  test.use({ colorScheme: "light" })

  test("尚未切換過時以淺色開啟；打開開關後保留深色", async ({
    page,
    signedIn,
  }) => {
    expect(signedIn.id).toBeTruthy()
    await recordInitialTheme(page)
    await page.goto("/words")
    await expect(html(page)).not.toHaveClass(/\bdark\b/)
    expect(await initialDark(page)).toBe(false)

    await toggle(page).click()
    await expect(html(page)).toHaveClass(/\bdark\b/)
    await page.goto("/dashboard")
    await expect(html(page)).toHaveClass(/\bdark\b/)
    expect(await initialDark(page)).toBe(true)
  })

  test("可以用鍵盤操作開關（NFR5）", async ({ page, signedIn }) => {
    expect(signedIn.id).toBeTruthy()
    await page.goto("/words")
    await toggle(page).focus()
    await page.keyboard.press("Space")
    await expect(html(page)).toHaveClass(/\bdark\b/)
    await page.keyboard.press("Enter")
    await expect(html(page)).not.toHaveClass(/\bdark\b/)
  })

  test("登入頁與離線頁套用已儲存的設定（R10 AC）", async ({ page }) => {
    await page.goto("/login")
    await page.evaluate(() => localStorage.setItem("theme", "dark"))
    await recordInitialTheme(page)
    for (const path of ["/login", "/offline"]) {
      await page.goto(path)
      await expect(html(page)).toHaveClass(/\bdark\b/)
      expect(await initialDark(page), path).toBe(true)
    }
  })
})
