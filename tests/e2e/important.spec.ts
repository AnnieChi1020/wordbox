import { adminClient } from "../support/local-supabase"
import { expect, seedWords, test } from "./fixtures"

async function isImportant(wordId: string) {
  const { data } = await adminClient()
    .from("words")
    .select("is_important")
    .eq("id", wordId)
    .single()
  return data!.is_important as boolean
}

test.describe("important 切換（R3.5）", () => {
  let wordId: string

  test.beforeEach(async ({ page, signedIn }) => {
    ;[wordId] = await seedWords(signedIn.id, [{ text: "apple" }])
    await page.goto("/words")
  })

  test("點擊標記立即切換、寫入資料庫，且不開啟 popup", async ({ page }) => {
    const toggle = page.getByRole("button", { name: "重要", exact: true })
    await expect(toggle).toHaveAttribute("aria-pressed", "false")

    await toggle.click()
    await expect(toggle).toHaveAttribute("aria-pressed", "true")
    await expect(page).toHaveURL("/words")
    await expect.poll(() => isImportant(wordId)).toBe(true)

    await page.reload()
    await expect(
      page.getByRole("button", { name: "重要", exact: true }),
    ).toHaveAttribute("aria-pressed", "true")

    await page.getByRole("button", { name: "重要", exact: true }).click()
    await expect.poll(() => isImportant(wordId)).toBe(false)
  })

  test("可以用鍵盤切換（NFR5）", async ({ page }) => {
    const toggle = page.getByRole("button", { name: "重要", exact: true })
    await toggle.focus()
    await page.keyboard.press("Space")
    await expect(toggle).toHaveAttribute("aria-pressed", "true")
    await expect.poll(() => isImportant(wordId)).toBe(true)
  })

  test("連續點擊以最後一次為準", async ({ page }) => {
    const toggle = page.getByRole("button", { name: "重要", exact: true })
    await toggle.click()
    await toggle.click()
    await toggle.click()
    await expect(toggle).toHaveAttribute("aria-pressed", "true")
    await expect.poll(() => isImportant(wordId)).toBe(true)
    await page.waitForTimeout(500)
    await expect(toggle).toHaveAttribute("aria-pressed", "true")
  })

  test("更新失敗時還原並顯示錯誤", async ({ page }) => {
    // Make the server action request fail
    await page.route("**/words", (route) =>
      route.request().method() === "POST" ? route.abort() : route.continue(),
    )
    const toggle = page.getByRole("button", { name: "重要", exact: true })
    await toggle.click()
    await expect(page.getByText("更新失敗，請重試")).toBeVisible()
    await expect(toggle).toHaveAttribute("aria-pressed", "false")
    expect(await isImportant(wordId)).toBe(false)
  })
})
