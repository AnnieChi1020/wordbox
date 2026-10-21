import type { Page } from "@playwright/test"

import { adminClient } from "../support/local-supabase"

/**
 * seedWords 的中文解釋為「<word> 的解釋」且沒有同義詞，
 * 因此只會出 word_to_zh 或 zh_to_word，可由題目推得正確答案。
 */
export async function correctAnswer(page: Page): Promise<string> {
  const heading = page.getByRole("heading", { level: 2 })
  const prompt = (await heading.locator("span").first().textContent())!.trim()
  const text = (await heading.textContent())!
  return text.includes("的英文是")
    ? prompt.replace(/ 的解釋$/, "")
    : `${prompt} 的解釋`
}

export function option(page: Page, text: string) {
  return page
    .getByRole("list", { name: "選項" })
    .getByRole("button")
    .filter({ hasText: new RegExp(`^\\d${escape(text)}`) })
}

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export async function wrongOption(page: Page, answer: string) {
  const options = page.getByRole("list", { name: "選項" }).getByRole("button")
  for (const button of await options.all()) {
    const label = (await button.textContent())!.replace(/^\d/, "")
    if (label !== answer) return button
  }
  throw new Error("no wrong option")
}

export async function reviewLogs(userId: string) {
  const { data } = await adminClient()
    .from("review_logs")
    .select("is_correct")
    .eq("user_id", userId)
  return data ?? []
}
