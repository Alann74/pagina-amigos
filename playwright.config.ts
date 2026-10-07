import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

// En el entorno de Claude Code el Chromium viene preinstalado en /opt/pw-browsers
const localChromium = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = process.env.PW_CHROMIUM_PATH ?? (fs.existsSync(localChromium) ? localChromium : undefined);
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const INSTAGRAM_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0 (iPhone14,5; iOS 17_5; es_AR; es-AR; scale=3.00; 1170x2532; 0)";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    { name: "mobile-375", use: { ...devices["iPhone 13"], viewport: { width: 375, height: 812 }, defaultBrowserType: "chromium" } },
    { name: "instagram-in-app", use: { ...devices["iPhone 13"], viewport: { width: 375, height: 812 }, userAgent: INSTAGRAM_UA, defaultBrowserType: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run start", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
