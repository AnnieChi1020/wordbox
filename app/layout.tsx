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
  viewportFit: "cover", // 讓底部分頁列可以使用 safe-area-inset
  themeColor: "#086288", // 品牌色（design §8.3）
}

export const metadata: Metadata = {
  title: "Wordbox",
  description: "用 AI 生成解釋、以 Leitner 盒子複習的英文單字本",
  // R9.1：iOS 加入主畫面後以獨立視窗開啟
  appleWebApp: { capable: true, title: "Wordbox", statusBarStyle: "default" },
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // .dark 由 head 的 script 在 hydration 前加上（R10.3）
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
        {/* 放在上方，避免被手機底部分頁列擋住 */}
        <Toaster position="top-center" richColors />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
