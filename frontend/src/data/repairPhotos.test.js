import test from "node:test";
import assert from "node:assert/strict";
import { MAX_REPAIR_PHOTO_SIZE, MAX_REPAIR_PHOTOS, validateRepairPhotos } from "./repairPhotos.js";

function photo(type = "image/jpeg", size = 1024) {
  return { type, size };
}

test("allows supported photos within per-file and total-count limits", () => {
  assert.equal(validateRepairPhotos(Array.from({ length: MAX_REPAIR_PHOTOS }, () => photo("image/png", MAX_REPAIR_PHOTO_SIZE))), "");
});

test("rejects unsupported types, oversized files and photo counts over the limit", () => {
  assert.match(validateRepairPhotos([photo("image/gif")]), /Only PNG and JPG/);
  assert.match(validateRepairPhotos([photo("image/jpeg", MAX_REPAIR_PHOTO_SIZE + 1)]), /5 MB or smaller/);
  assert.match(validateRepairPhotos([photo()], MAX_REPAIR_PHOTOS), /up to 5 photos/);
});
