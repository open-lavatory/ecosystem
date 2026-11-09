import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import type { App } from "./descriptor.ts";
import { freePort, waitFor } from "./stack.ts";

export type RunningApp = { origin: string; stop: () => void };

// Outside bench/: TypeScript in an app build picks up bench/node_modules/@types from any parent directory.
const cacheDirectory = join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "openlv-bench");

const buildInput = (app: App, input: string, build: string[]) => {
  const variable = `BENCH_INPUT_${input.toUpperCase().replaceAll("-", "_")}`;
  const source = process.env[variable];

  if (!source) throw new Error(`${variable} is unset; run the bench through nix run ./bench or nix develop ./bench`);

  const buildHash = createHash("sha256").update(JSON.stringify(build)).digest("hex").slice(0, 12);
  const directory = join(cacheDirectory, app.appId, `${basename(source)}-${buildHash}`);
  const marker = join(directory, ".bench-built");

  if (existsSync(marker)) return directory;

  rmSync(directory, { recursive: true, force: true });
  mkdirSync(join(cacheDirectory, app.appId), { recursive: true });
  spawnSync("cp", ["-r", "--no-preserve=mode", source, directory], { stdio: "inherit" });

  const logPath = join(cacheDirectory, app.appId, "build.log");
  const log = openSync(logPath, "w");

  for (const command of build) {
    const result = spawnSync("bash", ["-c", command], { cwd: directory, stdio: ["ignore", log, log] });

    if (result.status !== 0) throw new Error(`${app.appId}: "${command}" failed, see ${logPath}\n${readFileSync(logPath, "utf8").slice(-2000)}`);
  }

  writeFileSync(marker, "");

  return directory;
};

export const startApp = async (app: App): Promise<RunningApp> => {
  if ("url" in app.source) return { origin: app.source.url.replace(/\/$/, ""), stop: () => {} };

  const directory = buildInput(app, app.source.input, app.source.build);
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn("bash", ["-c", app.source.serve.replaceAll("{port}", String(port))], { cwd: directory, stdio: "ignore", detached: true });

  const stop = () => {
    if (server.pid && server.exitCode === null) process.kill(-server.pid);
  };

  try {
    await waitFor(app.appId, async () => (await fetch(`${origin}${app.open}`)).ok, 60_000);
  }
  catch (error) {
    stop();
    throw error;
  }

  return { origin, stop };
};
