import type { NextRequest } from "next/server"

import { redirectWithSession, updateSession } from "@/lib/db/proxy"

const HOME = "/words"

/** No sign-in needed: the sign-in flow and PWA files (R9; browsers fetch the manifest without a session and must still get it). */
function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/offline"
  )
}

export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request)
  const { pathname } = request.nextUrl

  // R1.1: a signed-out visit to an app page → login page
  if (!userId && !isPublicPath(pathname)) {
    return redirectWithSession(request, response, "/login")
  }
  // R1.6: a signed-in visit to the login page or the root path → word list
  if (userId && (pathname === "/login" || pathname === "/")) {
    return redirectWithSession(request, response, HOME)
  }
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
