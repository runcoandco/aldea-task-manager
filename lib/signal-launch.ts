import { createHmac, randomUUID } from "node:crypto";
import { signalTaskSyncSecret } from "@/lib/config";

const LAUNCH_TTL_MS = 60_000;

type SignalLaunchIdentity = {
  owner: string;
  role: "admin" | "user";
};

export function createSignalLaunchToken(identity: SignalLaunchIdentity) {
  const payload = Buffer.from(JSON.stringify({
    ...identity,
    exp: Date.now() + LAUNCH_TTL_MS,
    nonce: randomUUID()
  })).toString("base64url");

  const signature = createHmac("sha256", signalTaskSyncSecret())
    .update(`launch:${payload}`)
    .digest("base64url");

  return `${payload}.${signature}`;
}
