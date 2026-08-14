import { beforeEach, describe, expect, it, vi } from "vitest";

const { backupDb, storage } = vi.hoisted(() => ({
  backupDb: {
    getBackupSettings: vi.fn(), getFileByPath: vi.fn(), getLatestVersion: vi.fn(), setFileSyncState: vi.fn(), recordActivity: vi.fn(),
    getOrCreateManagedFile: vi.fn(), getNextVersionNumber: vi.fn(), createBackupVersion: vi.fn(), getFileForUser: vi.fn(), getVersionForUser: vi.fn(),
  },
  storage: { storagePut: vi.fn(), storageGetSignedUrl: vi.fn() },
}));

vi.mock("./backupDb", () => backupDb);
vi.mock("./storage", () => storage);

import { encryptBackup } from "./backupCrypto";
import { createUserBackup, restoreVersion } from "./backupService";

describe("backup service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    backupDb.getBackupSettings.mockResolvedValue({ backupsEnabled: true, maxUploadMegabytes: 50 });
    backupDb.getFileForUser.mockResolvedValue({ id: 21, userId: 7, displayName: "notes.txt", mimeType: "text/plain" });
    backupDb.recordActivity.mockResolvedValue(undefined);
    backupDb.setFileSyncState.mockResolvedValue(undefined);
  });

  it("encrypts and records a new immutable backup version for changed content", async () => {
    backupDb.getFileByPath.mockResolvedValue(undefined);
    backupDb.getOrCreateManagedFile.mockResolvedValue({ id: 21, userId: 7 });
    backupDb.getNextVersionNumber.mockResolvedValue(3);
    storage.storagePut.mockResolvedValue({ key: "backups/7/21/v3.enc" });
    backupDb.createBackupVersion.mockResolvedValue({ id: 55, versionNumber: 3 });

    const result = await createUserBackup({ userId: 7, fileName: "notes.txt", logicalPath: "notes.txt", mimeType: "text/plain", dataBase64: Buffer.from("version three").toString("base64") });

    expect(storage.storagePut).toHaveBeenCalledWith(expect.stringContaining("v3-"), expect.any(Buffer), "application/octet-stream");
    expect(backupDb.createBackupVersion).toHaveBeenCalledWith(expect.objectContaining({ fileId: 21, userId: 7, versionNumber: 3, sourceOperation: "backup", encryptionAlgorithm: "aes-256-gcm" }));
    expect(backupDb.setFileSyncState).toHaveBeenCalledWith(21, 7, "synced", expect.any(Date));
    expect(result.version).toMatchObject({ id: 55, versionNumber: 3 });
  });

  it("marks an unchanged file as synced without creating a redundant backup version", async () => {
    const unchangedContent = Buffer.from("unchanged content");
    const unchangedChecksum = "8223e31bd400e3aefb46949bc1172b245149771a7219ae52cf713455d92b2e41";
    backupDb.getFileByPath.mockResolvedValue({ id: 21, userId: 7, checksum: unchangedChecksum });
    backupDb.getLatestVersion.mockResolvedValue({ id: 44, versionNumber: 2 });

    await createUserBackup({ userId: 7, fileName: "notes.txt", logicalPath: "notes.txt", mimeType: "text/plain", dataBase64: unchangedContent.toString("base64") });

    expect(backupDb.getOrCreateManagedFile).not.toHaveBeenCalled();
    expect(backupDb.createBackupVersion).not.toHaveBeenCalled();
    expect(backupDb.recordActivity).toHaveBeenCalledWith(expect.objectContaining({ action: "sync", status: "success" }));
  });

  it("restores a selected encrypted version by creating a new restore snapshot", async () => {
    const original = Buffer.from("historical version");
    const encrypted = encryptBackup(original);
    backupDb.getVersionForUser.mockResolvedValue({ id: 4, fileId: 21, userId: 7, versionNumber: 1, storageKey: "backups/7/21/v1.enc", initializationVector: encrypted.initializationVector, authenticationTag: encrypted.authenticationTag });
    backupDb.getNextVersionNumber.mockResolvedValue(2);
    storage.storageGetSignedUrl.mockResolvedValue("https://example.test/encrypted");
    storage.storagePut.mockResolvedValue({ key: "backups/7/21/v2.enc" });
    backupDb.createBackupVersion.mockResolvedValue({ id: 8, versionNumber: 2 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => encrypted.ciphertext }));

    const result = await restoreVersion(7, 4);

    expect(backupDb.createBackupVersion).toHaveBeenCalledWith(expect.objectContaining({ sourceOperation: "restore", restoredFromVersionId: 4, versionNumber: 2 }));
    expect(backupDb.recordActivity).toHaveBeenCalledWith(expect.objectContaining({ action: "restore", status: "success" }));
    expect(result).toMatchObject({ id: 8, versionNumber: 2 });
  });
});
