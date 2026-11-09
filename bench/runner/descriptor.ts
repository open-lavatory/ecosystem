import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { z } from "zod";

export const features = [
  "connect",
  "disconnect",
  "multiple_accounts",
  "personal_sign",
  "typed_data",
  "permit",
  "transaction",
  "chain_switch",
  "reject",
  "account_switch",
  "wallet_chain_switch",
] as const;

export type Feature = (typeof features)[number];

export const gaps: { feature: Feature; issue: string }[] = [
  { feature: "account_switch", issue: "open-lavatory#36" },
  { feature: "wallet_chain_switch", issue: "open-lavatory#36" },
];

const selector = z.string().min(1).describe("Playwright selector; {account0} and {account1} expand to the test wallet's addresses");

export const stepSchema = z.union([
  z.strictObject({ goto: z.string().startsWith("/").describe("Path on the app origin") }),
  z.strictObject({ click: selector }),
  z.strictObject({ visible: selector.describe("Wait until this selector is visible") }),
  z.strictObject({ hidden: selector.describe("Wait until this selector is hidden or gone") }),
  z.strictObject({ url: z.literal("clipboard").describe("Read the openlv connection URL and let the test wallet join it") }),
]);

export type Step = z.infer<typeof stepSchema>;

const requestSchema = z.discriminatedUnion("method", [
  z.strictObject({ method: z.literal("eth_accounts") }),
  z.strictObject({ method: z.literal("personal_sign"), message: z.string() }),
  z.strictObject({ method: z.literal("eth_signTypedData_v4"), primaryType: z.string() }),
  z.strictObject({ method: z.literal("eth_sendTransaction") }),
  z.strictObject({ method: z.literal("wallet_switchEthereumChain"), chainId: z.number().int().positive() }),
]);

export type ExpectedRequest = z.infer<typeof requestSchema>;

const actionSchema = z.strictObject({
  name: z.string().regex(/^[a-z0-9-]+$/),
  open: z.string().startsWith("/").optional().describe("Path to connect on for this action; defaults to the app's open"),
  features: z.array(z.enum(features).exclude(["connect", "disconnect", "reject", "account_switch", "wallet_chain_switch"])).min(1),
  steps: z.array(stepSchema).min(1).describe("Steps that make the app send the request"),
  request: requestSchema.describe("The request the test wallet must receive"),
  approved: z.array(stepSchema).min(1).describe("Steps that must pass after the wallet approves"),
  rejected: z.array(stepSchema).min(1).optional().describe("Steps that must pass after the wallet rejects with 4001"),
});

export type Action = z.infer<typeof actionSchema>;

const sourceSchema = z.union([
  z.strictObject({ url: z.url().describe("A live site; nothing is built") }),
  z.strictObject({
    input: z.literal("open-lavatory").describe("A flake input of bench/flake.nix"),
    build: z.array(z.string()).min(1).describe("Shell commands run once per input revision"),
    serve: z.string().includes("{port}").describe("Shell command that serves the build on {port}"),
  }),
]);

export const descriptorSchema = z.strictObject({
  $schema: z.string().optional(),
  name: z.string(),
  source: sourceSchema,
  chains: z.array(z.number().int().positive()).min(1).describe("Chains the app knows; the test wallet starts on the first"),
  rpc: z.record(z.string(), z.number().int().positive()).optional().describe("URL globs of the app's RPC, routed to the local chain with that id"),
  open: z.string().startsWith("/"),
  connect: z.array(stepSchema).min(1).refine(steps => steps.some(step => "url" in step), "connect needs a url step"),
  connected: z.array(stepSchema).min(1),
  disconnect: z.strictObject({
    steps: z.array(stepSchema).min(1),
    disconnected: z.array(stepSchema).min(1),
  }).optional(),
  actions: z.array(actionSchema),
});

export type Descriptor = z.infer<typeof descriptorSchema>;

export type App = Descriptor & { appId: string };

const appsDirectory = join(import.meta.dirname, "..", "apps");

export const loadApps = (): App[] =>
  readdirSync(appsDirectory)
    .filter(file => file.endsWith(".json") && file !== "descriptor.schema.json")
    .map((file) => {
      const appId = basename(file, ".json");
      const parsed = descriptorSchema.safeParse(JSON.parse(readFileSync(join(appsDirectory, file), "utf8")));

      if (!parsed.success) throw new Error(`apps/${file}: ${z.prettifyError(parsed.error)}`);

      return { ...parsed.data, appId };
    });
