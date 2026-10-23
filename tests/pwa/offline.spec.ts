import type { Page } from "@playwright/test"

import { expect, seedWords, test } from "../e2e/fixtures"

/** Waits until the service worker is active and controls the current page */
async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, {
          once: true,
        }),
      )
    }
  })
}

test.describe("Service worker 與離線頁（R9.2）", () => {
  test.beforeEach(async ({ page, signedIn }) => {
    await seedWords(signedIn.id, [{ text: "apple" }])
    await page.goto("/words")
    await waitForServiceWorker(page)
  })

  test("離線時重新整理顯示離線頁，恢復連線後回到正常頁面（R9 AC）", async ({
    page,
    context,
  }) => {
    await expect(page.getByRole("heading", { name: "單字" })).toBeVisible()

    await context.setOffline(true)
    await page.reload()
    await expect(
      page.getByRole("heading", { name: "需要網路連線" }),
    ).toBeVisible()
    // The offline page's styles also come from the cache
    const centered = await page
      .getByRole("main")
      .evaluate((el) => getComputedStyle(el).alignItems)
    expect(centered).toBe("center")

    await context.setOffline(false)
    await page.getByRole("button", { name: "重新整理" }).click()
    await expect(page.getByRole("heading", { name: "單字" })).toBeVisible()
    await expect(page.getByText("apple")).toBeVisible()
  })

  test("只快取靜態資源與離線頁", async ({ page }) => {
    // Visit a few pages so every request that might be cached has happened
    await page.goto("/review")
    await page.goto("/dashboard")
    await page.goto("/words")

    const urls = await page.evaluate(async () => {
      const result: string[] = []
      for (const key of await caches.keys()) {
        const cache = await caches.open(key)
        for (const req of await cache.keys()) result.push(req.url)
      }
      return result
    })
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      const { pathname, search } = new URL(url)
      expect(
        pathname === "/offline" ||
          pathname.startsWith("/_next/static/") ||
          pathname.startsWith("/icons/"),
        url,
      ).toBe(true)
      expect(search, url).not.toContain("_rsc")
    }
    expect(urls.some((u) => new URL(u).pathname === "/offline")).toBe(true)
  })

  test("service worker 不需登入即可取得，且不被快取", async ({ request }) => {
    const res = await request.get("/sw.js")
    expect(res.status()).toBe(200)
    expect(res.headers()["cache-control"]).toContain("no-cache")
    expect(res.headers()["content-type"]).toContain("javascript")

    const offline = await request.get("/offline")
    expect(offline.status()).toBe(200)
  })
})
