"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/db/server"
import { isValidTimeZone } from "@/lib/domain/dates"

/** R1.5：登出並導向登入頁。 */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

/**
 * R1.3：以瀏覽器回報的時區初始化 profile。
 * 只在 timezone 仍為 null 時寫入，之後不會覆寫（design §4.4）。
 */
export async function initProfileTimezone(timezone: string) {
  if (!isValidTimeZone(timezone)) return

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims.sub
  if (!userId) return

  await supabase
    .from("profiles")
    .update({ timezone })
    .eq("id", userId)
    .is("timezone", null)
}
