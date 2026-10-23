import { randomUUID } from "node:crypto"

import type { SupabaseClient } from "@supabase/supabase-js"

import { adminClient, anonClient } from "../support/local-supabase"

export { adminClient, anonClient }

export type TestUser = { id: string; client: SupabaseClient }

/** Creates a test user and returns a client signed in as that user. */
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
