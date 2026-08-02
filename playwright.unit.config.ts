import { defineConfig } from "@playwright/test";

// Unit tests for pure functions in src/lib. No webServer: these must never
// trigger a build. The e2e suite (playwright.config.ts) covers the real server.
export default defineConfig({
  testDir: "./tests/unit",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
});
