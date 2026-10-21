import type { Page } from "@playwright/test"

import { adminClient } from "../support/local-supabase"
import { expect, getWords, seedWords, test } from "./fixtures"

async function confirm(page: Page, action: string) {
  const alert = page.getByRole("alertdialog")
  await expect(alert).toBeVisible()
  await alert.getByRole("button", { name: action }).click()
}

test.describe("重新生成（R4.5、R4.6）", () => {
  test("AC：重新生成後內容更新，box 與 important 不變", async ({
    page,
    signedIn,
  }) => {
    const [id] = await seedWords(signedIn.id, [
      { text: "run", box: 3, important: true },
    ])
    await page.goto(`/words?word=${id}`)
    const dialog = page.getByRole("dialog", { name: "run" })
    await expect(dialog).toContainText("run 的解釋")

    await dialog.getByRole("button", { name: "重新生成" }).click()
    await confirm(page, "重新生成")
    await expect(page.getByText("已重新生成")).toBeVisible()
    const senses = dialog.getByRole("list", { name: "義項" })
    await expect(senses).toContainText("跑；奔跑")
    await expect(senses).not.toContainText("run 的解釋")

    const [word] = await getWords(signedIn.id)
    expect(word).toMatchObject({ text: "run", box: 3, is_important: true })
    expect(word.senses).toHaveLength(3)
    await expect(
      dialog.getByRole("img", { name: "熟悉度 3 / 5" }),
    ).toBeVisible()
  })

  test("取消確認時不變更", async ({ page, signedIn }) => {
    const [id] = await seedWords(signedIn.id, [{ text: "run" }])
    await page.goto(`/words?word=${id}`)
    const dialog = page.getByRole("dialog", { name: "run" })
    await dialog.getByRole("button", { name: "重新生成" }).click()
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "取消" })
      .click()
    await expect(page.getByRole("alertdialog")).toHaveCount(0)
    await expect(dialog).toContainText("run 的解釋")
  })

  test("失敗時保留原內容並顯示錯誤", async ({ page, signedIn }) => {
    // mock：這個字會讓 AI 逾時（E2E 為 1 秒）
    const [id] = await seedWords(signedIn.id, [{ text: "mock timeout" }])
    await page.goto(`/words?word=${id}`)
    const dialog = page.getByRole("dialog", { name: "mock timeout" })
    await dialog.getByRole("button", { name: "重新生成" }).click()
    await confirm(page, "重新生成")
    await expect(
      page.getByText("AI 回應逾時，原內容未變更，請重試"),
    ).toBeVisible()
    await expect(dialog).toContainText("mock timeout 的解釋")
  })
})

test.describe("刪除（R4.7）", () => {
  test("AC：刪除後關閉 popup，列表立即移除該字", async ({ page, signedIn }) => {
    const [, bananaId] = await seedWords(signedIn.id, [
      { text: "apple" },
      { text: "banana" },
    ])
    await page.goto(`/words?word=${bananaId}`)
    const dialog = page.getByRole("dialog", { name: "banana" })
    await dialog.getByRole("button", { name: "刪除" }).click()
    await confirm(page, "刪除")

    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(page).toHaveURL("/words")
    await expect(page.getByText("已刪除「banana」")).toBeVisible()
    const list = page.getByRole("list", { name: "單字列表" })
    await expect(list.getByRole("listitem")).toHaveCount(1)
    await expect(list).not.toContainText("banana")
    await expect(page.getByText("1 個單字")).toBeVisible()

    expect((await getWords(signedIn.id)).map((w) => w.text)).toEqual(["apple"])
    const { data } = await adminClient()
      .from("senses")
      .select("id")
      .eq("word_id", bananaId)
    expect(data).toEqual([])
  })

  test("刪除最後一個字後顯示空狀態", async ({ page, signedIn }) => {
    const [id] = await seedWords(signedIn.id, [{ text: "only" }])
    await page.goto(`/words?word=${id}`)
    await page.getByRole("dialog").getByRole("button", { name: "刪除" }).click()
    await confirm(page, "刪除")
    await expect(page.getByText("還沒有任何單字")).toBeVisible()
  })

  test("取消確認時不刪除", async ({ page, signedIn }) => {
    const [id] = await seedWords(signedIn.id, [{ text: "keep" }])
    await page.goto(`/words?word=${id}`)
    await page.getByRole("dialog").getByRole("button", { name: "刪除" }).click()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("alertdialog")).toHaveCount(0)
    await expect(page.getByRole("dialog", { name: "keep" })).toBeVisible()
    expect(await getWords(signedIn.id)).toHaveLength(1)
  })
})
