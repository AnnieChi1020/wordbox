import type { Page } from "@playwright/test"

import { expect, getWords, test } from "./fixtures"

const UUID = /[0-9a-f-]{36}/

function addWordForm(page: Page) {
  return {
    input: page.getByRole("textbox", { name: "新增單字" }),
    submit: page.getByRole("button", { name: "新增" }),
  }
}

async function add(page: Page, text: string) {
  const { input, submit } = addWordForm(page)
  await input.fill(text)
  await submit.click()
}

test.beforeEach(async ({ page, signedIn }) => {
  void signedIn
  await page.goto("/words")
})

test("新增單字後以 ?word=<id> 開啟（R2.1、R2.2、R2.8）", async ({
  page,
  signedIn,
}) => {
  await add(page, "  Give   up ")
  await expect(page).toHaveURL(new RegExp(`/words\\?word=${UUID.source}$`))
  await expect(addWordForm(page).input).toHaveValue("")

  const words = await getWords(signedIn.id)
  expect(words).toHaveLength(1)
  expect(words[0]).toMatchObject({
    text: "Give up",
    box: 0,
    is_important: false,
  })
  expect(page.url()).toContain(words[0].id)
})

test("可以用 Enter 送出", async ({ page, signedIn }) => {
  await addWordForm(page).input.fill("apple")
  await addWordForm(page).input.press("Enter")
  await expect(page).toHaveURL(/\?word=/)
  expect(await getWords(signedIn.id)).toHaveLength(1)
})

test("格式不符時不送出並顯示錯誤（R2.3）", async ({ page, signedIn }) => {
  const { input } = addWordForm(page)
  for (const text of ["1apple", "apple!", "蘋果", "   "]) {
    await add(page, text)
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "請輸入英文單字或片語",
    )
    await expect(input).toHaveAttribute("aria-invalid", "true")
  }
  await expect(page).toHaveURL("/words")

  // 修改輸入後錯誤消失
  await input.fill("apple")
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0)
  expect(await getWords(signedIn.id)).toHaveLength(0)
})

test("AC：已有 apple 時輸入 Apple，直接開啟 apple（R2.4）", async ({
  page,
  signedIn,
}) => {
  await add(page, "apple")
  await expect(page).toHaveURL(/\?word=/)
  const [apple] = await getWords(signedIn.id)

  await page.goto("/words")
  await add(page, "Apple")
  await expect(page.getByText("這個字已經在你的列表裡")).toBeVisible()
  await expect(page).toHaveURL(`/words?word=${apple.id}`)
  expect(await getWords(signedIn.id)).toHaveLength(1)
})

test("AC：輸入 aple 不儲存，點擊建議 apple 後新增成功（R2.6）", async ({
  page,
  signedIn,
}) => {
  await add(page, "aple")
  await expect(page.getByText("找不到「aple」這個字")).toBeVisible()
  expect(await getWords(signedIn.id)).toHaveLength(0)

  await page.getByRole("button", { name: "apple", exact: true }).click()
  await expect(page).toHaveURL(/\?word=/)
  const words = await getWords(signedIn.id)
  expect(words.map((w) => w.text)).toEqual(["apple"])
})

test("AI 生成中顯示載入狀態並停用送出（R2.9）；逾時顯示錯誤與重試（R2.10）", async ({
  page,
  signedIn,
}) => {
  const { submit } = addWordForm(page)
  await add(page, "mock timeout")

  await expect(submit).toBeDisabled()
  await expect(page.getByText("正在用 AI 整理「mock timeout」…")).toBeVisible()

  // E2E 的 AI_TIMEOUT_MS 為 1 秒
  const retry = page.getByRole("button", { name: "重試" })
  await expect(retry).toBeVisible()
  await expect(page.getByRole("main")).toContainText("AI 回應逾時，請重試")
  await expect(submit).toBeEnabled()
  expect(await getWords(signedIn.id)).toHaveLength(0)

  // 重試會再次送出同一個字
  await retry.click()
  await expect(submit).toBeDisabled()
  await expect(retry).toBeVisible()
})

test("AI 回傳格式錯誤時不儲存（R2.10）", async ({ page, signedIn }) => {
  await add(page, "mock malformed")
  await expect(page.getByRole("main")).toContainText(
    "AI 回傳的內容有誤，請重試",
  )
  expect(await getWords(signedIn.id)).toHaveLength(0)
})
