"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/db/server"
import { isValidTimeZone } from "@/lib/domain/dates"

/** R1.5: sign out and redirect to the login page. */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

/**
 * R1.3: initialize the profile with the time zone reported by the browser.
 * Writes only while timezone is still null and never overwrites it afterward (design §4.4).
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
