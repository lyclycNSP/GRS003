import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;
const inheritedNodeOptions = (process.env.NODE_OPTIONS ?? "")
  .split(/\s+/)
  .filter((option) => option && !/^--max[_-]old[_-]space[_-]size=/i.test(option));
const nodeOptions = [...inheritedNodeOptions, "--max-old-space-size=6144"].join(" ");

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      DATABASE_URL: "file:./e2e.db",
      ENABLE_DEBUG_LOGIN: "true",
      NEXT_DIST_DIR: "test-results/.next-e2e",
      NEXT_PUBLIC_APP_URL: baseURL,
      NEXT_TELEMETRY_DISABLED: "1",
      NODE_OPTIONS: nodeOptions
    }
  }
});
