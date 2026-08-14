import type { Request, Response } from "express";
import * as backupDb from "./backupDb";
import { createScheduledBackup } from "./backupService";
import { sdk } from "./_core/sdk";

export async function scheduledBackupHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const schedule = await backupDb.getScheduleByTaskUid(user.taskUid);
    if (!schedule || !schedule.enabled) return res.json({ ok: true, skipped: "orphan-or-paused" });
    const settings = await backupDb.getBackupSettings();
    if (!settings.backupsEnabled) return res.json({ ok: true, skipped: "system-backups-disabled" });
    const version = await createScheduledBackup(schedule.id, schedule.userId, schedule.fileId);
    return res.json({ ok: true, scheduleId: schedule.id, versionId: version.id });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Scheduled backup failed.",
      context: { url: req.originalUrl },
      timestamp: new Date().toISOString(),
    });
  }
}
