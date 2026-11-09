import { spawn, spawnSync } from "node:child_process";
import { createHash, type Hash } from "node:crypto";
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

import { cacheDirectory } from "./apps.ts";
import type { ScreenshotApp } from "./descriptor.ts";
import { freePort, waitFor } from "./stack.ts";

const benchDirectory = join(import.meta.dirname, "..");
export const shotsDirectory = join(benchDirectory, ".out", "screenshots");

export const patchShell = (app: ScreenshotApp, command: string) =>
  `nix develop ${join(benchDirectory, "..", "patches", app.source.patch)} --command bash -euo pipefail -c ${JSON.stringify(`cd src && ${command.replaceAll("{bench}", benchDirectory)}`)}`;

const hashFiles = (hash: Hash, directory: string, files: string[]) => {
  for (const file of files.toSorted()) {
    if (statSync(join(directory, file)).isFile()) hash.update(file).update(readFileSync(join(directory, file)));
  }
};

const buildPatch = (app: ScreenshotApp) => {
  const patchDirectory = join(benchDirectory, "..", "patches", app.source.patch);
  const hash = createHash("sha256").update(JSON.stringify(app.source.build));

  hashFiles(hash, patchDirectory, readdirSync(patchDirectory));

  for (const command of app.source.build) {
    for (const [, path = ""] of command.matchAll(/\{bench\}\/(\S+)/g)) {
      hashFiles(hash, benchDirectory, statSync(join(benchDirectory, path)).isDirectory() ? readdirSync(join(benchDirectory, path), { recursive: true, encoding: "utf8" }).map(file => join(path, file)) : [path]);
    }
  }

  const directory = join(cacheDirectory, app.appId, hash.digest("hex").slice(0, 12));
  const logPath = join(cacheDirectory, app.appId, "build.log");

  if (existsSync(join(directory, ".bench-built"))) return directory;

  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });

  const log = openSync(logPath, "w");

  for (const command of app.source.build) {
    const result = spawnSync("bash", ["-c", patchShell(app, command)], { cwd: directory, stdio: ["ignore", log, log] });

    if (result.status !== 0) throw new Error(`${app.appId}: "${command}" failed, see ${logPath}\n${readFileSync(logPath, "utf8").slice(-2000)}`);
  }

  writeFileSync(join(directory, ".bench-built"), "");

  return directory;
};

export type RunningPatch = { origin: string; directory: string; stop: () => void };

export const startPatch = async (app: ScreenshotApp): Promise<RunningPatch> => {
  const directory = buildPatch(app);

  if (!("serve" in app.source)) return { origin: "", directory, stop: () => {} };

  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn("bash", ["-c", patchShell(app, app.source.serve.replaceAll("{port}", String(port)))], { cwd: directory, stdio: "ignore", detached: true });
  const stop = () => {
    if (server.pid && server.exitCode === null) process.kill(-server.pid);
  };

  try {
    await waitFor(app.appId, async () => (await fetch(origin)).ok, 120_000);
  }
  catch (error) {
    stop();
    throw error;
  }

  return { origin, directory, stop };
};

export const compose = async () => {
  const assetsDirectory = join(benchDirectory, "..", ".github", "assets");
  const browser = await chromium.launch({ executablePath: process.env.BENCH_CHROMIUM, args: ["--allow-file-access-from-files"] });

  for (const layout of ["grid", "fan"]) {
    for (const theme of ["light", "dark"] as const) {
      const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2, colorScheme: theme });
      const failed: string[] = [];

      page.on("requestfailed", request => failed.push(request.url()));
      await page.goto(`${pathToFileURL(join(benchDirectory, "screenshots", "compose.html")).href}?d=${layout}&t=${theme}`, { waitUntil: "load" });

      if (failed.length > 0) throw new Error(`missing screenshots, run every app with --screenshots: ${failed.join(", ")}`);

      await page.locator("#stage").screenshot({ path: join(assetsDirectory, `${layout}-${theme}.png`), omitBackground: true, animations: "disabled" });
      await page.close();
    }
  }

  await browser.close();
  console.log(`grid and fan images written to ${assetsDirectory}`);
};
