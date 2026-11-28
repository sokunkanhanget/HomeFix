import { findApprovedShopById } from "../models/shopRegistrationModel.js";
import { AppError } from "../utils/AppError.js";

// Shop IDs are positive whole numbers that fit in PostgreSQL BIGINT.
const SHOP_ID_PATTERN = /^[1-9]\d{0,17}$/;

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toCategories(category) {
  if (typeof category !== "string" || !category.trim()) return [];
  return category.split(",").map((name) => name.trim()).filter(Boolean)
    .map((name) => ({ slug: slugify(name), name }));
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

// Builds the public view of a shop. Only business details are included:
// the owner's ID, name, email and phone are never part of the response.
export function toPublicShop(row) {
  return {
    id: String(row.id),
    name: row.name,
    description: row.description || "",
    location: row.address,
    address: row.address,
    phone: row.phone || null,
    email: row.email || null,
    categories: toCategories(row.category),
    operatingHours: row.operating_hours || null,
    serviceType: row.service_type || null,
    supportsEmergency: row.supports_emergency === true,
    verified: row.status === "approved",
    listedSince: toIso(row.reviewed_at || row.submitted_at),
  };
}

const notFound = () => AppError.notFound("Repair shop not found.");

export async function getPublicShopDetails(shopId, database) {
  // Any ID that cannot exist is answered exactly like a missing shop, so the
  // response never reveals whether a pending or rejected shop exists.
  if (typeof shopId !== "string" || !SHOP_ID_PATTERN.test(shopId)) throw notFound();
  const row = await findApprovedShopById(shopId, database);
  if (!row) throw notFound();
  return toPublicShop(row);
}
