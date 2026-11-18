import test from "node:test";
import assert from "node:assert/strict";
import { defaultShops, restoreServices, matchShops } from "./services.js";

test("saved categories replace original services and control request matching", () => {
  const directory = restoreServices({ cooltech: ["Refrigerator", "Washing Machine"] });
  assert.equal(matchShops(directory, "Air Conditioner").length, 0);
  assert.deepEqual(matchShops(directory, "Washing Machine").map((shop) => shop.id), ["cooltech"]);
  assert.equal(matchShops(directory, "Refrigerator").length, 2);
});
test("deselecting every category survives persistence and prevents matching", () => {
  const saved = JSON.parse(JSON.stringify({ cooltech: [] }));
  const directory = restoreServices(saved);
  assert.deepEqual(directory[0].services, []);
  assert.equal(matchShops(directory, "Air Conditioner").length, 0);
});
test("invalid stored categories are ignored and untouched providers retain defaults", () => {
  const directory = restoreServices({ cooltech: ["Unknown", "Refrigerator", "Refrigerator"], frostfix: "invalid" });
  assert.deepEqual(directory[0].services, ["Refrigerator"]);
  assert.deepEqual(directory[1].services, defaultShops[1].services);
  assert.deepEqual(restoreServices(null), defaultShops);
});
