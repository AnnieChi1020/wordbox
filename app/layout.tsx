import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"

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
}

export const metadata: Metadata = {
  title: "Wordbox",
  description: "用 AI 生成解釋、以 Leitner 盒子複習的英文單字本",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        {/* 放在上方，避免被手機底部分頁列擋住 */}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
