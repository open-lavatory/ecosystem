import { test as base } from "@playwright/test";

import { type RunningApp, startApp } from "./apps.ts";
import type { App } from "./descriptor.ts";
import { type DappHandle, openDapp, openWallet, type WalletHandle } from "./peers.ts";
import { type Stack, stackFromEnv } from "./stack.ts";
import type { StepScope } from "./steps.ts";

type AppPool = { start: (app: App) => Promise<RunningApp> };

type WorkerFixtures = {
  stack: Stack;
  appPool: AppPool;
};

type TestFixtures = {
  benchApp: App | undefined;
  runningApp: RunningApp | undefined;
  wallet: WalletHandle;
  dapp: DappHandle;
  scope: StepScope;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  stack: [async ({}, use) => use(stackFromEnv()), { scope: "worker" }],
  appPool: [async ({}, use) => {
    const running = new Map<string, Promise<RunningApp>>();

    await use({
      start: (app) => {
        const started = running.get(app.appId) ?? startApp(app);

        running.set(app.appId, started);

        return started;
      },
    });

    for (const started of await Promise.allSettled(running.values())) {
      if (started.status === "fulfilled") started.value.stop();
    }
  }, { scope: "worker" }],
  benchApp: [undefined, { option: true }],
  runningApp: [async ({ benchApp, appPool }, use) => use(benchApp ? await appPool.start(benchApp) : undefined), { timeout: 30 * 60_000 }],
  wallet: async ({ browser, stack }, use) => {
    const wallet = await openWallet(browser, stack.peersUrl);

    await use(wallet);
    await wallet.page.context().close();
  },
  dapp: async ({ browser, stack }, use) => {
    const dapp = await openDapp(browser, stack.peersUrl);

    await use(dapp);
    await dapp.page.context().close();
  },
  scope: async ({ benchApp, runningApp, stack, page, context, wallet }, use) => {
    if (!benchApp || !runningApp) throw new Error("scope needs test.use({ benchApp })");

    const chains = benchApp.chains.map((chainId) => {
      const chain = stack.chains.find(candidate => candidate.chainId === chainId);

      if (!chain) throw new Error(`no local chain ${chainId}`);

      return chain;
    });
    const settings = {
      version: 3,
      retainHistory: false,
      autoReconnect: false,
      signaling: { p: "mqtt", s: { mqtt: stack.relayUrl } },
      transport: { p: "webrtc" },
      theme: "system",
    };

    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: runningApp.origin });
    await context.addInitScript(value => localStorage.setItem("@openlv/connector/settings", value), JSON.stringify(settings));

    for (const [glob, chainId] of Object.entries(benchApp.rpc ?? {})) {
      const rpcUrl = chains.find(chain => chain.chainId === chainId)?.rpcUrl;

      if (!rpcUrl) throw new Error(`rpc ${glob} names chain ${chainId}, which is not in chains`);

      await context.route(glob, async route => route.fulfill({ response: await route.fetch({ url: rpcUrl }) }));
    }

    await use({ page, origin: runningApp.origin, wallet, chains });
  },
});
