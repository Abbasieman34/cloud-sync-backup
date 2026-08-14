import { createHash, randomBytes } from "crypto";
import * as backupDb from "./backupDb";
import { encryptWithBackupKey } from "./backupCrypto";
import { storageGetSignedUrl, storagePut } from "./storage";

const BYTES_PER_MEGABYTE = 1024 * 1024;
const CLIENT_ENCRYPTION_ALGORITHM = "aes-256-gcm-client";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createCompanionDevice(userId: number, name: string) {
  const deviceToken = randomBytes(32).toString("base64url");
  const deviceKey = randomBytes(32);
  const wrappedKey = encryptWithBackupKey(deviceKey);
  const device = await backupDb.createSyncDevice({
    userId,
    name,
    tokenHash: hashToken(deviceToken),
    wrappedKeyCiphertext: wrappedKey.ciphertext.toString("base64"),
    wrappedKeyInitializationVector: wrappedKey.initializationVector,
    wrappedKeyAuthenticationTag: wrappedKey.authenticationTag,
  });
  return {
    device: { id: device.id, name: device.name, createdAt: device.createdAt },
    deviceToken,
    encryptionKey: deviceKey.toString("base64"),
    encryptionAlgorithm: CLIENT_ENCRYPTION_ALGORITHM,
  };
}

export async function authenticateCompanionDevice(deviceToken: string) {
  if (!deviceToken || deviceToken.length < 40) throw new Error("The companion device token is invalid.");
  const device = await backupDb.getSyncDeviceByTokenHash(hashToken(deviceToken));
  if (!device) throw new Error("The companion device is not paired or has been revoked.");
  return device;
}

export async function syncCompanionFile(input: {
  deviceToken: string;
  fileName: string;
  logicalPath: string;
  mimeType: string;
  plaintextByteSize: number;
  checksum: string;
  ciphertextBase64: string;
  initializationVector: string;
  authenticationTag: string;
}) {
  const device = await authenticateCompanionDevice(input.deviceToken);
  const settings = await backupDb.getBackupSettings();
  if (!settings.backupsEnabled) throw new Error("System-wide backups are currently disabled by the owner.");
  if (input.plaintextByteSize <= 0 || input.plaintextByteSize > settings.maxUploadMegabytes * BYTES_PER_MEGABYTE) {
    throw new Error(`This file exceeds the ${settings.maxUploadMegabytes} MB system upload limit.`);
  }
  if (!/^[a-f0-9]{64}$/i.test(input.checksum)) throw new Error("The local file checksum is invalid.");
  const ciphertext = Buffer.from(input.ciphertextBase64, "base64");
  if (!ciphertext.length || !input.initializationVector || !input.authenticationTag) throw new Error("The client-encrypted file payload is invalid.");

  const existing = await backupDb.getFileByPath(device.userId, input.logicalPath);
  if (existing?.checksum === input.checksum) {
    const latestVersion = await backupDb.getLatestVersion(existing.id, device.userId);
    if (latestVersion) {
      await backupDb.setFileSyncState(existing.id, device.userId, "synced", new Date());
      await backupDb.markSyncDeviceActive(device.id);
      await backupDb.recordActivity({ userId: device.userId, fileId: existing.id, action: "sync", status: "success", detail: `Local companion detected no changes for ${input.fileName}.` });
      return { fileId: existing.id, versionId: latestVersion.id, changed: false };
    }
  }

  const file = await backupDb.getOrCreateManagedFile({
    userId: device.userId,
    logicalPath: input.logicalPath,
    displayName: input.fileName,
    mimeType: input.mimeType || "application/octet-stream",
    byteSize: input.plaintextByteSize,
    checksum: input.checksum,
  });

  try {
    const versionNumber = await backupDb.getNextVersionNumber(file.id);
    const stored = await storagePut(`devices/${device.userId}/${device.id}/${file.id}/v${versionNumber}-${input.checksum}.enc`, ciphertext, "application/octet-stream");
    const version = await backupDb.createBackupVersion({
      fileId: file.id,
      userId: device.userId,
      syncDeviceId: device.id,
      versionNumber,
      storageKey: stored.key,
      byteSize: input.plaintextByteSize,
      checksum: input.checksum,
      encryptionAlgorithm: CLIENT_ENCRYPTION_ALGORITHM,
      initializationVector: input.initializationVector,
      authenticationTag: input.authenticationTag,
      sourceOperation: "device",
    });
    await backupDb.setFileSyncState(file.id, device.userId, "synced", new Date());
    await backupDb.markSyncDeviceActive(device.id);
    await backupDb.recordActivity({ userId: device.userId, fileId: file.id, action: "backup", status: "success", detail: `Local companion created encrypted version ${version.versionNumber}.` });
    await backupDb.recordActivity({ userId: device.userId, fileId: file.id, action: "sync", status: "success", detail: `Local companion synchronized ${input.fileName}.` });
    return { fileId: file.id, versionId: version.id, changed: true };
  } catch (error) {
    await backupDb.setFileSyncState(file.id, device.userId, "error");
    await backupDb.recordActivity({ userId: device.userId, fileId: file.id, action: "sync", status: "failed", detail: error instanceof Error ? error.message : "Local companion synchronization failed." });
    throw error;
  }
}

export async function downloadCompanionVersion(input: { deviceToken: string; versionId: number }) {
  const device = await authenticateCompanionDevice(input.deviceToken);
  const version = await backupDb.getVersionForDevice(input.versionId, device.id);
  if (!version) throw new Error("This encrypted version is not available to the paired companion device.");
  const file = await backupDb.getFileForUser(version.fileId, device.userId);
  if (!file) throw new Error("The managed file was not found.");
  const signedUrl = await storageGetSignedUrl(version.storageKey);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error("Unable to retrieve the encrypted local companion version.");
  const ciphertext = Buffer.from(await response.arrayBuffer());
  return {
    fileName: file.displayName,
    logicalPath: file.logicalPath,
    mimeType: file.mimeType,
    ciphertextBase64: ciphertext.toString("base64"),
    initializationVector: version.initializationVector,
    authenticationTag: version.authenticationTag,
    encryptionAlgorithm: version.encryptionAlgorithm,
  };
}
