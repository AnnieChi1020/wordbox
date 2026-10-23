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
 * Signs in with a test account and injects the session cookie into the browser, without going through Google (design §10).
 * The cookie is created with @supabase/ssr so its format matches the app.
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
  // A new user per test, deleted afterward
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

export async function getWords(userId: string) {
  const { data, error } = await adminClient()
    .from("words")
    .select("id, text, box, is_important, senses(id)")
    .eq("user_id", userId)
    .order("created_at")
  if (error) throw error
  return data as {
    id: string
    text: string
    box: number
    is_important: boolean
    senses: { id: string }[]
  }[]
}

export type SeedWord = {
  text: string
  box?: number
  important?: boolean
  /** Date added; by default one minute apart per word in array order */
  createdAt?: string
  pos?: string[]
  /** Antonyms for each sense; none by default */
  antonyms?: string[]
  /** Examples for each sense; by default one that does not contain the word, so no cloze questions */
  examples?: string[]
}

/** Creates words by writing to the database directly (without the AI); returns ids in input order. */
export async function seedWords(userId: string, words: SeedWord[]) {
  const admin = adminClient()
  const base = Date.parse("2026-10-01T00:00:00Z")
  const { data, error } = await admin
    .from("words")
    .insert(
      words.map((w, i) => ({
        user_id: userId,
        text: w.text,
        box: w.box ?? 0,
        is_important: w.important ?? false,
        next_due_on: "2026-10-20",
        created_at: w.createdAt ?? new Date(base + i * 60_000).toISOString(),
      })),
    )
    .select("id, text")
  if (error) throw error
  const idByText = new Map(data.map((d) => [d.text, d.id as string]))
  const ids = words.map((w) => idByText.get(w.text)!)

  const senses = words.flatMap((w, i) =>
    (w.pos ?? ["noun"]).map((pos, j) => ({
      word_id: ids[i],
      position: j + 1,
      pos,
      def_en: `definition of ${w.text}`,
      def_zh: `${w.text} 的解釋`,
      antonyms: w.antonyms ?? [],
      examples: w.examples ?? ["An example sentence."],
    })),
  )
  for (let i = 0; i < senses.length; i += 1000) {
    const { error: senseError } = await admin
      .from("senses")
      .insert(senses.slice(i, i + 1000))
    if (senseError) throw senseError
  }
  return ids
}
