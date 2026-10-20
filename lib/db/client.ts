import { createBrowserClient } from "@supabase/ssr"

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env"

/** 瀏覽器端只用於登入流程，不直接寫資料表（design §1）。 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
