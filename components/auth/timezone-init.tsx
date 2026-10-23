"use client"

import { useEffect } from "react"

import { initProfileTimezone } from "@/lib/actions/auth"

/** Reports the browser time zone on the first sign-in (R1.3). Rendered only while profile.timezone is null. */
export function TimezoneInit() {
  useEffect(() => {
    void initProfileTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  }, [])
  return null
}
