import { createBrowserClient } from "@supabase/ssr"

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env"
import type { Database } from "./types"

/** 瀏覽器端只用於登入流程，不直接寫資料表（design §1）。 */
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
}
