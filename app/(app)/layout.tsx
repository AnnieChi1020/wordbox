import Link from "next/link"
import { Suspense } from "react"

import { SignOutButton } from "@/components/auth/sign-out-button"
import { TimezoneInit } from "@/components/auth/timezone-init"
import { BottomNav, TopNav } from "@/components/nav/app-nav"
import { ThemeToggle } from "@/components/theme/theme-toggle"
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
      <header className="bg-background sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link href="/words" className="text-lg font-semibold">
              Wordbox
            </Link>
            <TopNav />
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>
      <BottomNav />
      <Suspense fallback={null}>
        <TimezoneGate />
      </Suspense>
    </>
  )
}
