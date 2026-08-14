import { createHash } from "crypto";
import { BACKUP_ENCRYPTION_ALGORITHM, decryptBackup, encryptBackup } from "./backupCrypto";
import * as backupDb from "./backupDb";
import { storageGetSignedUrl, storagePut } from "./storage";

const BYTES_PER_MEGABYTE = 1024 * 1024;

function calculateChecksum(data: Buffer) {
  return createHash("sha256").update(data).digest("hex");
}

async function assertBackupsAllowed(byteSize: number) {
  const settings = await backupDb.getBackupSettings();
  if (!settings.backupsEnabled) throw new Error("System-wide backups are currently disabled by the owner.");
  if (byteSize > settings.maxUploadMegabytes * BYTES_PER_MEGABYTE) {
    throw new Error(`This file exceeds the ${settings.maxUploadMegabytes} MB system upload limit.`);
  }
}

async function storeEncryptedVersion(input: {
  fileId: number;
  userId: number;
  data: Buffer;
  checksum: string;
  sourceOperation: "backup" | "restore" | "scheduled";
  restoredFromVersionId?: number;
}) {
  const versionNumber = await backupDb.getNextVersionNumber(input.fileId);
  const encrypted = encryptBackup(input.data);
  const objectPath = `backups/${input.userId}/${input.fileId}/v${versionNumber}-${input.checksum}.enc`;
  const stored = await storagePut(objectPath, encrypted.ciphertext, "application/octet-stream");
  return backupDb.createBackupVersion({
    fileId: input.fileId,
    userId: input.userId,
    versionNumber,
    storageKey: stored.key,
    byteSize: input.data.byteLength,
    checksum: input.checksum,
    encryptionAlgorithm: BACKUP_ENCRYPTION_ALGORITHM,
    initializationVector: encrypted.initializationVector,
    authenticationTag: encrypted.authenticationTag,
    sourceOperation: input.sourceOperation,
    ...(input.restoredFromVersionId ? { restoredFromVersionId: input.restoredFromVersionId } : {}),
  });
}

async function readVersionContent(version: {
  storageKey: string;
  initializationVector: string;
  authenticationTag: string;
}) {
  const signedUrl = await storageGetSignedUrl(version.storageKey);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error("Unable to retrieve the encrypted backup object from cloud storage.");
  const ciphertext = Buffer.from(await response.arrayBuffer());
  return decryptBackup({ ciphertext, initializationVector: version.initializationVector, authenticationTag: version.authenticationTag });
}

export async function createUserBackup(input: {
  userId: number;
  fileName: string;
  logicalPath: string;
  mimeType: string;
  dataBase64: string;
}) {
  const content = Buffer.from(input.dataBase64, "base64");
  if (!content.length) throw new Error("The selected file is empty or has invalid upload data.");
  await assertBackupsAllowed(content.byteLength);
  const checksum = calculateChecksum(content);
  const existingFile = await backupDb.getFileByPath(input.userId, input.logicalPath);
  if (existingFile?.checksum === checksum) {
    const latestVersion = await backupDb.getLatestVersion(existingFile.id, input.userId);
    if (latestVersion) {
      await backupDb.setFileSyncState(existingFile.id, input.userId, "synced", new Date());
      await backupDb.recordActivity({ userId: input.userId, fileId: existingFile.id, action: "sync", status: "success", detail: "No content changes detected; encrypted backup is current." });
      return { file: (await backupDb.getFileForUser(existingFile.id, input.userId))!, version: latestVersion };
    }
  }
  const file = await backupDb.getOrCreateManagedFile({
    userId: input.userId,
    logicalPath: input.logicalPath,
    displayName: input.fileName,
    mimeType: input.mimeType || "application/octet-stream",
    byteSize: content.byteLength,
    checksum,
  });

  try {
    const version = await storeEncryptedVersion({
      fileId: file.id,
      userId: input.userId,
      data: content,
      checksum,
      sourceOperation: "backup",
    });
    await backupDb.setFileSyncState(file.id, input.userId, "synced", new Date());
    await backupDb.recordActivity({ userId: input.userId, fileId: file.id, action: "backup", status: "success", detail: `Created backup version ${version.versionNumber}.` });
    await backupDb.recordActivity({ userId: input.userId, fileId: file.id, action: "sync", status: "success", detail: "File content synchronized to encrypted cloud storage." });
    return { file: (await backupDb.getFileForUser(file.id, input.userId))!, version };
  } catch (error) {
    await backupDb.setFileSyncState(file.id, input.userId, "error");
    await backupDb.recordActivity({ userId: input.userId, fileId: file.id, action: "backup", status: "failed", detail: error instanceof Error ? error.message : "Backup failed." });
    throw error;
  }
}

