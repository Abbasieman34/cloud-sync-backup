import { parse as parseCookie } from "cookie";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { createHeartbeatJob, deleteHeartbeatJob, updateHeartbeatJob } from "../_core/heartbeat";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { verifyBackupEncryptionConfiguration } from "../backupCrypto";
import * as backupDb from "../backupDb";
import { createUserBackup, downloadDecryptedVersion, restoreVersion } from "../backupService";

const cronExpression = z.string().trim().refine(
  value => {
    const fields = value.split(/\s+/);
    return fields.length === 6 && fields[0] === "0";
  },
  "Use a six-field UTC cron expression with seconds set to 0, for example: 0 0 9 * * *."
);

function getSessionToken(cookieHeader: string | undefined) {
  return parseCookie(cookieHeader ?? "")[COOKIE_NAME] ?? "";
}

/** Internal protected endpoint used to verify the backup-encryption secret is usable. */
export const backupRouter = router({
  cryptoReady: protectedProcedure.query(() => {
    const configuration = verifyBackupEncryptionConfiguration();
    return { ready: true, ...configuration };
  }),
  listFiles: protectedProcedure.query(({ ctx }) => backupDb.listFilesForUser(ctx.user.id)),
  upload: protectedProcedure
    .input(z.object({
      fileName: z.string().trim().min(1).max(255),
      logicalPath: z.string().trim().min(1).max(512),
      mimeType: z.string().trim().max(255),
      dataBase64: z.string().min(1),
    }))
    .mutation(({ ctx, input }) => createUserBackup({ userId: ctx.user.id, ...input })),
  listVersions: protectedProcedure
    .input(z.object({ fileId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const file = await backupDb.getFileForUser(input.fileId, ctx.user.id);
      if (!file) throw new Error("The requested file was not found.");
      return backupDb.listVersionsForFile(file.id, ctx.user.id);
    }),
  restore: protectedProcedure
    .input(z.object({ versionId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => restoreVersion(ctx.user.id, input.versionId)),
  downloadVersion: protectedProcedure
    .input(z.object({ versionId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => downloadDecryptedVersion(ctx.user.id, input.versionId)),
  listSchedules: protectedProcedure.query(({ ctx }) => backupDb.listSchedulesForUser(ctx.user.id)),
  createSchedule: protectedProcedure
    .input(z.object({ fileId: z.number().int().positive(), name: z.string().trim().min(1).max(120), cronExpression }))
    .mutation(async ({ ctx, input }) => {
      const file = await backupDb.getFileForUser(input.fileId, ctx.user.id);
      if (!file) throw new Error("The requested file was not found.");
      const settings = await backupDb.getBackupSettings();
      if (!settings.backupsEnabled) throw new Error("System-wide backups are currently disabled by the owner.");
      const schedule = await backupDb.createSchedule({ userId: ctx.user.id, ...input });
      try {
        const job = await createHeartbeatJob({
          name: `backup-${schedule.id}`,
          cron: input.cronExpression,
          path: "/api/scheduled/backup",
          payload: { scheduleId: schedule.id },
          description: `Backup schedule for ${file.displayName}`,
        }, getSessionToken(ctx.req.headers.cookie));
        await backupDb.setScheduleTask(schedule.id, job.taskUid, job.nextExecutionAt ? new Date(job.nextExecutionAt) : null);
        return (await backupDb.getScheduleForUser(schedule.id, ctx.user.id))!;
      } catch (error) {
        await backupDb.deleteScheduleForUser(schedule.id, ctx.user.id);
        throw error;
      }
    }),
  updateSchedule: protectedProcedure
    .input(z.object({ scheduleId: z.number().int().positive(), cronExpression: cronExpression.optional(), enabled: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const schedule = await backupDb.getScheduleForUser(input.scheduleId, ctx.user.id);
      if (!schedule || !schedule.scheduleCronTaskUid) throw new Error("The requested backup schedule was not found.");
      const update = await updateHeartbeatJob(schedule.scheduleCronTaskUid, {
        ...(input.cronExpression ? { cron: input.cronExpression } : {}),
        ...(input.enabled !== undefined ? { enable: input.enabled } : {}),
      }, getSessionToken(ctx.req.headers.cookie));
      await backupDb.updateScheduleState({
        scheduleId: schedule.id,
        userId: ctx.user.id,
        ...(input.cronExpression ? { cronExpression: input.cronExpression } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(update.nextExecutionAt ? { nextRunAt: new Date(update.nextExecutionAt) } : {}),
      });
      return (await backupDb.getScheduleForUser(schedule.id, ctx.user.id))!;
    }),
  deleteSchedule: protectedProcedure
    .input(z.object({ scheduleId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const schedule = await backupDb.getScheduleForUser(input.scheduleId, ctx.user.id);
      if (!schedule) throw new Error("The requested backup schedule was not found.");
      if (schedule.scheduleCronTaskUid) await deleteHeartbeatJob(schedule.scheduleCronTaskUid, getSessionToken(ctx.req.headers.cookie));
      await backupDb.deleteScheduleForUser(schedule.id, ctx.user.id);
      return { success: true } as const;
    }),
  dashboard: protectedProcedure.query(({ ctx }) => backupDb.getDashboardMetrics(ctx.user.id)),
  activity: protectedProcedure.query(({ ctx }) => backupDb.listActivityForUser(ctx.user.id)),
  admin: router({
    users: adminProcedure.query(() => backupDb.listStorageByUser()),
    settings: adminProcedure.query(() => backupDb.getBackupSettings()),
    updateSettings: adminProcedure
      .input(z.object({ backupsEnabled: z.boolean(), maxUploadMegabytes: z.number().int().min(1).max(50) }))
      .mutation(({ ctx, input }) => backupDb.updateBackupSettings({ ...input, updatedByUserId: ctx.user.id })),
  }),
});
