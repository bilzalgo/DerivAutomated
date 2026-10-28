import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";

export function newAccountId(): string {
  const digits = randomBytes(8).readBigUInt64BE() % 10_000_000_000n;
  return `GSQ-${digits.toString().padStart(10, "0")}`;
}

function encryptionKey(): Buffer {
  const configured = process.env.DERIV_TOKEN_ENCRYPTION_KEY;
  if (!configured) throw new Error("Deriv credential encryption is not configured.");
  const key = Buffer.from(configured, "base64");
  if (key.length !== 32) throw new Error("DERIV_TOKEN_ENCRYPTION_KEY must be 32 bytes encoded as base64.");
  return key;
}

export function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    token_ciphertext: ciphertext.toString("base64"),
    token_iv: iv.toString("base64"),
    token_tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptToken(record: { token_ciphertext: string; token_iv: string; token_tag: string }): string {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(record.token_iv, "base64"));
  decipher.setAuthTag(Buffer.from(record.token_tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(record.token_ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function pkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge, state: randomUUID() };
}