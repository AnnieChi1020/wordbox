import { WifiOff } from "lucide-react"
import type { Metadata } from "next"

import { ReloadButton } from "@/components/pwa/reload-button"

export const metadata: Metadata = { title: "需要網路連線 | Wordbox" }

/**
 * R9.2：離線時由 service worker 回傳的頁面。
 * 不需登入、不讀取資料，建置時即產生靜態 HTML，可預先快取。
 */
export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <WifiOff aria-hidden className="text-muted-foreground size-10" />
      <h1 className="text-xl font-semibold">需要網路連線</h1>
      <p className="text-muted-foreground max-w-xs text-sm">
        Wordbox 需要連線才能查詢單字與複習。請確認網路連線後再試一次。
      </p>
      <ReloadButton />
    </main>
  )
}
