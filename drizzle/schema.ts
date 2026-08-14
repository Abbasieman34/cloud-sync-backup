import {
  bigint,
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** One logical web-managed file per user and path. Backup content lives in backupVersions. */
export const managedFiles = mysqlTable(
  "managed_files",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    logicalPath: varchar("logicalPath", { length: 512 }).notNull(),
    displayName: varchar("displayName", { length: 255 }).notNull(),
    mimeType: varchar("mimeType", { length: 255 }).notNull(),
    byteSize: bigint("byteSize", { mode: "number" }).notNull(),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    syncStatus: mysqlEnum("syncStatus", ["synced", "pending", "error"]).default("pending").notNull(),
    lastSyncedAt: timestamp("lastSyncedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    userPathUnique: uniqueIndex("managed_files_user_path_unique").on(table.userId, table.logicalPath),
    userSyncIndex: index("managed_files_user_sync_idx").on(table.userId, table.syncStatus),
  })
);

/** A paired local companion client. Its device key is encrypted by the server master key before database storage. */
export const syncDevices = mysqlTable(
  "sync_devices",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    wrappedKeyCiphertext: text("wrappedKeyCiphertext").notNull(),
    wrappedKeyInitializationVector: text("wrappedKeyInitializationVector").notNull(),
    wrappedKeyAuthenticationTag: text("wrappedKeyAuthenticationTag").notNull(),
    lastSyncedAt: timestamp("lastSyncedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    tokenUnique: uniqueIndex("sync_devices_token_hash_unique").on(table.tokenHash),
    userIndex: index("sync_devices_user_idx").on(table.userId),
  })
);

/** Immutable encrypted snapshot metadata for each backup and restore operation. */
export const backupVersions = mysqlTable(
  "backup_versions",
  {
    id: int("id").autoincrement().primaryKey(),
    fileId: int("fileId").notNull().references(() => managedFiles.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    syncDeviceId: int("syncDeviceId").references(() => syncDevices.id, { onDelete: "set null" }),
    versionNumber: int("versionNumber").notNull(),
    storageKey: varchar("storageKey", { length: 1024 }).notNull(),
    byteSize: bigint("byteSize", { mode: "number" }).notNull(),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    encryptionAlgorithm: varchar("encryptionAlgorithm", { length: 64 }).notNull(),
    initializationVector: text("initializationVector").notNull(),
    authenticationTag: text("authenticationTag").notNull(),
    sourceOperation: mysqlEnum("sourceOperation", ["backup", "restore", "scheduled", "device"]).notNull(),
    restoredFromVersionId: int("restoredFromVersionId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    fileVersionUnique: uniqueIndex("backup_versions_file_version_unique").on(table.fileId, table.versionNumber),
    userCreatedIndex: index("backup_versions_user_created_idx").on(table.userId, table.createdAt),
  })
);

/** A user-owned scheduled snapshot of one managed file. */
export const backupSchedules = mysqlTable(
  "backup_schedules",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    fileId: int("fileId").notNull().references(() => managedFiles.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    cronExpression: varchar("cronExpression", { length: 100 }).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
    lastRunAt: timestamp("lastRunAt"),
    lastRunStatus: mysqlEnum("lastRunStatus", ["success", "failed"]),
    nextRunAt: timestamp("nextRunAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    taskUidUnique: uniqueIndex("backup_schedules_task_uid_unique").on(table.scheduleCronTaskUid),
    userEnabledIndex: index("backup_schedules_user_enabled_idx").on(table.userId, table.enabled),
  })
);

/** Timestamped audit record for every backup, synchronization, restoration, and schedule result. */
export const activityLogs = mysqlTable(
  "activity_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    fileId: int("fileId").references(() => managedFiles.id, { onDelete: "set null" }),
    action: mysqlEnum("action", ["backup", "sync", "restore", "schedule"]).notNull(),
    status: mysqlEnum("status", ["success", "failed"]).notNull(),
    detail: varchar("detail", { length: 1000 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    userCreatedIndex: index("activity_logs_user_created_idx").on(table.userId, table.createdAt),
  })
);

/** Owner-managed system-wide backup controls. */
export const backupSettings = mysqlTable("backup_settings", {
  id: int("id").autoincrement().primaryKey(),
  backupsEnabled: boolean("backupsEnabled").default(true).notNull(),
  maxUploadMegabytes: int("maxUploadMegabytes").default(50).notNull(),
  updatedByUserId: int("updatedByUserId").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ManagedFile = typeof managedFiles.$inferSelect;
export type BackupVersion = typeof backupVersions.$inferSelect;
export type BackupSchedule = typeof backupSchedules.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type BackupSetting = typeof backupSettings.$inferSelect;
export type SyncDevice = typeof syncDevices.$inferSelect;
