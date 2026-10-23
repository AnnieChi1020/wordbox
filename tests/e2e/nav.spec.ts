import { expect, test } from "./fixtures"

const PAGES = [
  { label: "單字", path: "/words" },
  { label: "複習", path: "/review" },
  { label: "統計", path: "/dashboard" },
]

// NFR1: phones navigate with a bottom tab bar, desktop with a top navigation bar
test("導覽列依螢幕寬度切換，並可切換頁面", async ({
  page,
  signedIn,
  isMobile,
}) => {
  void signedIn
  await page.goto("/words")

  const nav = page.getByRole("navigation", { name: "主要導覽" })
  await expect(nav).toHaveCount(1) // the other navigation is hidden and not in the accessibility tree
  const box = (await nav.boundingBox())!
  const viewport = page.viewportSize()!
  if (isMobile) {
    expect(box.y + box.height).toBeCloseTo(viewport.height, 0)
  } else {
    expect(box.y).toBeLessThan(100)
  }

  for (const { label, path } of PAGES) {
    await nav.getByRole("link", { name: label }).click()
    await expect(page).toHaveURL(path)
    await expect(
      page.getByRole("heading", { level: 1, name: label }),
    ).toBeVisible()
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute(
      "aria-current",
      "page",
    )
  }
})

test("導覽可以只用鍵盤操作", async ({ page, signedIn }) => {
  void signedIn
  await page.goto("/words")
  const link = page
    .getByRole("navigation", { name: "主要導覽" })
    .getByRole("link", { name: "複習" })
  await link.focus()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL("/review")
})

// NFR1: no horizontal scrolling anywhere from 360px to 1440px
for (const width of [360, 1440]) {
  test(`${width}px 寬度沒有水平捲動`, async ({ page, signedIn }) => {
    void signedIn
    await page.setViewportSize({ width, height: 800 })
    for (const { path } of PAGES) {
      await page.goto(path)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow, path).toBeLessThanOrEqual(0)
    }
  })
}
