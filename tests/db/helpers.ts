import { execFileSync } from "node:child_process"
import { randomUUID } from "node:crypto"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

type LocalEnv = { url: string; anonKey: string; serviceRoleKey: string }

let cached: LocalEnv | undefined

/** 讀取 `supabase status` 的本地連線資訊；需要先執行 `npx supabase start`。 */
export function localEnv(): LocalEnv {
  if (cached) return cached
  const out = execFileSync("npx", ["supabase", "status", "-o", "env"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
  const vars = Object.fromEntries(
    out
      .split("\n")
      .map((line) => line.match(/^(\w+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], m[2]]),
  )
  cached = {
    url: vars.API_URL,
    anonKey: vars.ANON_KEY,
    serviceRoleKey: vars.SERVICE_ROLE_KEY,
  }
  return cached
}

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
}

export function anonClient(): SupabaseClient {
  const { url, anonKey } = localEnv()
  return createClient(url, anonKey, clientOptions)
}

export function adminClient(): SupabaseClient {
  const { url, serviceRoleKey } = localEnv()
  return createClient(url, serviceRoleKey, clientOptions)
}

export type TestUser = { id: string; client: SupabaseClient }

/** 建立一個測試使用者並回傳以其身分登入的 client。 */
export async function createTestUser(): Promise<TestUser> {
  const email = `test-${randomUUID()}@example.com`
  const password = randomUUID()
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error

  const client = anonClient()
  const signIn = await client.auth.signInWithPassword({ email, password })
  if (signIn.error) throw signIn.error
  return { id: data.user.id, client }
}

export async function deleteTestUser(user: TestUser | undefined) {
  if (user) await adminClient().auth.admin.deleteUser(user.id)
}

export type SenseInput = {
  id?: string
  pos: string
  def_en: string
  def_zh: string
  synonyms: string[]
  antonyms: string[]
  examples: string[]
}

export function sense(overrides: Partial<SenseInput> = {}): SenseInput {
  return {
    pos: "noun",
    def_en: "a round fruit with red or green skin",
    def_zh: "蘋果",
    synonyms: [],
    antonyms: [],
    examples: ["I ate an apple."],
    ...overrides,
  }
}

export async function createWord(
  user: TestUser,
  text: string,
  senses: SenseInput[] = [sense()],
  today = "2026-10-20",
) {
  const { data, error } = await user.client.rpc("create_word", {
    p_text: text,
    p_ipa: "/ˈæp.əl/",
    p_senses: senses,
    p_today: today,
  })
  if (error) throw error
  return data as { id: string; existed: boolean }
}
