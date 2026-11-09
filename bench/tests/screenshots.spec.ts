import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect } from "@playwright/test";

import { loadScreenshotApps } from "../runner/descriptor.ts";
import { test } from "../runner/fixtures.ts";
import { patchShell, type RunningPatch, shotsDirectory, startPatch } from "../runner/screenshots.ts";
import { runSteps } from "../runner/steps.ts";

for (const app of loadScreenshotApps()) {
  test.describe(app.appId, () => {
    test.describe.configure({ timeout: 90 * 60_000 });

    let running: RunningPatch | undefined;

    test.beforeAll(async () => {
      test.setTimeout(90 * 60_000);
      mkdirSync(shotsDirectory, { recursive: true });
      running = await startPatch(app);
    });
    test.afterAll(() => running?.stop());

    if ("command" in app) {
      test("screenshot", { tag: `@app:${app.appId}` }, () => {
        const command = app.command.replaceAll("{out}", join(shotsDirectory, app.appId));
        const result = spawnSync("bash", ["-c", patchShell(app, command)], { cwd: running?.directory, stdio: "inherit" });

        expect(result.status, command).toBe(0);
      });

      return;
    }

    test.use({ viewport: app.viewport, deviceScaleFactor: 2, isMobile: app.mobile ?? false, hasTouch: app.mobile ?? false });

    for (const theme of ["light", "dark"] as const) {
      test.describe(theme, () => {
        test.use({ colorScheme: theme });

        test("screenshot", { tag: `@app:${app.appId}` }, async ({ page, wallet, dapp, stack }) => {
          const send = (method: string, params: unknown[]) => {
            dapp.request(method, params).catch(() => {});
          };

          await runSteps(app.steps, { page, origin: running?.origin ?? "", wallet, chains: [], dapp: { connectionUrl: () => dapp.open(stack.relayUrl), send } });
          await page.evaluate(() => document.fonts.ready);

          const element = app.element ? page.locator(app.element).first() : undefined;

          await element?.scrollIntoViewIfNeeded();

          const box = await element?.boundingBox();
          const clip = box ? { x: Math.ceil(box.x), y: Math.ceil(box.y), width: Math.floor(box.x + box.width) - Math.ceil(box.x), height: Math.floor(box.y + box.height) - Math.ceil(box.y) } : undefined;

          const shoot = () => page.screenshot({ clip, animations: "disabled", caret: "hide" });
          let previous: Buffer = Buffer.alloc(0);
          let shot = await shoot();

          for (let attempt = 0; attempt < 20 && !shot.equals(previous); attempt += 1) {
            previous = shot;
            await page.waitForTimeout(500);
            shot = await shoot();
          }

          writeFileSync(join(shotsDirectory, `${app.appId}-${theme}.png`), shot);
        });
      });
    }
  });
}
