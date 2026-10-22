import { expect, test } from "@playwright/test"
import sharp from "sharp"

type ManifestIcon = {
  src: string
  sizes: string
  type: string
  purpose?: string
}

test.describe("Web App Manifest（R9.1）", () => {
  test("不需登入即可取得，並含安裝所需欄位", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest")
    expect(res.status()).toBe(200)
    const manifest = await res.json()
    expect(manifest).toMatchObject({
      name: expect.any(String),
      short_name: "Wordbox",
      start_url: "/words",
      display: "standalone",
      theme_color: "#086288",
      background_color: "#FFEFC4",
    })
    const icons = manifest.icons as ManifestIcon[]
    expect(icons.map((i) => i.sizes)).toEqual(
      expect.arrayContaining(["192x192", "512x512"]),
    )
    expect(icons.some((i) => i.purpose === "maskable")).toBe(true)
  })

  test("每個圖示都能取得，且尺寸與宣告相符", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json()
    for (const icon of manifest.icons as ManifestIcon[]) {
      const res = await request.get(icon.src)
      expect(res.status(), icon.src).toBe(200)
      expect(res.headers()["content-type"]).toBe(icon.type)
      const { width, height } = await sharp(await res.body()).metadata()
      expect(`${width}x${height}`, icon.src).toBe(icon.sizes)
    }
  })

  test("頁面連結 manifest、主題色與 iOS 圖示", async ({ page, request }) => {
    await page.goto("/login")
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    )
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#086288",
    )
    await expect(
      page.locator('meta[name="mobile-web-app-capable"]'),
    ).toHaveAttribute("content", "yes")

    const appleIcon = page.locator('link[rel="apple-touch-icon"]')
    const href = await appleIcon.getAttribute("href")
    const res = await request.get(href!)
    expect(res.status()).toBe(200)
    const { width, height } = await sharp(await res.body()).metadata()
    expect([width, height]).toEqual([180, 180])

    const icon = await page
      .locator('link[rel="icon"]')
      .first()
      .getAttribute("href")
    expect((await request.get(icon!)).status()).toBe(200)
  })
})
