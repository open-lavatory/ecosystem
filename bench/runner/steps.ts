import { expect, type Page } from "@playwright/test";

import type { WalletChain } from "../peers/wallet.ts";
import type { ScreenshotStep, Step } from "./descriptor.ts";
import type { WalletHandle } from "./peers.ts";

export type StepScope = {
  page: Page;
  origin: string;
  wallet: WalletHandle;
  chains: WalletChain[];
  dapp?: { connectionUrl: () => Promise<string>; send: (method: string, params: unknown[]) => void };
};

const STEP_TIMEOUT_MS = 30_000;

export const runSteps = async (steps: (Step | ScreenshotStep)[], { page, origin, wallet, chains, dapp }: StepScope) => {
  const expand = (selector: string) =>
    selector.replaceAll("{account0}", wallet.accounts[0] ?? "").replaceAll("{account1}", wallet.accounts[1] ?? "");

  for (const step of steps) {
    if ("goto" in step) {
      await page.goto(`${origin}${step.goto}`, { waitUntil: "networkidle" });
      continue;
    }

    if ("click" in step) {
      await page.locator(expand(step.click)).first().click({ timeout: STEP_TIMEOUT_MS });
      continue;
    }

    if ("select" in step) {
      await page.locator(expand(step.select)).first().selectOption(expand(step.option), { timeout: STEP_TIMEOUT_MS });
      continue;
    }

    if ("visible" in step) {
      await expect(page.locator(expand(step.visible)).first()).toBeVisible({ timeout: STEP_TIMEOUT_MS });
      continue;
    }

    if ("hidden" in step) {
      await expect(page.locator(expand(step.hidden)).filter({ visible: true })).toHaveCount(0, { timeout: STEP_TIMEOUT_MS });
      continue;
    }

    if ("accountsChanged" in step) {
      await wallet.switchAccount(step.accountsChanged);
      continue;
    }

    if ("chainChanged" in step) {
      await wallet.switchChain(step.chainChanged);
      continue;
    }

    if ("fill" in step) {
      const field = page.locator(expand(step.fill)).first();

      await field.fill(step.value.includes("{openlv}") && dapp ? step.value.replaceAll("{openlv}", await dapp.connectionUrl()) : step.value, { timeout: STEP_TIMEOUT_MS });
      await field.evaluate((element) => {
        element.scrollLeft = 0;
      });
      continue;
    }

    if ("tap" in step) {
      const target = page.locator(expand(step.tap)).filter({ visible: true }).first();

      await expect(target).toBeVisible({ timeout: STEP_TIMEOUT_MS });
      await target.dispatchEvent("click");
      continue;
    }

    if ("style" in step) {
      await page.addStyleTag({ content: step.style });
      continue;
    }

    if ("send" in step) {
      dapp?.send(step.send, step.params);
      continue;
    }

    let url = "";

    await expect.poll(async () => {
      url = await page.evaluate(() => navigator.clipboard.readText());

      return url;
    }, { message: "connection URL on the clipboard", timeout: STEP_TIMEOUT_MS }).toMatch(/^openlv:\/\//);
    await wallet.join(url, chains);
  }
};
