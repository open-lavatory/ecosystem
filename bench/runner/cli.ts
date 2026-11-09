import { spawnSync } from "node:child_process";

import { features, loadApps, loadScreenshotApps } from "./descriptor.ts";
import { compose } from "./screenshots.ts";

const args = process.argv.slice(2);
const isScreenshots = args.includes("--screenshots");
const appIds = isScreenshots ? loadScreenshotApps().map(app => app.appId) : ["self", ...loadApps().map(app => app.appId)];
const selected: Record<"app" | "feature", string[]> = { app: [], feature: [] };
const passthrough: string[] = [];

while (args.length > 0) {
  const arg = args.shift() ?? "";

  if (arg === "--app" || arg === "--feature") selected[arg === "--app" ? "app" : "feature"].push(args.shift() ?? "");
  else if (arg !== "--screenshots") passthrough.push(arg);
}

for (const appId of selected.app) {
  if (!appIds.includes(appId)) throw new Error(`unknown app "${appId}", one of: ${appIds.join(", ")}`);
}

for (const feature of selected.feature) {
  if (!features.some(name => name === feature)) throw new Error(`unknown feature "${feature}", one of: ${features.join(", ")}`);
}

const lookahead = (prefix: string, names: string[]) => (names.length > 0 ? `(?=.*@${prefix}:(${names.join("|")})(\\s|$))` : "");
const grep = `${lookahead("app", selected.app)}${lookahead("feature", selected.feature)}`;
const project = isScreenshots ? ["--project", "screenshots", "--reporter", "list"] : ["--project", "bench"];
const result = spawnSync("pnpm", ["exec", "playwright", "test", ...project, ...(grep ? ["--grep", grep] : []), ...passthrough], { stdio: "inherit" });

if (isScreenshots && selected.app.length === 0 && result.status === 0) await compose();

process.exit(result.status ?? 1);
