import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import express from "express";
import { createAuthRouter } from "./auth.js";

test("logout deletes the session and clears the cookie", async (t) => {
  const queries = [];
  const database = { async query(sql, values) { queries.push({ sql, values }); return { rows: [] }; } };
  const app = express();
  app.use("/api/auth", createAuthRouter(database));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/auth/logout`;

  const response = await fetch(url, { method: "POST", headers: { Cookie: "homefix_session=abc.def.ghi" } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /homefix_session=;.*Expires=Thu, 01 Jan 1970/);
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /DELETE FROM user_sessions/);
  assert.deepEqual(queries[0].values, [createHash("sha256").update("abc.def.ghi").digest("hex")]);

  const anonymous = await fetch(url, { method: "POST" });
  assert.equal(anonymous.status, 200, "logging out without a session still succeeds");
  assert.equal(queries.length, 1);
});
