import { expect, getProfileTimezone, signIn, test } from "./fixtures"

test.describe("未登入", () => {
  // R1.1
  for (const path of ["/", "/words", "/review", "/dashboard"]) {
    test(`造訪 ${path} 導向 /login`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL("/login")
    })
  }

  // R1.2
  test("登入頁只提供 Google 登入", async ({ page }) => {
    await page.goto("/login")
    const main = page.getByRole("main")
    await expect(
      main.getByRole("button", { name: "使用 Google 登入" }),
    ).toBeVisible()
    await expect(main.getByRole("textbox")).toHaveCount(0)
    await expect(main.getByRole("button")).toHaveCount(1)
  })

  test("點擊 Google 登入會導向 Google 授權頁", async ({ page }) => {
    await page.route("https://accounts.google.com/**", (route) =>
      route.fulfill({ body: "google" }),
    )
    await page.goto("/login")
    await page.getByRole("button", { name: "使用 Google 登入" }).click()
    await page.waitForURL(/^https:\/\/accounts\.google\.com\//)
    const redirectUri = new URL(page.url()).searchParams.get("redirect_uri")
    expect(redirectUri).toBe("http://127.0.0.1:54321/auth/v1/callback")
  })

  test("回呼缺少 code 時回到登入頁並顯示錯誤", async ({ page }) => {
    await page.goto("/auth/callback")
    await expect(page).toHaveURL("/login?error=auth")
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "登入失敗，請再試一次。",
    )
  })
})

test.describe("已登入", () => {
  // R1.6
  for (const path of ["/", "/login"]) {
    test(`造訪 ${path} 導向 /words`, async ({ page, signedIn }) => {
      void signedIn
      await page.goto(path)
      await expect(page).toHaveURL("/words")
    })
  }

  // R1.5
  test("登出後導向登入頁，且無法再進入應用頁面", async ({ page, signedIn }) => {
    void signedIn
    await page.goto("/words")
    await page.getByRole("button", { name: "登出" }).click()
    await expect(page).toHaveURL("/login")
    await page.goto("/words")
    await expect(page).toHaveURL("/login")
  })
})

// R1.3
test.describe("首次登入時區", () => {
  test.use({ timezoneId: "America/Boise" })

  test("以瀏覽器時區初始化，之後不覆寫", async ({
    page,
    browser,
    user,
    baseURL,
  }) => {
    expect(await getProfileTimezone(user.id)).toBeNull()

    await signIn(page.context(), user, baseURL!)
    await page.goto("/words")
    await expect.poll(() => getProfileTimezone(user.id)).toBe("America/Boise")

    // 換一個時區的瀏覽器再登入，不應改變
    const taipei = await browser.newContext({ timezoneId: "Asia/Taipei" })
    await signIn(taipei, user, baseURL!)
    const page2 = await taipei.newPage()
    await page2.goto("/words")
    await expect(page2.getByRole("heading", { name: "單字" })).toBeVisible()
    await page2.waitForTimeout(500)
    expect(await getProfileTimezone(user.id)).toBe("America/Boise")
    await taipei.close()
  })
})
