"use client"

import { useEffect } from "react"

import { initProfileTimezone } from "@/lib/actions/auth"

/** 首次登入時回報瀏覽器時區（R1.3）。只在 profile.timezone 為 null 時才會被渲染。 */
export function TimezoneInit() {
  useEffect(() => {
    void initProfileTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  }, [])
  return null
}
