import { Suspense } from "react"

import { SignOutButton } from "@/components/auth/sign-out-button"
import { TimezoneInit } from "@/components/auth/timezone-init"
import { createClient } from "@/lib/db/server"

/** profile.timezone 尚未初始化時，掛上回報瀏覽器時區的元件（R1.3）。 */
async function TimezoneGate() {
  const supabase = await createClient()
  const { data } = await supabase.from("profiles").select("timezone").single()
  return data && data.timezone === null ? <TimezoneInit /> : null
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="flex items-center justify-between border-b px-4 py-2">
        <span className="font-semibold">Wordbox</span>
        <SignOutButton />
      </header>
      {children}
      <Suspense fallback={null}>
        <TimezoneGate />
      </Suspense>
    </>
  )
}
