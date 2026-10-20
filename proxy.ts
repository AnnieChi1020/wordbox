import type { NextRequest } from "next/server"

import { redirectWithSession, updateSession } from "@/lib/db/proxy"

const HOME = "/words"

function isPublicPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/auth/")
}

export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request)
  const { pathname } = request.nextUrl

  // R1.1：未登入造訪應用頁面 → 登入頁
  if (!userId && !isPublicPath(pathname)) {
    return redirectWithSession(request, response, "/login")
  }
  // R1.6：已登入造訪登入頁或根路徑 → 單字列表
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
