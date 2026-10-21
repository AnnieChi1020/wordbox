import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // E2E 使用獨立的輸出目錄，可以和開發中的 dev server 同時執行
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // E2E 關閉開發指示器：它固定在左下角，會擋住手機全螢幕 popup 的按鈕
  devIndicators: process.env.E2E === "1" ? false : undefined,
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

export default nextConfig