export async function restoreVersion(userId: number, versionId: number) {
  const source = await backupDb.getVersionForUser(versionId, userId);
  if (!source) throw new Error("The selected backup version was not found.");
  if (source.encryptionAlgorithm === "aes-256-gcm-client") {
    throw new Error("This local-companion version must be restored by its paired local client, which holds the device encryption key.");
  }
  const file = await backupDb.getFileForUser(source.fileId, userId);
  if (!file) throw new Error("The managed file for this version was not found.");

  try {
    const content = await readVersionContent(source);
    const restored = await storeEncryptedVersion({
      fileId: file.id,
      userId,
      data: content,
      checksum: calculateChecksum(content),
      sourceOperation: "restore",
      restoredFromVersionId: source.id,
    });
    await backupDb.setFileSyncState(file.id, userId, "synced", new Date());
    await backupDb.recordActivity({ userId, fileId: file.id, action: "restore", status: "success", detail: `Restored version ${source.versionNumber} as current version ${restored.versionNumber}.` });
    await backupDb.recordActivity({ userId, fileId: file.id, action: "sync", status: "success", detail: "Restored content synchronized to encrypted cloud storage." });
    return restored;
  } catch (error) {
    await backupDb.setFileSyncState(file.id, userId, "error");
    await backupDb.recordActivity({ userId, fileId: file.id, action: "restore", status: "failed", detail: error instanceof Error ? error.message : "Restore failed." });
    throw error;
  }
}

export async function createScheduledBackup(scheduleId: number, userId: number, fileId: number) {
  const file = await backupDb.getFileForUser(fileId, userId);
  const latestVersion = await backupDb.getLatestVersion(fileId, userId);
  if (!file || !latestVersion) throw new Error("The scheduled file has no current backup version to snapshot.");

  try {
    const content = await readVersionContent(latestVersion);
    const version = await storeEncryptedVersion({
      fileId,
      userId,
      data: content,
      checksum: calculateChecksum(content),
      sourceOperation: "scheduled",
    });
    await backupDb.setFileSyncState(fileId, userId, "synced", new Date());
    await backupDb.markScheduleRun(scheduleId, "success");
    await backupDb.recordActivity({ userId, fileId, action: "backup", status: "success", detail: `Scheduled backup created version ${version.versionNumber}.` });
    await backupDb.recordActivity({ userId, fileId, action: "schedule", status: "success", detail: "Scheduled backup completed." });
    return version;
  } catch (error) {
    await backupDb.setFileSyncState(fileId, userId, "error");
    await backupDb.markScheduleRun(scheduleId, "failed");
    await backupDb.recordActivity({ userId, fileId, action: "schedule", status: "failed", detail: error instanceof Error ? error.message : "Scheduled backup failed." });
    throw error;
  }
}

export async function downloadDecryptedVersion(userId: number, versionId: number) {
  const version = await backupDb.getVersionForUser(versionId, userId);
  if (!version) throw new Error("The selected backup version was not found.");
  if (version.encryptionAlgorithm === "aes-256-gcm-client") {
    throw new Error("This local-companion version can only be downloaded and decrypted by its paired local client.");
  }
  const file = await backupDb.getFileForUser(version.fileId, userId);
  if (!file) throw new Error("The managed file for this version was not found.");
  const content = await readVersionContent(version);
  return { fileName: file.displayName, mimeType: file.mimeType, dataBase64: content.toString("base64") };
}
