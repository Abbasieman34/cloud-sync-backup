import { and, count, desc, eq, sql, sum } from "drizzle-orm";
import {
  activityLogs,
  backupSchedules,
  backupSettings,
  backupVersions,
  managedFiles,
  users,
} from "../drizzle/schema";
import { getDb } from "./db";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database connection is not available.");
  return db;
}

export async function getBackupSettings() {
  const db = await requireDb();
  const [settings] = await db.select().from(backupSettings).orderBy(backupSettings.id).limit(1);
  return settings ?? { backupsEnabled: true, maxUploadMegabytes: 50 };
}

export async function getFileForUser(fileId: number, userId: number) {
  const db = await requireDb();
  const [file] = await db
    .select()
    .from(managedFiles)
    .where(and(eq(managedFiles.id, fileId), eq(managedFiles.userId, userId)))
    .limit(1);
  return file;
}

export async function getFileByPath(userId: number, logicalPath: string) {
  const db = await requireDb();
  const [file] = await db
    .select()
    .from(managedFiles)
    .where(and(eq(managedFiles.userId, userId), eq(managedFiles.logicalPath, logicalPath)))
    .limit(1);
  return file;
}

export async function getOrCreateManagedFile(input: {
  userId: number;
  logicalPath: string;
  displayName: string;
  mimeType: string;
  byteSize: number;
  checksum: string;
}) {
  const db = await requireDb();
  const existing = await getFileByPath(input.userId, input.logicalPath);
  if (existing) {
    await db
      .update(managedFiles)
      .set({
        displayName: input.displayName,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        checksum: input.checksum,
        syncStatus: "pending",
      })
      .where(eq(managedFiles.id, existing.id));
    return (await getFileForUser(existing.id, input.userId))!;
  }

  await db.insert(managedFiles).values({ ...input, syncStatus: "pending" });
  const created = await getFileByPath(input.userId, input.logicalPath);
  if (!created) throw new Error("Failed to create the managed file record.");
  return created;
}

export async function setFileSyncState(
  fileId: number,
  userId: number,
  state: "synced" | "pending" | "error",
  lastSyncedAt?: Date
) {
  const db = await requireDb();
  await db
    .update(managedFiles)
    .set({ syncStatus: state, ...(lastSyncedAt ? { lastSyncedAt } : {}) })
    .where(and(eq(managedFiles.id, fileId), eq(managedFiles.userId, userId)));
}

export async function getNextVersionNumber(fileId: number) {
  const db = await requireDb();
  const [row] = await db
    .select({ highestVersion: sql<number>`coalesce(max(${backupVersions.versionNumber}), 0)` })
    .from(backupVersions)
    .where(eq(backupVersions.fileId, fileId));
  return Number(row?.highestVersion ?? 0) + 1;
}

export async function createBackupVersion(input: {
  fileId: number;
  userId: number;
  versionNumber: number;
  storageKey: string;
  byteSize: number;
  checksum: string;
  encryptionAlgorithm: string;
  initializationVector: string;
  authenticationTag: string;
  sourceOperation: "backup" | "restore" | "scheduled";
  restoredFromVersionId?: number;
}) {
  const db = await requireDb();
  await db.insert(backupVersions).values(input);
  const [version] = await db
    .select()
    .from(backupVersions)
    .where(and(eq(backupVersions.fileId, input.fileId), eq(backupVersions.versionNumber, input.versionNumber)))
    .limit(1);
  if (!version) throw new Error("Failed to record the encrypted backup version.");
  return version;
}

export async function listFilesForUser(userId: number) {
  const db = await requireDb();
  return db.select().from(managedFiles).where(eq(managedFiles.userId, userId)).orderBy(desc(managedFiles.updatedAt));
}

export async function listVersionsForFile(fileId: number, userId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(backupVersions)
    .where(and(eq(backupVersions.fileId, fileId), eq(backupVersions.userId, userId)))
    .orderBy(desc(backupVersions.versionNumber));
}

export async function getVersionForUser(versionId: number, userId: number) {
  const db = await requireDb();
  const [version] = await db
    .select()
    .from(backupVersions)
    .where(and(eq(backupVersions.id, versionId), eq(backupVersions.userId, userId)))
    .limit(1);
  return version;
}

export async function getLatestVersion(fileId: number, userId: number) {
  const db = await requireDb();
  const [version] = await db
    .select()
    .from(backupVersions)
    .where(and(eq(backupVersions.fileId, fileId), eq(backupVersions.userId, userId)))
    .orderBy(desc(backupVersions.versionNumber))
    .limit(1);
  return version;
}

export async function recordActivity(input: {
  userId: number;
  fileId?: number | null;
  action: "backup" | "sync" | "restore" | "schedule";
  status: "success" | "failed";
  detail: string;
}) {
  const db = await requireDb();
  await db.insert(activityLogs).values(input);
}

