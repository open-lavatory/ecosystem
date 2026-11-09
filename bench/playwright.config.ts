import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  outputDir: ".out/results",
  globalSetup: "./runner/stack.ts",
  timeout: 120_000,
  workers: 1,
  reporter: [["list"], ["./runner/matrix.ts"]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.BENCH_CHROMIUM,
      args: ["--disable-features=WebRtcHideLocalIpsWithMdns,LocalNetworkAccessChecks"],
    },
  },
});
