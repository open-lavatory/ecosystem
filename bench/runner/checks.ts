import { expect } from "@playwright/test";
import { type Address, createPublicClient, type Hex, hexToString, http, isHex, verifyMessage, verifyTypedData } from "viem";

import type { WalletChain, WalletRequest } from "../peers/wallet.ts";
import type { ExpectedRequest } from "./descriptor.ts";
import type { WalletHandle } from "./peers.ts";

export const awaitRequest = async (wallet: WalletHandle, method: string, after: number) => {
  let request: WalletRequest | undefined;

  await expect.poll(async () => {
    request = (await wallet.requests()).slice(after).find(entry => entry.method === method);

    return request !== undefined;
  }, { message: `wallet receives ${method}`, timeout: 30_000 }).toBe(true);

  if (!request) throw new Error(`wallet received no ${method}`);

  return request;
};

export const verifyApproved = async (request: WalletRequest, expected: ExpectedRequest, wallet: WalletHandle, chains: WalletChain[]) => {
  expect(request.error, `${request.method} answered with an error`).toBeUndefined();

  if (expected.method === "eth_accounts") {
    expect(request.result).toEqual(wallet.accounts);

    return;
  }

  if (expected.method === "personal_sign") {
    const [data, address] = request.params as [string, Address];

    expect(isHex(data) ? hexToString(data) : data).toBe(expected.message);
    expect(await verifyMessage({ address, message: isHex(data) ? { raw: data } : data, signature: request.result as Hex })).toBe(true);

    return;
  }

  if (expected.method === "eth_signTypedData_v4") {
    const [address, raw] = request.params as [Address, string];
    const { types, domain, primaryType, message } = JSON.parse(raw);
    const { EIP712Domain: _, ...messageTypes } = types;

    expect(primaryType).toBe(expected.primaryType);
    expect(await verifyTypedData({ address, domain, types: messageTypes, primaryType, message, signature: request.result as Hex })).toBe(true);

    return;
  }

  if (expected.method === "eth_sendTransaction") {
    const activeChainId = await wallet.activeChainId();
    const chain = chains.find(candidate => candidate.chainId === activeChainId);

    if (!chain) throw new Error(`no local chain ${activeChainId}`);

    const client = createPublicClient({ transport: http(chain.rpcUrl) });
    const receipt = await client.waitForTransactionReceipt({ hash: request.result as Hex });

    expect(receipt.status).toBe("success");

    return;
  }

  const [{ chainId }] = request.params as [{ chainId: Hex }];

  expect(Number(chainId)).toBe(expected.chainId);
  expect(await wallet.activeChainId()).toBe(expected.chainId);
};
