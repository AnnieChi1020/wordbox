"use client"

import { useEffect } from "react"

/** R9.2：註冊 service worker；只在 production 註冊，避免開發時的快取干擾 HMR（D20）。 */
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
