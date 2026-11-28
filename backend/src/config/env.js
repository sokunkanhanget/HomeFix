import "dotenv/config";

// Central place for environment configuration. Sensitive values (database
// credentials, token secrets) come only from the environment or backend/.env,
// never from source code. See .env.example for every supported variable.

function readInteger(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive whole number.`);
  }
  return value;
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  port: readInteger("PORT", 3001),
  databaseUrl: process.env.DATABASE_URL || "",
  authTokenSecret: process.env.AUTH_TOKEN_SECRET || "",
  authTokenExpiresInSeconds: readInteger("AUTH_TOKEN_EXPIRES_IN_SECONDS", 86400),
});

// Returns human-readable problems with the configuration; an empty list means
// every required setting is present.
export function validateEnv(config = env) {
  const problems = [];
  if (!config.databaseUrl) problems.push("DATABASE_URL is not set; database features will be unavailable.");
  if (config.authTokenSecret.length < 32) {
    problems.push("AUTH_TOKEN_SECRET must be set to at least 32 characters; login and registration will fail.");
  }
  return problems;
}
