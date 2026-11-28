import { createHmac, timingSafeEqual } from "node:crypto";

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(input, secret) {
  return createHmac("sha256", secret).update(input).digest();
}

export function issueAuthToken(user, secret, expiresInSeconds, now = Date.now()) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("AUTH_TOKEN_SECRET must be configured with at least 32 characters.");
  }
  if (!user?.id || typeof user.role !== "string" || !user.role) {
    throw new Error("A user ID and role are required to issue an authentication token.");
  }
  if (!Number.isSafeInteger(expiresInSeconds) || expiresInSeconds < 1) {
    throw new Error("Token expiration must be a positive whole number of seconds.");
  }

  const issuedAt = Math.floor(now / 1000);
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    sub: String(user.id),
    role: user.role,
    iat: issuedAt,
    exp: issuedAt + expiresInSeconds,
  });
  const input = `${header}.${payload}`;
  return `${input}.${sign(input, secret).toString("base64url")}`;
}

export function verifyAuthToken(token, secret, now = Date.now()) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("AUTH_TOKEN_SECRET must be configured with at least 32 characters.");
  }
  if (typeof token !== "string" || token.length > 8192) {
    throw new Error("Authentication token is invalid.");
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) {
    throw new Error("Authentication token is invalid.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const input = `${encodedHeader}.${encodedPayload}`;
  const providedSignature = Buffer.from(encodedSignature, "base64url");
  const expectedSignature = sign(input, secret);
  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    throw new Error("Authentication token is invalid.");
  }

  let header;
  let claims;
  try {
    header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw new Error("Authentication token is invalid.");
  }

  if (
    header.alg !== "HS256" ||
    header.typ !== "JWT" ||
    typeof claims.sub !== "string" ||
    !claims.sub ||
    typeof claims.role !== "string" ||
    !claims.role ||
    !Number.isSafeInteger(claims.exp) ||
    !Number.isSafeInteger(claims.iat) ||
    claims.iat > Math.floor(now / 1000) ||
    claims.exp <= claims.iat ||
    claims.exp <= Math.floor(now / 1000)
  ) {
    throw new Error("Authentication token is invalid or expired.");
  }

  return claims;
}
