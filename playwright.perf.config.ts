import { defineConfig, devices } from "@playwright/test"

const PORT = 3200
const baseURL = `http://localhost:${PORT}`

/** NFR4 效能測試：以 production build 量測，結果受機器影響，不納入一般 E2E。 */
export default defineConfig({
  testDir: "tests/perf",
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
    env: { AI_MOCK: "1", NEXT_DIST_DIR: ".next-perf" },
  },
})
