"use client"

import { useEffect } from "react"

/** R9.2: registers the service worker, in production only, so caching does not interfere with HMR during development (D20). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("service worker registration failed", error)
    })
  }, [])
  return null
}
