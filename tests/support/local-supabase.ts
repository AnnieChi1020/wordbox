import { execFileSync } from "node:child_process"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

type LocalEnv = { url: string; anonKey: string; serviceRoleKey: string }

let cached: LocalEnv | undefined

/** 讀取 `supabase status` 的本地連線資訊；需要先執行 `npm run db:start`。 */
export function localEnv(): LocalEnv {
  if (cached) return cached
  // Playwright globalSetup 會先讀好放在環境變數，避免每個 worker 各自呼叫 CLI
  if (process.env.E2E_SUPABASE_ENV) {
    cached = JSON.parse(process.env.E2E_SUPABASE_ENV) as LocalEnv
    return cached
  }
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
