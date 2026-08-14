import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAuthenticatedContext(): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: 1,
      openId: "crypto-test-user",
      name: "Crypto Test User",
      email: "crypto@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("backup.cryptoReady", () => {
  it("validates the server encryption secret through the protected API endpoint", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    await expect(caller.backup.cryptoReady()).resolves.toMatchObject({
      ready: true,
      algorithm: "aes-256-gcm",
      keyLength: 32,
    });
  });
});
