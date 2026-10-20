import type { Metadata } from "next"
import { Suspense } from "react"

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button"

export const metadata: Metadata = { title: "登入 | Wordbox" }

async function CallbackError({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"]
}) {
  const { error } = await searchParams
  if (!error) return null
  return (
    <p role="alert" className="text-destructive text-sm">
      登入失敗，請再試一次。
    </p>
  )
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-4">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold">Wordbox</h1>
        <p className="text-muted-foreground">
          用 AI 整理單字，用間隔複習記住它們
        </p>
      </div>
      <GoogleSignInButton />
      <Suspense fallback={null}>
        <CallbackError searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
