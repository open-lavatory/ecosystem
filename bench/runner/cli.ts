import { spawnSync } from "node:child_process";

import { features, loadApps } from "./descriptor.ts";

const appIds = ["self", ...loadApps().map(app => app.appId)];
const selected: Record<"app" | "feature", string[]> = { app: [], feature: [] };
const passthrough: string[] = [];
const args = process.argv.slice(2);

while (args.length > 0) {
  const arg = args.shift() ?? "";

  if (arg === "--app" || arg === "--feature") selected[arg === "--app" ? "app" : "feature"].push(args.shift() ?? "");
  else passthrough.push(arg);
}

for (const appId of selected.app) {
  if (!appIds.includes(appId)) throw new Error(`unknown app "${appId}", one of: ${appIds.join(", ")}`);
}

for (const feature of selected.feature) {
  if (!features.some(name => name === feature)) throw new Error(`unknown feature "${feature}", one of: ${features.join(", ")}`);
}

const lookahead = (prefix: string, names: string[]) => (names.length > 0 ? `(?=.*@${prefix}:(${names.join("|")})(\\s|$))` : "");
const grep = `${lookahead("app", selected.app)}${lookahead("feature", selected.feature)}`;
const result = spawnSync("pnpm", ["exec", "playwright", "test", ...(grep ? ["--grep", grep] : []), ...passthrough], { stdio: "inherit" });

process.exit(result.status ?? 1);
