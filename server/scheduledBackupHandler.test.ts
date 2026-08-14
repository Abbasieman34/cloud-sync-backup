import { describe, expect, it, vi } from "vitest";

const { authenticateRequest, getScheduleByTaskUid, getBackupSettings, createScheduledBackup } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getScheduleByTaskUid: vi.fn(),
  getBackupSettings: vi.fn(),
  createScheduledBackup: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest } }));
vi.mock("./backupDb", () => ({ getScheduleByTaskUid, getBackupSettings }));
vi.mock("./backupService", () => ({ createScheduledBackup }));

import { scheduledBackupHandler } from "./scheduledBackupHandler";

describe("scheduled backup handler", () => {
  it("executes the schedule identified by the authenticated cron task UID", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-123" });
    getScheduleByTaskUid.mockResolvedValue({ id: 11, userId: 7, fileId: 21, enabled: true });
    getBackupSettings.mockResolvedValue({ backupsEnabled: true });
    createScheduledBackup.mockResolvedValue({ id: 88 });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await scheduledBackupHandler({ originalUrl: "/api/scheduled/backup" } as any, res as any);

    expect(createScheduledBackup).toHaveBeenCalledWith(11, 7, 21);
    expect(res.json).toHaveBeenCalledWith({ ok: true, scheduleId: 11, versionId: 88 });
  });
});
