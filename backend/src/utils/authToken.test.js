import test from "node:test";
import assert from "node:assert/strict";
import { issueAuthToken, verifyAuthToken } from "./authToken.js";

const secret = "local-test-secret-with-at-least-32-characters";
const now = 1_800_000_000_000;

test("authentication token carries user identity, role, and expiration", () => {
  const token = issueAuthToken({ id: 42, role: "owner" }, secret, 3600, now);
  const claims = verifyAuthToken(token, secret, now);

  assert.equal(claims.sub, "42");
  assert.equal(claims.role, "owner");
  assert.equal(claims.iat, now / 1000);
  assert.equal(claims.exp, now / 1000 + 3600);
});

test("authentication token verification rejects a bad signature and expired token", () => {
  const token = issueAuthToken({ id: 42, role: "customer" }, secret, 60, now);

  assert.throws(() => verifyAuthToken(token, `${secret}wrong`, now), /invalid/);
  assert.throws(() => verifyAuthToken(token, secret, now + 60_000), /expired/);
});

test("authentication token issuance rejects missing secrets and invalid expiry", () => {
  assert.throws(() => issueAuthToken({ id: 42, role: "customer" }, "short", 60, now), /AUTH_TOKEN_SECRET/);
  assert.throws(() => issueAuthToken({ id: 42, role: "customer" }, secret, 0, now), /expiration/);
});
