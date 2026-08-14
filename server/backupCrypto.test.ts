import { describe, expect, it } from "vitest";
import { decryptBackup, encryptBackup } from "./backupCrypto";

describe("backup encryption", () => {
  it("round-trips file bytes using authenticated AES-256-GCM encryption", () => {
    const original = Buffer.from("Backup content must remain private and recoverable.", "utf8");
    const encrypted = encryptBackup(original);
    const restored = decryptBackup(encrypted);

    expect(encrypted.ciphertext.equals(original)).toBe(false);
    expect(encrypted.initializationVector).not.toEqual("");
    expect(encrypted.authenticationTag).not.toEqual("");
    expect(restored.equals(original)).toBe(true);
  });
});
