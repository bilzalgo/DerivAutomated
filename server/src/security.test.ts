import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { decryptToken, encryptToken, newAccountId, pkcePair } from "./security";

test("account IDs use the G-Squad prefix and ten digits", () => {
  assert.match(newAccountId(), /^GSQ-\d{10}$/);
});

test("PKCE values are unique, URL-safe, and have a fresh state", () => {
  const first = pkcePair();
  const second = pkcePair();
  assert.match(first.verifier, /^[A-Za-z0-9_-]+$/);
  assert.match(first.challenge, /^[A-Za-z0-9_-]+$/);
  assert.equal(first.challenge, createHash("sha256").update(first.verifier).digest("base64url"));
  assert.notEqual(first.verifier, second.verifier);
  assert.notEqual(first.state, second.state);
});

test("Deriv tokens round-trip through authenticated encryption", () => {
  const previousKey = process.env.DERIV_TOKEN_ENCRYPTION_KEY;
  process.env.DERIV_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  try {
    const encrypted = encryptToken("deriv-access-token");
    assert.notEqual(encrypted.token_ciphertext, "deriv-access-token");
    assert.equal(decryptToken(encrypted), "deriv-access-token");
  } finally {
    if (previousKey === undefined) delete process.env.DERIV_TOKEN_ENCRYPTION_KEY;
    else process.env.DERIV_TOKEN_ENCRYPTION_KEY = previousKey;
  }
});