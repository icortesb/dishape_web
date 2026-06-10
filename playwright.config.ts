import { defineConfig, devices } from "@playwright/test";

const PORT = 4321;
const BASE = `http://127.0.0.1:${PORT}`;

// Tests run against the real built node server (the same artifact deployed to
// the VPS), so route status codes and client JS behave exactly as in prod.
// The one thing CI cannot reproduce is the nginx edge layer — see
// tests/e2e/toggle.spec.ts for how we cover the invariant nginx depends on.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : "list",
  use: {
    baseURL: BASE,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && node ./dist/server/entry.mjs",
    url: BASE,
    env: { HOST: "127.0.0.1", PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
