import { encodeConnectionURL } from "@openlv/core";
import { createSession, type Session, SessionStatus } from "@openlv/session";
import { webrtc } from "@openlv/transport/webrtc";

export type TestDapp = {
  open: (relayUrl: string) => Promise<string>;
  request: (method: string, params?: unknown[]) => Promise<unknown>;
  status: () => SessionStatus | undefined;
  close: () => Promise<void>;
};

const createTestDapp = (): TestDapp => {
  let session: Session | undefined;
  let requestId = 0;

  return {
    open: async (relayUrl) => {
      session = await createSession({ p: "mqtt", s: relayUrl }, [webrtc({ iceServers: [] })], async () => null, {
        info: { identity: "sh.openlv.bench.dapp", name: "openlv bench dApp" },
      });
      await session.connect();

      return encodeConnectionURL(session.getHandshakeParameters());
    },
    request: async (method, params = []) => {
      if (!session) throw new Error("dApp has no session");

      await session.status.until(status => status === SessionStatus.CONNECTED);
      requestId += 1;

      return session.send({ jsonrpc: "2.0", id: requestId, method, params });
    },
    status: () => session?.status.get(),
    close: async () => {
      await session?.close();
    },
  };
};

declare global {
  var benchDapp: TestDapp;
}

globalThis.benchDapp = createTestDapp();
