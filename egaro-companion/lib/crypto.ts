// Encrypts the student's LMS password before it goes into the database.
// AES-256-GCM = encryption + tamper detection. The key lives only in the ENCRYPTION_KEY env variable,
// so a stolen database dump alone does not reveal passwords.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? "";
  // Accept 64 hex characters or a base64 string that decodes to 32 bytes.
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters). See .env.example.");
  }
  return key;
}

// Output format: v1:<iv>:<auth tag>:<ciphertext>, all base64.
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12); // a new random IV for every encryption
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const [version, iv, tag, data] = stored.split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unsupported encrypted value format.");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
