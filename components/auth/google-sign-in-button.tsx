"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/db/client"

export function GoogleSignInButton() {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function signIn() {
    setPending(true)
    setFailed(false)
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setPending(false)
      setFailed(true)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Button size="lg" onClick={signIn} disabled={pending}>
        {pending ? "前往 Google…" : "使用 Google 登入"}
      </Button>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          無法連線到登入服務，請再試一次。
        </p>
      )}
    </div>
  )
}
