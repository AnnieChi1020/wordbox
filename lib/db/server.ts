import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { connection } from "next/server"

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env"

/** 每個 request 建立一個新的 client（Server Components、Server Actions、Route Handlers）。 */
export async function createClient() {
  // session 驗證會用到目前時間，必須在 request 時執行，不能進入 prerender
  await connection()
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // Server Component 無法寫入 cookie；session 由 proxy.ts 負責更新
        }
      },
    },
  })
}

/** 回傳目前登入的使用者 id；未登入回傳 null。 */
export async function getUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  return data?.claims.sub ?? null
}
