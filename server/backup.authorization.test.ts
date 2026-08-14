import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createUserContext(role: "user" | "admin" = "user"): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: 12,
      openId: "backup-api-test-user",
      name: "Backup API Test User",
      email: "backup-api-test@example.com",
      loginMethod: "manus",
      role,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("backup API authorization and validation", () => {
  it("prevents a non-owner from reading system-wide backup settings", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.backup.admin.settings()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects an invalid user-defined cron expression before attempting schedule creation", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.backup.createSchedule({ fileId: 1, name: "Invalid schedule", cronExpression: "0 9 * * *" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects an owner setting update outside the permitted upload limit", async () => {
    const caller = appRouter.createCaller(createUserContext("admin"));
    await expect(caller.backup.admin.updateSettings({ backupsEnabled: true, maxUploadMegabytes: 51 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
