"use client"

import { Moon, Sun } from "lucide-react"
import { useSyncExternalStore } from "react"

import { setTheme } from "@/lib/theme"

/** Watches the class on <html> so the switch state matches the actual appearance. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributeFilter: ["class"] })
  return () => observer.disconnect()
}

const isDark = () => document.documentElement.classList.contains("dark")

/**
 * R10.2: dark mode switch (on = dark). The initial state is decided by the script in the root layout;
 * the server always renders it as off, and the actual state is read after hydration (design §8.4).
 * Its look is driven by dark: styles, so it matches the actual appearance even before hydration.
 */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false)
  return (
    <label className="flex cursor-pointer items-center gap-2">
      {/* The icon follows the current appearance: a sun in light mode and a moon in dark mode; switched with dark: styles so it is right before hydration */}
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
