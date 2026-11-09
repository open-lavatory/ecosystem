import { expect } from "@playwright/test";
import { stringToHex } from "viem";

import { awaitRequest, verifyApproved } from "../runner/checks.ts";
import type { ExpectedRequest, Feature } from "../runner/descriptor.ts";
import { test } from "../runner/fixtures.ts";
import type { DappHandle, WalletHandle } from "../runner/peers.ts";
import type { Stack } from "../runner/stack.ts";

const tags = (selfFeatures: Feature[]) => ["@app:self", ...selfFeatures.map(feature => `@feature:${feature}`)];

const pair = async (dapp: DappHandle, stack: Stack, wallet: WalletHandle) => {
  await wallet.join(await dapp.open(stack.relayUrl), stack.chains);
};

const roundTrip = async (dapp: DappHandle, wallet: WalletHandle, stack: Stack, expected: ExpectedRequest, params: unknown[]) => {
  const after = (await wallet.requests()).length;

  const response = await dapp.request(expected.method, params);
  const request = await awaitRequest(wallet, expected.method, after);

  await verifyApproved(request, expected, wallet, stack.chains);
  expect(response).toEqual({ jsonrpc: "2.0", id: expect.any(Number), result: request.result });
};

const permit = (owner: string, chainId: number) => ({
  types: {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ],
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
  primaryType: "Permit",
  domain: { name: "Bench Token", version: "1", chainId, verifyingContract: "0x0000000000000000000000000000000000000b0b" },
  message: { owner, spender: "0x0000000000000000000000000000000000000002", value: "1000000", nonce: "0", deadline: "4102444800" },
});

test.describe("self", () => {
  test("connect", { tag: tags(["connect", "multiple_accounts"]) }, async ({ dapp, stack, wallet }) => {
    await pair(dapp, stack, wallet);

    await roundTrip(dapp, wallet, stack, { method: "eth_accounts" }, []);
  });

  test("personal_sign", { tag: tags(["personal_sign"]) }, async ({ dapp, stack, wallet }) => {
    await pair(dapp, stack, wallet);

    await roundTrip(dapp, wallet, stack, { method: "personal_sign", message: "openlv bench" }, [stringToHex("openlv bench"), wallet.accounts[0]]);
  });

  test("permit", { tag: tags(["typed_data", "permit"]) }, async ({ dapp, stack, wallet }) => {
    await pair(dapp, stack, wallet);
    const owner = wallet.accounts[0] ?? "";

    await roundTrip(dapp, wallet, stack, { method: "eth_signTypedData_v4", primaryType: "Permit" }, [owner, JSON.stringify(permit(owner, 1))]);
  });

  test("transaction", { tag: tags(["transaction"]) }, async ({ dapp, stack, wallet }) => {
    await pair(dapp, stack, wallet);

    await roundTrip(dapp, wallet, stack, { method: "eth_sendTransaction" }, [{ from: wallet.accounts[0], to: wallet.accounts[1], value: "0x1" }]);
  });

  test("chain switch", { tag: tags(["chain_switch"]) }, async ({ dapp, stack, wallet }) => {
    await pair(dapp, stack, wallet);

    await roundTrip(dapp, wallet, stack, { method: "wallet_switchEthereumChain", chainId: 11_155_111 }, [{ chainId: "0xaa36a7" }]);
    expect(await dapp.request("eth_chainId")).toMatchObject({ result: "0xaa36a7" });
  });

  test("reject", { tag: tags(["reject"]) }, async ({ dapp, stack, wallet }) => {
    await pair(dapp, stack, wallet);

    await wallet.reject("personal_sign", true);
    expect(await dapp.request("personal_sign", [stringToHex("openlv bench"), wallet.accounts[0]])).toMatchObject({ error: { code: 4001 } });
  });

  test("disconnect", { tag: tags(["disconnect"]) }, async ({ dapp, stack, wallet }) => {
    await pair(dapp, stack, wallet);

    await dapp.close();
    await expect.poll(() => wallet.status(), { message: "wallet session ends" }).toBe("disconnected");
  });
});
