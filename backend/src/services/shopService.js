import { pool } from "../config/database.js";
import { countApprovedShops, findApprovedShops } from "../models/shopModel.js";
import { AppError } from "../utils/AppError.js";

// Public repair shop listing: validation, pagination and the response shape.

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 100;

function readPositiveInteger(query, name, fallback, errors) {
  const raw = query[name];
  if (raw === undefined) return fallback;
  if (typeof raw !== "string") {
    errors[name] = `Provide ${name} only once.`;
    return fallback;
  }
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    errors[name] = `${name[0].toUpperCase()}${name.slice(1)} must be a whole number of 1 or more.`;
    return fallback;
  }
  return Number(raw);
}

export function parsePagination(query = {}) {
  const errors = {};
  const page = readPositiveInteger(query, "page", 1, errors);
  const limit = readPositiveInteger(query, "limit", DEFAULT_PAGE_SIZE, errors);
  if (!errors.limit && limit > MAX_PAGE_SIZE) errors.limit = `Limit must be ${MAX_PAGE_SIZE} or less.`;
  if (!errors.page && !errors.limit && !Number.isSafeInteger((page - 1) * limit)) {
    errors.page = "Page is too large.";
  }
  if (Object.keys(errors).length) throw AppError.badRequest("Validation failed.", errors);
  return { page, limit, offset: (page - 1) * limit };
}

// Fallback slug for a category that is not in the service_categories catalog.
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function toPublicShop(row) {
  const category = row.category?.trim() || null;
  return {
    id: String(row.id),
    name: row.name,
    description: row.description || "",
    location: row.address,
    address: row.address,
    phone: row.phone || null,
    email: row.email || null,
    operatingHours: row.operating_hours || null,
    serviceType: row.service_type || null,
    supportsEmergency: row.supports_emergency === true,
    // Main category, kept for pages that filter shops by a single category.
    category,
    categories: category ? [{ slug: row.category_slug || slugify(category), name: category }] : [],
  };
}

export async function listApprovedShops(query, database = pool) {
  const { page, limit, offset } = parsePagination(query);
  const total = await countApprovedShops(database);
  const rows = total > offset ? await findApprovedShops({ limit, offset }, database) : [];
  return {
    data: rows.map(toPublicShop),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
