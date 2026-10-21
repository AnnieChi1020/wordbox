import type { Locator, Page } from "@playwright/test"

import { adminClient } from "../support/local-supabase"
import { expect, seedWords, test } from "./fixtures"

async function senses(wordId: string) {
  const { data } = await adminClient()
    .from("senses")
    .select("id, pos, def_zh, synonyms, examples")
    .eq("word_id", wordId)
    .order("position")
  return data!
}

async function openEditor(page: Page, wordId: string) {
  await page.goto(`/words?word=${wordId}`)
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "編輯" }).click()
  const form = dialog.getByRole("form", { name: /^編輯 / })
  await expect(form).toBeVisible()
  return { dialog, form }
}

const field = (scope: Locator, label: string | RegExp, n = 0) =>
  scope.getByLabel(label).nth(n)

test.describe("編輯模式（R4.3、R4.4）", () => {
  let wordId: string

  test.beforeEach(async ({ signedIn }) => {
    ;[wordId] = await seedWords(signedIn.id, [{ text: "light", pos: ["noun"] }])
  })

  test("AC：編輯並儲存同義詞後重新開啟，顯示新內容", async ({ page }) => {
    const { dialog, form } = await openEditor(page, wordId)
    const before = await senses(wordId)

    await field(form, /同義詞/).fill("brightness, glow，radiance")
    await form.getByRole("button", { name: "儲存" }).click()
    await expect(page.getByText("已儲存")).toBeVisible()
    await expect(form).toHaveCount(0)
    await expect(dialog).toContainText("brightness")

    // 重新開啟
    await page.keyboard.press("Escape")
    await page
      .getByRole("list", { name: "單字列表" })
      .getByRole("link")
      .first()
      .click()
    const reopened = page.getByRole("dialog", { name: "light" })
    for (const w of ["brightness", "glow", "radiance"]) {
      await expect(reopened).toContainText(w)
    }
    // 原地更新，義項 id 不變（design D9）
    const after = await senses(wordId)
    expect(after[0]).toMatchObject({
      id: before[0].id,
      synonyms: ["brightness", "glow", "radiance"],
    })
  })

  test("內容不合規則時阻止儲存並標示錯誤欄位", async ({ page }) => {
    const { form } = await openEditor(page, wordId)
    const before = await senses(wordId)

    await field(form, "中文解釋").fill("  ")
    await field(form, /同義詞/).fill("a, b, c, d, e, f")
    await field(form, /例句/).fill("one\ntwo\nthree")
    await form.getByRole("button", { name: "儲存" }).click()

    await expect(field(form, "中文解釋")).toHaveAttribute(
      "aria-invalid",
      "true",
    )
    await expect(field(form, "中文解釋")).toBeFocused()
    await expect(form).toContainText("請輸入中文解釋")
    await expect(form).toContainText("同義詞最多 5 個")
    await expect(form).toContainText("例句最多 2 句")
    await expect(field(form, "英文解釋")).not.toHaveAttribute("aria-invalid")
    expect(await senses(wordId)).toEqual(before)
  })

  test("可新增或移除義項，維持 1–3 個；列表詞性同步更新", async ({ page }) => {
    const { dialog, form } = await openEditor(page, wordId)
    const add = form.getByRole("button", { name: "新增義項" })

    await expect(
      form.getByRole("button", { name: "移除義項 1" }),
    ).toBeDisabled()
    await add.click()
    await add.click()
    await expect(add).toBeDisabled()
    await expect(form.getByRole("group")).toHaveCount(3)

    // 移除第 3 個，填寫第 2 個為動詞
    await form.getByRole("button", { name: "移除義項 3" }).click()
    await field(form, "詞性", 1).selectOption("verb")
    await field(form, "中文解釋", 1).fill("點燃")
    await field(form, "英文解釋", 1).fill("to make something start burning")
    await form.getByRole("button", { name: "儲存" }).click()
    await expect(form).toHaveCount(0)
    await expect(
      dialog.getByRole("list", { name: "義項" }).locator("> li"),
    ).toHaveCount(2)

    expect((await senses(wordId)).map((s) => s.pos)).toEqual(["noun", "verb"])
    await page.keyboard.press("Escape")
    const row = page
      .getByRole("list", { name: "單字列表" })
      .getByRole("listitem")
      .first()
    await expect(row.getByText(/^(n\.|v\.)$/)).toHaveText(["n.", "v."])
  })

  test("取消會放棄修改", async ({ page }) => {
    const { dialog, form } = await openEditor(page, wordId)
    await field(form, "中文解釋").fill("改過的解釋")
    await form.getByRole("button", { name: "取消" }).click()
    await expect(form).toHaveCount(0)
    await expect(dialog).not.toContainText("改過的解釋")
    expect((await senses(wordId))[0].def_zh).toBe("light 的解釋")
  })

  test("可以修改 IPA，但不能修改單字本身", async ({ page }) => {
    const { dialog, form } = await openEditor(page, wordId)
    for (const input of await form.getByRole("textbox").all()) {
      await expect(input).not.toHaveValue("light")
    }
    await field(form, /音標/).fill("/laɪt/")
    await form.getByRole("button", { name: "儲存" }).click()
    await expect(dialog).toContainText("/laɪt/")
    await expect(dialog.getByRole("heading", { name: "light" })).toBeVisible()
  })
})
