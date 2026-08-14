import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

export const BACKUP_ENCRYPTION_ALGORITHM = "aes-256-gcm";

export type EncryptedBackupPayload = {
  ciphertext: Buffer;
  initializationVector: string;
  authenticationTag: string;
};

function getBackupEncryptionKey(): Buffer {
  const configuredKey = process.env.BACKUP_ENCRYPTION_KEY?.trim() ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(configuredKey)) {
    throw new Error("BACKUP_ENCRYPTION_KEY must be a 32-byte hexadecimal value.");
  }
  return Buffer.from(configuredKey, "hex");
}

export function verifyBackupEncryptionConfiguration(): { algorithm: string; keyLength: number } {
  const key = getBackupEncryptionKey();
  return { algorithm: BACKUP_ENCRYPTION_ALGORITHM, keyLength: key.length };
}

export function encryptBackup(data: Buffer): EncryptedBackupPayload {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv(BACKUP_ENCRYPTION_ALGORITHM, getBackupEncryptionKey(), initializationVector);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();
  return {
    ciphertext,
    initializationVector: initializationVector.toString("base64"),
    authenticationTag: authenticationTag.toString("base64"),
  };
}

export function decryptBackup(payload: EncryptedBackupPayload): Buffer {
  const decipher = createDecipheriv(
    BACKUP_ENCRYPTION_ALGORITHM,
    getBackupEncryptionKey(),
    Buffer.from(payload.initializationVector, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.authenticationTag, "base64"));
  return Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]);
}
