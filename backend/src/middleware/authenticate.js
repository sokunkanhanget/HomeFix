import { createHash } from "node:crypto";
import { pool } from "../config/database.js";

const SESSION_COOKIE = "homefix_session";

function sessionToken(request) {
  const cookies = request.headers.cookie?.split(";") || [];
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== SESSION_COOKIE) continue;
    try {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export function createAuthenticate(database = pool) {
  return async function authenticate(request, response, next) {
    const token = sessionToken(request);
    if (!token || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
      return response.status(401).json({ message: "Please log in to continue." });
    }

    try {
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const result = await database.query(`
        SELECT u.id, u.name, u.email, u.role
        FROM user_sessions us
        JOIN users u ON u.id = us.user_id
        WHERE us.token_hash = $1 AND us.expires_at > NOW()
      `, [tokenHash]);
      if (!result.rows.length) {
        return response.status(401).json({ message: "Your session has expired. Please log in again." });
      }
      request.user = result.rows[0];
      return next();
    } catch (error) {
      console.error("Authentication failed:", error.code || error.name);
      return response.status(500).json({ message: "Could not verify your session. Please try again." });
    }
  };
}

export const authenticate = createAuthenticate();
