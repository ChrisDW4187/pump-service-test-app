import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "*.spec.js",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4173", headless: true },
  webServer: [
    {
      command: "python3 -m http.server 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
    },
    {
      command: "python3 -m http.server 4174 --directory ..",
      url: "http://127.0.0.1:4174/pump-service-test-app/",
      reuseExistingServer: true,
    },
  ],
});
