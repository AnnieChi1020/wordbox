import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env"
import type { Database } from "./types"

/** Refreshes the session cookie and returns the current user id. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          )
        },
      },
    },
  )

  const { data } = await supabase.auth.getClaims()
  return { response, userId: data?.claims.sub ?? null }
}

/** Redirects with the cookies and cache headers updated by updateSession. */
export function redirectWithSession(
  request: NextRequest,
  sessionResponse: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ""
  const redirect = NextResponse.redirect(url)
  sessionResponse.cookies.getAll().forEach((c) => redirect.cookies.set(c))
  sessionResponse.headers.forEach((value, key) => {
    if (/^(cache-control|expires|pragma)$/i.test(key))
      redirect.headers.set(key, value)
  })
  return redirect
}
