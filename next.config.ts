import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // E2E 使用獨立的輸出目錄，可以和開發中的 dev server 同時執行
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
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
