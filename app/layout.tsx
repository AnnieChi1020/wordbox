import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ServiceWorkerRegister } from "@/components/pwa/sw-register"
import { Toaster } from "@/components/ui/sonner"
import { THEME_INIT_SCRIPT } from "@/lib/theme"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets the bottom tab bar use safe-area-inset
  themeColor: "#086288", // brand color (design §8.3)
}

export const metadata: Metadata = {
  title: "Wordbox",
  description: "用 AI 生成解釋、以 Leitner 盒子複習的英文單字本",
  // R9.1: open in a standalone window after adding to the iOS home screen
  appleWebApp: { capable: true, title: "Wordbox", statusBarStyle: "default" },
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // .dark is added by the script in head before hydration (R10.3)
    <html
      lang="zh-Hant"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        {/* Placed at the top so the bottom tab bar on phones does not cover it */}
        <Toaster position="top-center" richColors />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
