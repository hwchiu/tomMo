import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_PORT || "18080";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node e2e/serve.mjs",
    url: `http://127.0.0.1:${port}/healthz`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD || "e2e-admin-pass",
      INITIAL_VIEWER_PASSWORD: process.env.INITIAL_VIEWER_PASSWORD || "e2e-viewer-pass",
      E2E_PORT: port,
    },
  },
});
