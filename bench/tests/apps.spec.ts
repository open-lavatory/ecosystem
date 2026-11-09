import { expect } from "@playwright/test";

import { awaitRequest, verifyApproved } from "../runner/checks.ts";
import { type App, type Feature, gaps, loadApps } from "../runner/descriptor.ts";
import { test } from "../runner/fixtures.ts";
import { runSteps, type StepScope } from "../runner/steps.ts";

const connect = async (app: App, scope: StepScope, path = app.open) => {
  await runSteps([{ goto: path }, ...app.connect], scope);
  await expect.poll(() => scope.wallet.status(), { message: "wallet session connected" }).toBe("connected");
  await runSteps(app.connected, scope);
};

for (const app of loadApps()) {
  test.describe(app.appId, () => {
    test.use({ benchApp: app });

    const tags = (appFeatures: Feature[]) => [`@app:${app.appId}`, ...appFeatures.map(feature => `@feature:${feature}`)];

    test("connect", { tag: tags(["connect"]) }, async ({ scope }) => {
      await connect(app, scope);
    });

    const { disconnect } = app;

    if (disconnect) {
      test("disconnect", { tag: tags(["disconnect"]) }, async ({ scope }) => {
        await connect(app, scope);
        await runSteps(disconnect.steps, scope);
        await expect.poll(() => scope.wallet.status(), { message: "wallet session ends" }).toBe("disconnected");
        await runSteps(disconnect.disconnected, scope);
      });
    }

    for (const action of app.actions) {
      test(action.name, { tag: tags(action.features) }, async ({ scope }) => {
        await connect(app, scope, action.open);

        const after = (await scope.wallet.requests()).length;

        await runSteps(action.steps, scope);
        await verifyApproved(await awaitRequest(scope.wallet, action.request.method, after), action.request, scope.wallet, scope.chains);
        await runSteps(action.approved, scope);
      });

      const { rejected } = action;

      if (rejected) {
        test(`${action.name} rejected`, { tag: tags(["reject"]) }, async ({ scope }) => {
          await connect(app, scope, action.open);
          await scope.wallet.reject(action.request.method, true);

          const after = (await scope.wallet.requests()).length;

          await runSteps(action.steps, scope);
          expect((await awaitRequest(scope.wallet, action.request.method, after)).error?.code).toBe(4001);
          await runSteps(rejected, scope);
        });
      }
    }

    for (const { feature, issue } of gaps) {
      test(feature, { tag: tags([feature]), annotation: { type: "gap", description: issue } }, () => {
        test.skip(true, `gap, ${issue}`);
      });
    }
  });
}
