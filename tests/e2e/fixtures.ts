import { randomUUID } from "node:crypto"

import { test as base, type BrowserContext } from "@playwright/test"
import { createServerClient } from "@supabase/ssr"

import { adminClient, localEnv } from "../support/local-supabase"

export type E2EUser = { id: string; email: string; password: string }

export async function createUser(): Promise<E2EUser> {
  const email = `e2e-${randomUUID()}@example.com`
  const password = randomUUID()
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  return { id: data.user.id, email, password }
}

/**
 * 以測試帳號登入並把 session cookie 注入瀏覽器，不經過 Google（design §10）。
 * 以 @supabase/ssr 產生 cookie，確保格式與 app 相同。
 */
export async function signIn(
  context: BrowserContext,
  user: E2EUser,
  baseURL: string,
) {
  const { url, anonKey } = localEnv()
  const jar: { name: string; value: string }[] = []
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => jar,
      setAll: (cookies) => {
        for (const { name, value } of cookies) {
          const i = jar.findIndex((c) => c.name === name)
          if (i >= 0) jar.splice(i, 1)
          if (value) jar.push({ name, value })
        }
      },
    },
  })
  const { error } = await supabase.auth.signInWithPassword(user)
  if (error) throw error

  await context.addCookies(
    jar.map((c) => ({ ...c, url: baseURL, sameSite: "Lax" as const })),
  )
}

export async function getProfileTimezone(userId: string) {
  const { data } = await adminClient()
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .single()
  return data?.timezone as string | null
}

type Fixtures = { user: E2EUser; signedIn: E2EUser }

export const test = base.extend<Fixtures>({
  // 每個測試一個新使用者，結束後刪除
  user: async ({}, use) => {
    const user = await createUser()
    await use(user)
    await adminClient().auth.admin.deleteUser(user.id)
  },
  signedIn: async ({ context, user, baseURL }, use) => {
    await signIn(context, user, baseURL!)
    await use(user)
  },
})

export { expect } from "@playwright/test"
