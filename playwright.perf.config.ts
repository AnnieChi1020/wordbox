import { defineConfig, devices } from "@playwright/test"

const PORT = 3200
const baseURL = `http://localhost:${PORT}`

/** NFR4 performance tests: measured on a production build; results depend on the machine, so they are not part of the regular E2E run. */
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
