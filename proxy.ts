import type { NextRequest } from "next/server"

import { redirectWithSession, updateSession } from "@/lib/db/proxy"

const HOME = "/words"

/** 不需登入：登入流程與 PWA 檔案（R9；瀏覽器取得 manifest 時不帶 session 也要能讀到）。 */
function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname === "/manifest.webmanifest"
  )
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
