import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { connection } from "next/server"

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env"
import type { Database } from "./types"

/** Creates a new client per request (Server Components, Server Actions, Route Handlers). */
export async function createClient() {
  // Session verification uses the current time, so it must run at request time and cannot be prerendered
  await connection()
  const cookieStore = await cookies()
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // Server Components cannot write cookies; proxy.ts refreshes the session
        }
      },
    },
  })
}

/** Returns the signed-in user's id, or null when signed out. */
export async function getUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  return data?.claims.sub ?? null
}
