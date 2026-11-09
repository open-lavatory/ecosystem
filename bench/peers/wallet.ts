import { connectSession, type Session, SessionStatus } from "@openlv/session";
import { webrtc } from "@openlv/transport/webrtc";
import { type Address, createWalletClient, defineChain, type Hex, http, isHex, numberToHex } from "viem";
import { mnemonicToAccount } from "viem/accounts";

export type WalletChain = { chainId: number; rpcUrl: string };

export type WalletRequest = {
  method: string;
  params: unknown[];
  result?: unknown;
  error?: { code: number; message: string };
};

type RpcRequest = { id: number | string | null; method: string; params?: unknown[] };

type Outcome = { result: unknown } | { error: { code: number; message: string } };

const ANVIL_MNEMONIC = "test test test test test test test test test test test junk";

const accounts = [1, 2].map(addressIndex => mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex }));

const USER_METHODS: Record<string, true> = {
  eth_requestAccounts: true,
  personal_sign: true,
  eth_signTypedData_v4: true,
  eth_sendTransaction: true,
  wallet_switchEthereumChain: true,
};

const rejected = { error: { code: 4001, message: "User Rejected Request" } };
const unsupported = { error: { code: 4200, message: "Unsupported Method" } };
const unauthorized = { error: { code: 4100, message: "Unauthorized" } };

const findAccount = (address: unknown) => accounts.find(account => typeof address === "string" && account.address.toLowerCase() === address.toLowerCase());

export type TestWallet = {
  accounts: Address[];
  join: (url: string, chains: WalletChain[]) => Promise<void>;
  status: () => SessionStatus | undefined;
  requests: () => WalletRequest[];
  activeChainId: () => number | undefined;
  reject: (method: string, isRejecting: boolean) => void;
  close: () => Promise<void>;
};

const createTestWallet = (): TestWallet => {
  let session: Session | undefined;
  let chains: WalletChain[] = [];
  let activeChain: WalletChain | undefined;
  const log: WalletRequest[] = [];
  const rejecting = new Set<string>();

  const sign = async (method: string, params: unknown[]): Promise<Outcome> => {
    if (method === "personal_sign") {
      const [data, address] = params;
      const account = findAccount(address);

      if (!account || typeof data !== "string") return unauthorized;

      return { result: await account.signMessage({ message: isHex(data) ? { raw: data } : data }) };
    }

    const [address, raw] = params;
    const account = findAccount(address);

    if (!account || typeof raw !== "string") return unauthorized;

    const { types, domain, primaryType, message } = JSON.parse(raw);
    const { EIP712Domain: _, ...messageTypes } = types;

    return { result: await account.signTypedData({ domain, types: messageTypes, primaryType, message }) };
  };

  const send = async (params: unknown[], chain: WalletChain): Promise<Outcome> => {
    const [transaction] = params as [{ from?: string; to?: Hex; value?: Hex; data?: Hex; input?: Hex; gas?: Hex }];
    const account = findAccount(transaction.from);

    if (!account) return unauthorized;

    const client = createWalletClient({
      chain: defineChain({
        id: chain.chainId,
        name: `bench ${chain.chainId}`,
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [chain.rpcUrl] } },
      }),
      transport: http(chain.rpcUrl),
    });
    const hash = await client.sendTransaction({
      account,
      to: transaction.to,
      value: transaction.value ? BigInt(transaction.value) : undefined,
      data: transaction.data ?? transaction.input,
      gas: transaction.gas ? BigInt(transaction.gas) : undefined,
    });

    return { result: hash };
  };

  const answer = async (method: string, params: unknown[]): Promise<Outcome> => {
    if (!activeChain) throw new Error("wallet has no chain");

    if (USER_METHODS[method] && rejecting.has(method)) return rejected;

    if (method === "eth_accounts" || method === "eth_requestAccounts") return { result: accounts.map(account => account.address) };

    if (method === "eth_chainId") return { result: numberToHex(activeChain.chainId) };

    if (method === "personal_sign" || method === "eth_signTypedData_v4") return sign(method, params);

    if (method === "eth_sendTransaction") return send(params, activeChain);

    if (method === "wallet_switchEthereumChain") {
      const [{ chainId }] = params as [{ chainId: Hex }];
      const target = chains.find(chain => chain.chainId === Number(chainId));

      if (!target) return { error: { code: 4902, message: "Unrecognized chain" } };

      activeChain = target;

      return { result: null };
    }

    if (method.startsWith("eth_")) {
      const response = await fetch(activeChain.rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const body = await response.json() as Outcome;

      return "error" in body ? { error: body.error } : { result: body.result };
    }

    return unsupported;
  };

  const onMessage = async (message: unknown) => {
    const request = message as RpcRequest;
    const params = request.params ?? [];
    const outcome = await answer(request.method, params);

    log.push({ method: request.method, params, ...outcome });

    return { jsonrpc: "2.0", id: request.id, ...outcome };
  };

  return {
    accounts: accounts.map(account => account.address),
    join: async (url: string, walletChains: WalletChain[]) => {
      chains = walletChains;
      activeChain = walletChains[0];
      session = await connectSession(url, onMessage, [webrtc({ iceServers: [] })], {
        info: { identity: "sh.openlv.bench.wallet", name: "openlv bench wallet" },
      });
      await session.connect();
      await session.status.until(status => status === SessionStatus.CONNECTED || status === SessionStatus.DISCONNECTED);

      if (session.status.get() !== SessionStatus.CONNECTED) throw new Error(session.error.get() ?? "session did not connect");
    },
    status: () => session?.status.get(),
    requests: () => log,
    activeChainId: () => activeChain?.chainId,
    reject: (method: string, isRejecting: boolean) => {
      if (isRejecting) rejecting.add(method);
      else rejecting.delete(method);
    },
    close: async () => {
      await session?.close();
    },
  };
};

declare global {
  var benchWallet: TestWallet;
}

globalThis.benchWallet = createTestWallet();
