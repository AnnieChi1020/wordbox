import { expect, seedWords, test } from "./fixtures"
import {
  correctAnswer,
  option,
  reviewLogs,
  wrongOption,
} from "./review-helpers"
import { adminClient } from "../support/local-supabase"

test.describe("複習 UI（R7.1、R7.2）", () => {
  test.beforeEach(async ({ signedIn }) => {
    await seedWords(signedIn.id, [{ text: "apple" }, { text: "pear" }])
  })

  test("作答後鎖定並標示對錯，依序完成一輪", async ({ page, signedIn }) => {
    await page.goto("/review")
    await expect(page.getByText("今天有 2 個字到期")).toBeVisible()
    await page.getByRole("button", { name: "開始複習" }).click()

    // Question 1: correct
    await expect(page.getByText("1 / 2")).toBeVisible()
    const answer1 = await correctAnswer(page)
    await option(page, answer1).click()
    await expect(page.getByText("答對了！")).toBeVisible()
    await expect(option(page, answer1)).toHaveAttribute("data-state", "correct")
    for (const button of await page
      .getByRole("list", { name: "選項" })
      .getByRole("button")
      .all()) {
      await expect(button).toBeDisabled()
    }
    // Focus is on 「下一題」 (Next question); Enter continues (NFR5)
    await expect(page.getByRole("button", { name: "下一題" })).toBeFocused()
    await page.keyboard.press("Enter")

    // Question 2: wrong
    await expect(page.getByText("2 / 2")).toBeVisible()
    const answer2 = await correctAnswer(page)
    const wrong = await wrongOption(page, answer2)
    await wrong.click()
    await expect(
      page.getByText(`答錯了，正確答案是「${answer2}」`),
    ).toBeVisible()
    await expect(wrong).toHaveAttribute("data-state", "wrong")
    await expect(option(page, answer2)).toHaveAttribute("data-state", "correct")

    await expect
      .poll(async () =>
        (await reviewLogs(signedIn.id)).map((l) => l.is_correct).sort(),
      )
      .toEqual([false, true])

    // R7.5 summary
    await page.getByRole("button", { name: "看結果" }).click()
    await expect(
      page.getByRole("heading", { name: "答對 1 / 2 題" }),
    ).toBeVisible()
    const results = page.getByRole("list", { name: "這一輪的結果" })
    await expect(results.getByRole("listitem")).toHaveCount(2)
    await expect(results.getByText("答對")).toHaveCount(1)
    await expect(results.getByText("答錯")).toHaveCount(1)
    // New word in box 0: correct → 1 star, wrong → stays at 0 stars (D16)
    await expect(
      results.getByRole("img", { name: "熟悉度 0 / 5" }),
    ).toHaveCount(3)
    await expect(
      results.getByRole("img", { name: "熟悉度 1 / 5" }),
    ).toHaveCount(1)
    await expect(page.getByText("今天到期的字都複習完了")).toBeVisible()

    // Another round: with no due words, words that are not due fill the session
    await page.getByRole("button", { name: "再來一輪" }).click()
    await expect(page.getByText("1 / 2")).toBeVisible()
  })

  test("結算畫面可以回到單字列表或開啟單字", async ({ page }) => {
    await page.goto("/review")
    await page.getByRole("button", { name: "開始複習" }).click()
    for (const n of [1, 2]) {
      await expect(page.getByText(`${n} / 2`)).toBeVisible()
      await page.keyboard.press("1")
      await page
        .getByRole("button", { name: n === 2 ? "看結果" : "下一題" })
        .click()
    }
    const results = page.getByRole("list", { name: "這一輪的結果" })
    await results.getByRole("link").filter({ hasText: "apple" }).click()
    await expect(page).toHaveURL(/\/words\?word=/)
    await expect(page.getByRole("dialog")).toBeVisible()

    await page.goBack()
    await page.goto("/review")
    await expect(page.getByText("今天沒有到期的字")).toBeVisible()
  })

  test("可以用數字鍵作答（NFR5）", async ({ page }) => {
    await page.goto("/review")
    await page.getByRole("button", { name: "開始複習" }).click()
    await expect(page.getByText("1 / 2")).toBeVisible()

    await page.keyboard.press("2")
    const second = page
      .getByRole("list", { name: "選項" })
      .getByRole("button")
      .nth(1)
    await expect(second).toHaveAttribute("data-state", /correct|wrong/)
  })

  test("判定失敗時可重試同一題", async ({ page, signedIn }) => {
    await page.goto("/review")
    await page.getByRole("button", { name: "開始複習" }).click()
    await expect(page.getByText("1 / 2")).toBeVisible()

    // Make the next server action request fail
    let failed = false
    await page.route("**/review", async (route) => {
      if (!failed && route.request().method() === "POST") {
        failed = true
        return route.abort()
      }
      return route.continue()
    })

    const answer = await correctAnswer(page)
    await option(page, answer).click()
    await expect(page.getByRole("button", { name: "重試" })).toBeVisible()
    expect(await reviewLogs(signedIn.id)).toEqual([])

    await page.getByRole("button", { name: "重試" }).click()
    await expect(page.getByText("答對了！")).toBeVisible()
    await expect
      .poll(async () => (await reviewLogs(signedIn.id)).length)
      .toBe(1)
  })
})

