import { defineConfig, devices } from "@playwright/test"

const PORT = 3300
const baseURL = `http://localhost:${PORT}`

/** R9 PWA 測試：service worker 只在 production 註冊（D20），因此以 production build 執行。 */
export default defineConfig({
  testDir: "tests/pwa",
  globalSetup: "./tests/e2e/global-setup.ts",
  workers: 1,
  reporter: "list",
  use: { baseURL },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `next build && next start --port ${PORT}`,
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { AI_MOCK: "1", NEXT_DIST_DIR: ".next-pwa" },
  },
})