export async function createSchedule(input: {
  userId: number;
  fileId: number;
  name: string;
  cronExpression: string;
}) {
  const db = await requireDb();
  const result = await db.insert(backupSchedules).values(input);
  const scheduleId = Number(result[0].insertId);
  const [schedule] = await db.select().from(backupSchedules).where(eq(backupSchedules.id, scheduleId)).limit(1);
  if (!schedule) throw new Error("Failed to create the backup schedule.");
  return schedule;
}

export async function getScheduleForUser(scheduleId: number, userId: number) {
  const db = await requireDb();
  const [schedule] = await db
    .select()
    .from(backupSchedules)
    .where(and(eq(backupSchedules.id, scheduleId), eq(backupSchedules.userId, userId)))
    .limit(1);
  return schedule;
}

export async function getScheduleByTaskUid(taskUid: string) {
  const db = await requireDb();
  const [schedule] = await db
    .select()
    .from(backupSchedules)
    .where(eq(backupSchedules.scheduleCronTaskUid, taskUid))
    .limit(1);
  return schedule;
}

export async function listSchedulesForUser(userId: number) {
  const db = await requireDb();
  return db.select().from(backupSchedules).where(eq(backupSchedules.userId, userId)).orderBy(desc(backupSchedules.createdAt));
}

export async function setScheduleTask(scheduleId: number, taskUid: string, nextRunAt?: Date | null) {
  const db = await requireDb();
  await db
    .update(backupSchedules)
    .set({ scheduleCronTaskUid: taskUid, ...(nextRunAt ? { nextRunAt } : {}) })
    .where(eq(backupSchedules.id, scheduleId));
}

export async function updateScheduleState(input: {
  scheduleId: number;
  userId: number;
  cronExpression?: string;
  enabled?: boolean;
  nextRunAt?: Date | null;
}) {
  const db = await requireDb();
  await db
    .update(backupSchedules)
    .set({
      ...(input.cronExpression ? { cronExpression: input.cronExpression } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.nextRunAt !== undefined ? { nextRunAt: input.nextRunAt } : {}),
    })
    .where(and(eq(backupSchedules.id, input.scheduleId), eq(backupSchedules.userId, input.userId)));
}

export async function markScheduleRun(scheduleId: number, status: "success" | "failed") {
  const db = await requireDb();
  await db
    .update(backupSchedules)
    .set({ lastRunAt: new Date(), lastRunStatus: status })
    .where(eq(backupSchedules.id, scheduleId));
}

export async function deleteScheduleForUser(scheduleId: number, userId: number) {
  const db = await requireDb();
  await db.delete(backupSchedules).where(and(eq(backupSchedules.id, scheduleId), eq(backupSchedules.userId, userId)));
}

export async function getDashboardMetrics(userId: number) {
  const db = await requireDb();
  const [fileSummary] = await db
    .select({
      fileCount: count(managedFiles.id),
      storageBytes: sql<number>`coalesce(sum(${managedFiles.byteSize}), 0)`,
      syncedCount: sql<number>`coalesce(sum(case when ${managedFiles.syncStatus} = 'synced' then 1 else 0 end), 0)`,
      errorCount: sql<number>`coalesce(sum(case when ${managedFiles.syncStatus} = 'error' then 1 else 0 end), 0)`,
    })
    .from(managedFiles)
    .where(eq(managedFiles.userId, userId));
  const [versionSummary] = await db
    .select({ versionCount: count(backupVersions.id) })
    .from(backupVersions)
    .where(eq(backupVersions.userId, userId));
  return {
    fileCount: Number(fileSummary?.fileCount ?? 0),
    storageBytes: Number(fileSummary?.storageBytes ?? 0),
    syncedCount: Number(fileSummary?.syncedCount ?? 0),
    errorCount: Number(fileSummary?.errorCount ?? 0),
    versionCount: Number(versionSummary?.versionCount ?? 0),
  };
}

export async function listActivityForUser(userId: number, limit = 100) {
  const db = await requireDb();
  return db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      status: activityLogs.status,
      detail: activityLogs.detail,
      createdAt: activityLogs.createdAt,
      fileName: managedFiles.displayName,
    })
    .from(activityLogs)
    .leftJoin(managedFiles, eq(activityLogs.fileId, managedFiles.id))
    .where(eq(activityLogs.userId, userId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

export async function listStorageByUser() {
  const db = await requireDb();
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      fileCount: count(managedFiles.id),
      storageBytes: sql<number>`coalesce(sum(${managedFiles.byteSize}), 0)`,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .leftJoin(managedFiles, eq(users.id, managedFiles.userId))
    .groupBy(users.id, users.name, users.email, users.role, users.lastSignedIn)
    .orderBy(desc(sql`coalesce(sum(${managedFiles.byteSize}), 0)`));
}

export async function updateBackupSettings(input: {
  backupsEnabled: boolean;
  maxUploadMegabytes: number;
  updatedByUserId: number;
}) {
  const db = await requireDb();
  const [existing] = await db.select().from(backupSettings).orderBy(backupSettings.id).limit(1);
  if (existing) {
    await db
      .update(backupSettings)
      .set(input)
      .where(eq(backupSettings.id, existing.id));
  } else {
    await db.insert(backupSettings).values(input);
  }
  return getBackupSettings();
}
