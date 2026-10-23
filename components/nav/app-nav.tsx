"use client"

import { BookOpen, ChartColumn, Repeat, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

type NavItem = { href: string; label: string; icon: LucideIcon }

const NAV_ITEMS: NavItem[] = [
  { href: "/words", label: "單字", icon: BookOpen },
  { href: "/review", label: "複習", icon: Repeat },
  { href: "/dashboard", label: "統計", icon: ChartColumn },
]

function useIsActive() {
  const pathname = usePathname()
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`)
}

/** Desktop top navigation (NFR1). */
export function TopNav() {
  const isActive = useIsActive()
  return (
    <nav aria-label="主要導覽" className="hidden md:block">
      <ul className="flex gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "aria-[current=page]:bg-muted aria-[current=page]:text-primary",
              )}
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Phone bottom tab bar (NFR1). */
export function BottomNav() {
  const isActive = useIsActive()
  return (
    <nav
      aria-label="主要導覽"
      className="bg-background fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "text-muted-foreground flex h-14 flex-col items-center justify-center gap-1 text-xs",
                "aria-[current=page]:text-primary aria-[current=page]:font-medium",
              )}
            >
              <Icon aria-hidden className="size-5" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
