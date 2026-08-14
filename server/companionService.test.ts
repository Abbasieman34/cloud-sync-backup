import { beforeEach, describe, expect, it, vi } from "vitest";

const { backupDb, storage } = vi.hoisted(() => ({
  backupDb: {
    createSyncDevice: vi.fn(), getSyncDeviceByTokenHash: vi.fn(), getBackupSettings: vi.fn(), getFileByPath: vi.fn(), getLatestVersion: vi.fn(),
    setFileSyncState: vi.fn(), markSyncDeviceActive: vi.fn(), recordActivity: vi.fn(), getOrCreateManagedFile: vi.fn(), getNextVersionNumber: vi.fn(), createBackupVersion: vi.fn(),
    getVersionForDevice: vi.fn(), getFileForUser: vi.fn(),
  },
  storage: { storagePut: vi.fn(), storageGetSignedUrl: vi.fn() },
}));

vi.mock("./backupDb", () => backupDb);
vi.mock("./storage", () => storage);

import { createCompanionDevice, downloadCompanionVersion, syncCompanionFile } from "./companionService";

describe("local companion service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    backupDb.recordActivity.mockResolvedValue(undefined);
    backupDb.setFileSyncState.mockResolvedValue(undefined);
    backupDb.markSyncDeviceActive.mockResolvedValue(undefined);
  });

  it("creates a device-specific token and client-side encryption key while storing only wrapped key material", async () => {
    backupDb.createSyncDevice.mockResolvedValue({ id: 4, name: "Work laptop", createdAt: new Date() });

    const result = await createCompanionDevice(7, "Work laptop");

    expect(result.deviceToken).toHaveLength(43);
    expect(Buffer.from(result.encryptionKey, "base64")).toHaveLength(32);
    expect(backupDb.createSyncDevice).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, name: "Work laptop", tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/), wrappedKeyCiphertext: expect.any(String) }));
    expect(backupDb.createSyncDevice.mock.calls[0][0]).not.toHaveProperty("encryptionKey");
  });

  it("persists a client-encrypted local change as an immutable device version", async () => {
    backupDb.getSyncDeviceByTokenHash.mockResolvedValue({ id: 4, userId: 7 });
    backupDb.getBackupSettings.mockResolvedValue({ backupsEnabled: true, maxUploadMegabytes: 50 });
    backupDb.getFileByPath.mockResolvedValue(undefined);
    backupDb.getOrCreateManagedFile.mockResolvedValue({ id: 21, userId: 7 });
    backupDb.getNextVersionNumber.mockResolvedValue(1);
    storage.storagePut.mockResolvedValue({ key: "devices/7/4/21/v1.enc" });
    backupDb.createBackupVersion.mockResolvedValue({ id: 91, versionNumber: 1 });

    const result = await syncCompanionFile({ deviceToken: "a".repeat(43), fileName: "local.txt", logicalPath: "local.txt", mimeType: "text/plain", plaintextByteSize: 12, checksum: "b".repeat(64), ciphertextBase64: Buffer.from("ciphertext").toString("base64"), initializationVector: "iv", authenticationTag: "tag" });

    expect(backupDb.createBackupVersion).toHaveBeenCalledWith(expect.objectContaining({ fileId: 21, userId: 7, syncDeviceId: 4, sourceOperation: "device", encryptionAlgorithm: "aes-256-gcm-client" }));
    expect(storage.storagePut).toHaveBeenCalledWith(expect.stringContaining("devices/7/4/21/v1"), expect.any(Buffer), "application/octet-stream");
    expect(result).toEqual({ fileId: 21, versionId: 91, changed: true });
  });

  it("records a healthy sync without writing a redundant version when the local checksum is unchanged", async () => {
    backupDb.getSyncDeviceByTokenHash.mockResolvedValue({ id: 4, userId: 7 });
    backupDb.getBackupSettings.mockResolvedValue({ backupsEnabled: true, maxUploadMegabytes: 50 });
    backupDb.getFileByPath.mockResolvedValue({ id: 21, checksum: "c".repeat(64) });
    backupDb.getLatestVersion.mockResolvedValue({ id: 12 });

    const result = await syncCompanionFile({ deviceToken: "a".repeat(43), fileName: "local.txt", logicalPath: "local.txt", mimeType: "text/plain", plaintextByteSize: 12, checksum: "c".repeat(64), ciphertextBase64: Buffer.from("ciphertext").toString("base64"), initializationVector: "iv", authenticationTag: "tag" });

    expect(backupDb.createBackupVersion).not.toHaveBeenCalled();
    expect(result).toEqual({ fileId: 21, versionId: 12, changed: false });
  });

  it("returns only the client-encrypted restore payload to the paired local device", async () => {
    backupDb.getSyncDeviceByTokenHash.mockResolvedValue({ id: 4, userId: 7 });
    backupDb.getVersionForDevice.mockResolvedValue({ id: 55, fileId: 21, storageKey: "devices/7/4/21/v1.enc", initializationVector: "iv", authenticationTag: "tag", encryptionAlgorithm: "aes-256-gcm-client" });
    backupDb.getFileForUser.mockResolvedValue({ id: 21, displayName: "local.txt", logicalPath: "folder/local.txt", mimeType: "text/plain" });
    storage.storageGetSignedUrl.mockResolvedValue("https://example.test/device-version");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => Buffer.from("ciphertext") }));

    const result = await downloadCompanionVersion({ deviceToken: "a".repeat(43), versionId: 55 });

    expect(result).toMatchObject({ fileName: "local.txt", logicalPath: "folder/local.txt", ciphertextBase64: Buffer.from("ciphertext").toString("base64"), encryptionAlgorithm: "aes-256-gcm-client" });
    expect(storage.storageGetSignedUrl).toHaveBeenCalledWith("devices/7/4/21/v1.enc");
  });

  it("rejects synchronization requests from a revoked or unknown local device", async () => {
    backupDb.getSyncDeviceByTokenHash.mockResolvedValue(undefined);

    await expect(syncCompanionFile({ deviceToken: "a".repeat(43), fileName: "local.txt", logicalPath: "local.txt", mimeType: "text/plain", plaintextByteSize: 12, checksum: "d".repeat(64), ciphertextBase64: Buffer.from("ciphertext").toString("base64"), initializationVector: "iv", authenticationTag: "tag" })).rejects.toThrow("not paired or has been revoked");
  });
});
