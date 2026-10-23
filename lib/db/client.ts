import { createBrowserClient } from "@supabase/ssr"

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env"
import type { Database } from "./types"

/** In the browser, used only for the sign-in flow and never to write tables directly (design §1). */
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
}
