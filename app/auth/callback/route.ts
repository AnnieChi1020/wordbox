import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/db/server"

/** OAuth callback: exchange the code for a session, then redirect to the word list. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}/words`)
  }
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
