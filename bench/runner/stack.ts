import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { connect, createServer as createTcpServer } from "node:net";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { build } from "esbuild";

import type { WalletChain } from "../peers/wallet.ts";
import { loadApps } from "./descriptor.ts";
import { isSchemaCurrent } from "./schema.ts";

const benchDirectory = join(import.meta.dirname, "..");
const outDirectory = join(benchDirectory, ".out");
const SELF_TEST_CHAINS = [1, 11_155_111];

export const freePort = () => {
  const { promise, resolve, reject } = Promise.withResolvers<number>();
  const server = createTcpServer();

  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();

    server.close(() => (typeof address === "object" && address ? resolve(address.port) : reject(new Error("no port"))));
  });

  return promise;
};

export const waitFor = async (label: string, isReady: () => Promise<boolean>, timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isReady().catch(() => false)) return;

    await sleep(250);
  }

  throw new Error(`${label} not ready after ${timeoutMs} ms`);
};

const isPortOpen = (port: number) => {
  const { promise, resolve } = Promise.withResolvers<boolean>();
  const socket = connect(port, "127.0.0.1");

  socket.once("connect", () => socket.end(() => resolve(true)));
  socket.once("error", () => resolve(false));

  return promise;
};

const startRelay = async (children: ChildProcess[]) => {
  const port = await freePort();
  const config = join(outDirectory, "mosquitto.conf");

  writeFileSync(config, `${readFileSync(join(benchDirectory, "relay", "mosquitto.conf"), "utf8")}listener ${port} 127.0.0.1\nprotocol websockets\n`);
  children.push(spawn("mosquitto", ["-c", config], { stdio: "ignore" }));
  await waitFor("mosquitto", () => isPortOpen(port), 10_000);

  return `ws://127.0.0.1:${port}`;
};

const startChain = async (chainId: number, children: ChildProcess[]): Promise<WalletChain> => {
  const port = await freePort();
  const rpcUrl = `http://127.0.0.1:${port}`;

  children.push(spawn("anvil", ["--host", "127.0.0.1", "--port", String(port), "--chain-id", String(chainId), "--silent"], { stdio: "ignore" }));
  await waitFor(`anvil ${chainId}`, async () => {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });

    return response.ok;
  }, 15_000);

  return { chainId, rpcUrl };
};

const startPeers = async (servers: Server[]) => {
  const peersOut = join(outDirectory, "peers");

  await build({
    entryPoints: ["wallet", "dapp"].map(peer => join(benchDirectory, "peers", `${peer}.ts`)),
    outdir: peersOut,
    bundle: true,
    format: "esm",
    logLevel: "warning",
  });

  const port = await freePort();
  const server = createServer((request, response) => {
    const peer = request.url?.match(/^\/(wallet|dapp)(\.js)?$/);

    if (!peer) return response.writeHead(404).end();

    if (peer[2]) return response.writeHead(200, { "content-type": "text/javascript" }).end(readFileSync(join(peersOut, `${peer[1]}.js`)));

    response.writeHead(200, { "content-type": "text/html" }).end(`<!doctype html><title>bench ${peer[1]}</title><script type="module" src="/${peer[1]}.js"></script>`);
  });

  const listening = Promise.withResolvers<void>();

  server.listen(port, "127.0.0.1", listening.resolve);
  await listening.promise;
  servers.push(server);

  return `http://127.0.0.1:${port}`;
};

export type Stack = { relayUrl: string; peersUrl: string; chains: WalletChain[] };

export const stackFromEnv = (): Stack => ({
  relayUrl: process.env.BENCH_RELAY ?? "",
  peersUrl: process.env.BENCH_PEERS ?? "",
  chains: JSON.parse(process.env.BENCH_CHAINS ?? "[]") as WalletChain[],
});

export default async () => {
  if (!isSchemaCurrent()) throw new Error("apps/descriptor.schema.json is stale, run pnpm schema");

  mkdirSync(outDirectory, { recursive: true });

  const children: ChildProcess[] = [];
  const servers: Server[] = [];
  const stop = () => {
    for (const child of children) child.kill();
    for (const server of servers) server.close();
  };

  try {
    const chainIds = [...new Set([...SELF_TEST_CHAINS, ...loadApps().flatMap(app => app.chains)])];

    process.env.BENCH_RELAY = await startRelay(children);

    const chains = await Promise.allSettled(chainIds.map(chainId => startChain(chainId, children)));
    const failedChain = chains.find(chain => chain.status === "rejected");

    if (failedChain) throw failedChain.reason;

    process.env.BENCH_CHAINS = JSON.stringify(chains.flatMap(chain => (chain.status === "fulfilled" ? [chain.value] : [])));
    process.env.BENCH_PEERS = await startPeers(servers);
  }
  catch (error) {
    stop();
    throw error;
  }

  return async () => stop();
};
