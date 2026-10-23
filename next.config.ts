import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // E2E uses a separate output directory so it can run alongside the dev server
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Disable the dev indicator in E2E: it is fixed at the bottom left and covers buttons in the full-screen popup on phones
  devIndicators: process.env.E2E === "1" ? false : undefined,
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // design §8.2: the service worker is not cached, so updates take effect immediately
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ]
  },
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
