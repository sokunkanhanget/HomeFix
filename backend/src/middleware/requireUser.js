import { createHash } from "node:crypto";
import { pool } from "../config/database.js";
import { verifyAuthToken } from "../utils/authToken.js";
import { AppError } from "../utils/AppError.js";

const SESSION_COOKIE = "homefix_session";

function sessionToken(request) {
  const cookies = request.headers.cookie?.split(";") || [];
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== SESSION_COOKIE) continue;
    try {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    } catch {
      return "";
    }
  }
  return "";
}

// Requires a valid, unexpired login session for any role. The user's identity
// always comes from the signed session, never from the request body or URL.
// Sets request.user = { id, role }.
export function createRequireUser(database = pool) {
  return async function requireUser(request, _response, next) {
    const token = sessionToken(request);
    if (!token) return next(AppError.unauthorized());

    let claims;
    try {
      claims = verifyAuthToken(token, process.env.AUTH_TOKEN_SECRET);
    } catch {
      return next(AppError.unauthorized("Your session has expired. Please log in again."));
    }

    try {
      const result = await database.query(
        `SELECT users.id, users.role
         FROM users
         JOIN user_sessions ON user_sessions.user_id = users.id
         WHERE users.id = $1
           AND user_sessions.token_hash = $2
           AND user_sessions.expires_at > NOW()`,
        [claims.sub, createHash("sha256").update(token).digest("hex")],
      );
      const user = result.rows[0];
      if (!user) return next(AppError.unauthorized("Your session has expired. Please log in again."));
      request.user = { id: String(user.id), role: user.role };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const requireUser = createRequireUser();
