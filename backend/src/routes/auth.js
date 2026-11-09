import { randomBytes, scrypt as scryptCallback, createHash, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Router } from "express";
import { pool } from "../config/database.js";

const router = Router();
const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "homefix_session";
const SESSION_LENGTH = 32;
const ONE_DAY = 24 * 60 * 60 * 1000;

export async function initializeAuthSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx ON user_sessions (expires_at);
  `);
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  const [algorithm, saltHex, keyHex] = storedHash.split(":");
  if (algorithm !== "scrypt" || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function createSession(userId, response, rememberMe = false) {
  const token = randomBytes(SESSION_LENGTH).toString("base64url");
  const maxAge = rememberMe ? 30 * ONE_DAY : ONE_DAY;
  const expiresAt = new Date(Date.now() + maxAge);

  await pool.query("DELETE FROM user_sessions WHERE expires_at <= NOW()");
  await pool.query(
    "INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
    [hashSessionToken(token), userId, expiresAt],
  );

  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

router.post("/register", async (request, response) => {
  const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
  const email = normalizeEmail(request.body?.email);
  const phone = typeof request.body?.phone === "string" ? request.body.phone.trim() : "";
  const password = typeof request.body?.password === "string" ? request.body.password : "";

  if (!name || !email || !password) {
    return response.status(400).json({ message: "Name, email, and password are required." });
  }
  if (name.length > 120 || email.length > 254 || phone.length > 40) {
    return response.status(400).json({ message: "One or more fields are too long." });
  }
  if (!isValidEmail(email)) {
    return response.status(400).json({ message: "Please enter a valid email address." });
  }
  if (password.length < 8 || password.length > 128 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return response.status(400).json({ message: "Password must contain 8–128 characters, including a letter and a number." });
  }

  try {
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, phone, role`,
      [name, email, phone || null, passwordHash],
    );
    const user = result.rows[0];
    await createSession(user.id, response);
    return response.status(201).json({ message: "Your account has been created.", user });
  } catch (error) {
    if (error.code === "23505") {
      return response.status(409).json({ message: "An account with this email already exists. Please log in." });
    }
    console.error("Registration failed:", error);
    return response.status(500).json({ message: "Could not create your account. Please try again." });
  }
});

router.post("/login", async (request, response) => {
  const email = normalizeEmail(request.body?.email);
  const password = typeof request.body?.password === "string" ? request.body.password : "";
  const rememberMe = request.body?.rememberMe === true;

  if (!email || !password) {
    return response.status(400).json({ message: "Please enter your email and password." });
  }
  if (!isValidEmail(email) || password.length > 128) {
    return response.status(401).json({ message: "Email or password is incorrect." });
  }

  try {
    const result = await pool.query(
      "SELECT id, name, email, phone, role, password_hash FROM users WHERE email = $1",
      [email],
    );
    const user = result.rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return response.status(401).json({ message: "Email or password is incorrect." });
    }

    await createSession(user.id, response, rememberMe);
    delete user.password_hash;
    return response.json({ message: "You are now logged in.", user });
  } catch (error) {
    console.error("Login failed:", error);
    return response.status(500).json({ message: "Could not log in. Please try again." });
  }
});

export default router;
