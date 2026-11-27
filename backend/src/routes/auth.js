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
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_unique ON users (LOWER(BTRIM(email)));

    CREATE TABLE IF NOT EXISTS user_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx ON user_sessions (expires_at);

    CREATE TABLE IF NOT EXISTS customers (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
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

async function createSession(userId, rememberMe = false, database = pool) {
  const token = randomBytes(SESSION_LENGTH).toString("base64url");
  const maxAge = rememberMe ? 30 * ONE_DAY : ONE_DAY;
  const expiresAt = new Date(Date.now() + maxAge);

  await database.query("DELETE FROM user_sessions WHERE expires_at <= NOW()");
  await database.query(
    "INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
    [hashSessionToken(token), userId, expiresAt],
  );

  return { token, options: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  } };
}

router.post("/register", async (request, response) => {
  const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
  const email = normalizeEmail(request.body?.email);
  const phone = typeof request.body?.phone === "string" ? request.body.phone.trim() : "";
  const password = typeof request.body?.password === "string" ? request.body.password : "";

  const errors = {};
  for (const [field, value] of Object.entries({ name, email, phone, password })) {
    if (request.body?.[field] != null && typeof request.body[field] !== "string") {
      errors[field] = `${field[0].toUpperCase() + field.slice(1)} must be a string.`;
    } else if (!value.trim()) {
      errors[field] = `${field[0].toUpperCase() + field.slice(1)} is required.`;
    }
  }
  for (const [field, value, limit] of [["name", name, 120], ["email", email, 254], ["phone", phone, 40]]) {
    if (!errors[field] && value.length > limit) errors[field] = `${field[0].toUpperCase() + field.slice(1)} must be ${limit} characters or fewer.`;
  }
  if (!errors.email && !isValidEmail(email)) errors.email = "Please enter a valid email address.";
  if (!errors.password && (password.length < 8 || password.length > 128 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password))) {
    errors.password = "Password must contain 8-128 characters, including a letter and a number.";
  }
  if (Object.keys(errors).length) {
    return response.status(400).json({ message: "Validation failed.", errors });
  }

  let client;
  try {
    const passwordHash = await hashPassword(password);
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO users (name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, 'customer')
       RETURNING id, name, email, phone, role`,
      [name, email, phone, passwordHash],
    );
    const user = result.rows[0];
    await client.query("INSERT INTO customers (user_id) VALUES ($1)", [user.id]);
    const session = await createSession(user.id, false, client);
    await client.query("COMMIT");
    response.cookie(SESSION_COOKIE, session.token, session.options);
    return response.status(201).json({ message: "Your account has been created.", user });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Registration rollback failed:", rollbackError.code);
      }
    }
    if (error.code === "23505" && ["users_email_key", "users_email_normalized_unique"].includes(error.constraint)) {
      return response.status(409).json({
        message: "An account with this email already exists. Please log in.",
        errors: { email: "An account with this email already exists." },
      });
    }
    console.error("Registration failed:", error.code || error.name);
    return response.status(500).json({ message: "Could not create your account. Please try again." });
  } finally {
    client?.release();
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
      "SELECT id, name, email, phone, role, password_hash FROM users WHERE LOWER(BTRIM(email)) = $1",
      [email],
    );
    const user = result.rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return response.status(401).json({ message: "Email or password is incorrect." });
    }

    const session = await createSession(user.id, rememberMe);
    response.cookie(SESSION_COOKIE, session.token, session.options);
    delete user.password_hash;
    return response.json({ message: "You are now logged in.", user });
  } catch (error) {
    console.error("Login failed:", error);
    return response.status(500).json({ message: "Could not log in. Please try again." });
  }
});

export default router;
