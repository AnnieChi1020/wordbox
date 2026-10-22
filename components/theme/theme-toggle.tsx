"use client"

import { Moon, Sun } from "lucide-react"
import { useSyncExternalStore } from "react"

import { setTheme } from "@/lib/theme"

/** 監聽 <html> 的 class 變化，讓開關狀態與實際外觀一致。 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributeFilter: ["class"] })
  return () => observer.disconnect()
}

const isDark = () => document.documentElement.classList.contains("dark")

/**
 * R10.2：深色模式開關（開 = 深色）。初始狀態由根 layout 的 script 決定；
 * 伺服器端一律視為關閉，hydration 後再讀取實際狀態（design §8.4）。
 * 外觀以 dark: 樣式決定，hydration 前就與實際外觀一致。
 */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false)
  return (
    <label className="flex cursor-pointer items-center gap-2">
      {/* 圖示依目前外觀顯示：淺色為太陽、深色為月亮；以 dark: 樣式切換，hydration 前就正確 */}
      <Sun aria-hidden className="text-muted-foreground size-4 dark:hidden" />
      <Moon
        aria-hidden
        className="text-muted-foreground hidden size-4 dark:block"
      />
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        aria-label="深色模式"
        onClick={() => setTheme(!dark)}
        className="focus-visible:ring-ring/50 bg-input dark:bg-primary relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors outline-none focus-visible:ring-3"
      >
        <span
          aria-hidden
          className="bg-background size-4 translate-x-0 rounded-full shadow-sm transition-transform dark:translate-x-4"
        />
      </button>
    </label>
  )
}