test.describe("反義詞題（R6.1、Phase 5）", () => {
  test("有反義詞的字會出反義詞題，並以反義詞判定對錯", async ({
    page,
    signedIn,
  }) => {
    const antonymOf: Record<string, string> = { hot: "cold", big: "small" }
    await seedWords(signedIn.id, [
      { text: "hot", antonyms: ["cold"] },
      { text: "big", antonyms: ["small"] },
    ])
    await page.goto("/review")
    await page.getByRole("button", { name: "開始複習" }).click()

    // Question types are random (1/3 per question), so keep answering until an antonym question appears
    const heading = page.getByRole("heading", { level: 2 })
    for (let round = 0; round < 20; round++) {
      for (const n of [1, 2]) {
        await expect(page.getByText(`${n} / 2`)).toBeVisible()
        if ((await heading.textContent())!.includes("的反義詞")) {
          const prompt = (await heading.locator("span").first().textContent())!
          const answer = antonymOf[prompt.trim()]
          await expect(
            page.getByRole("list", { name: "選項" }).getByRole("button"),
          ).toHaveCount(4)
          await option(page, answer).click()
          await expect(page.getByText("答對了！")).toBeVisible()
          await expect
            .poll(async () => {
              const { data } = await adminClient()
                .from("review_logs")
                .select("question_type, is_correct")
                .eq("user_id", signedIn.id)
                .eq("question_type", "word_to_antonym")
              return data
            })
            .toEqual([{ question_type: "word_to_antonym", is_correct: true }])
          return
        }
        await page.keyboard.press("1")
        await page
          .getByRole("button", { name: n === 2 ? "看結果" : "下一題" })
          .click()
      }
      await page.getByRole("button", { name: "再來一輪" }).click()
    }
    throw new Error("no antonym question in 20 rounds")
  })
})

test.describe("填空題（R6.1、Phase 7）", () => {
  test("例句含有單字時會出填空題，作答後空格顯示正確答案", async ({
    page,
    signedIn,
  }) => {
    const sentences: Record<string, string> = {
      "I eat an ___ every day.": "apple",
      "This ___ is sweet.": "pear",
    }
    await seedWords(signedIn.id, [
      { text: "apple", examples: ["I eat an apple every day."] },
      { text: "pear", examples: ["This pear is sweet."] },
    ])
    await page.goto("/review")
    await page.getByRole("button", { name: "開始複習" }).click()

    // Question types are random (1/3 per question), so keep answering until a cloze question appears
    const heading = page.getByRole("heading", { level: 2 })
    for (let round = 0; round < 20; round++) {
      for (const n of [1, 2]) {
        await expect(page.getByText(`${n} / 2`)).toBeVisible()
        if ((await heading.textContent())!.includes("填入空格")) {
          // The blank is announced to screen readers, and the word itself is not shown
          const text = (await heading.textContent())!
          const [sentence, answer] = Object.entries(sentences).find(([s]) =>
            text.includes(s.replace("___", "空格")),
          )!
          expect(text).not.toContain(answer)
          await option(page, answer).click()
          await expect(page.getByText("答對了！")).toBeVisible()
          // The blank now shows the correct word
          await expect(heading).toContainText(sentence.replace("___", answer))
          await expect
            .poll(async () => {
              const { data } = await adminClient()
                .from("review_logs")
                .select("question_type, is_correct")
                .eq("user_id", signedIn.id)
                .eq("question_type", "cloze")
              return data
            })
            .toEqual([{ question_type: "cloze", is_correct: true }])
          return
        }
        await page.keyboard.press("1")
        await page
          .getByRole("button", { name: n === 2 ? "看結果" : "下一題" })
          .click()
      }
      await page.getByRole("button", { name: "再來一輪" }).click()
    }
    throw new Error("no cloze question in 20 rounds")
  })
})
