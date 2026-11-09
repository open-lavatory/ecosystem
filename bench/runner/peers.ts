import type { Browser, Page } from "@playwright/test";

import type { WalletChain, WalletRequest } from "../peers/wallet.ts";

export type WalletHandle = {
  page: Page;
  accounts: string[];
  join: (url: string, chains: WalletChain[]) => Promise<void>;
  status: () => Promise<string | undefined>;
  requests: () => Promise<WalletRequest[]>;
  activeChainId: () => Promise<number | undefined>;
  reject: (method: string, isRejecting: boolean) => Promise<void>;
  switchAccount: (index: number) => Promise<void>;
  switchChain: (chainId: number) => Promise<void>;
  close: () => Promise<void>;
};

export type DappHandle = {
  page: Page;
  open: (relayUrl: string) => Promise<string>;
  request: (method: string, params?: unknown[]) => Promise<unknown>;
  status: () => Promise<string | undefined>;
  close: () => Promise<void>;
};

const openPeerPage = async (browser: Browser, peersUrl: string, peer: "wallet" | "dapp") => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${peersUrl}/${peer}`);
  await page.waitForFunction(name => name in globalThis, peer === "wallet" ? "benchWallet" : "benchDapp");

  return page;
};

export const openWallet = async (browser: Browser, peersUrl: string): Promise<WalletHandle> => {
  const page = await openPeerPage(browser, peersUrl, "wallet");

  return {
    page,
    accounts: await page.evaluate(() => benchWallet.accounts),
    join: (url, chains) => page.evaluate(([joinUrl, joinChains]) => benchWallet.join(joinUrl, joinChains), [url, chains] as const),
    status: () => page.evaluate(() => benchWallet.status()),
    requests: () => page.evaluate(() => benchWallet.requests()),
    activeChainId: () => page.evaluate(() => benchWallet.activeChainId()),
    reject: (method, isRejecting) => page.evaluate(([rejectMethod, flag]) => benchWallet.reject(rejectMethod, flag), [method, isRejecting] as const),
    switchAccount: index => page.evaluate(accountIndex => benchWallet.switchAccount(accountIndex), index),
    switchChain: chainId => page.evaluate(id => benchWallet.switchChain(id), chainId),
    close: () => page.evaluate(() => benchWallet.close()),
  };
};

export const openDapp = async (browser: Browser, peersUrl: string): Promise<DappHandle> => {
  const page = await openPeerPage(browser, peersUrl, "dapp");

  return {
    page,
    open: relayUrl => page.evaluate(relay => benchDapp.open(relay), relayUrl),
    request: (method, params) => page.evaluate(([requestMethod, requestParams]) => benchDapp.request(requestMethod, requestParams), [method, params] as const),
    status: () => page.evaluate(() => benchDapp.status()),
    close: () => page.evaluate(() => benchDapp.close()),
  };
};
