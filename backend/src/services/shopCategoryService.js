import { pool } from "../config/database.js";
import {
  findLinkedCategoryIds,
  findRegistrationByOwner,
  findServiceCategories,
  replaceLinkedCategories,
  withTransaction,
} from "../models/shopCategoryModel.js";
import { AppError } from "../utils/AppError.js";

const OWNER_ROLES = new Set(["owner", "shop_owner"]);

const toPublicCategory = (category) => ({ slug: category.slug, name: category.name });

export function resolveCategory(value, catalog) {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  if (!key) return null;
  return catalog.find((category) => category.slug === key || category.name.toLowerCase() === key) || null;
}

function requireOwner(user) {
  if (!OWNER_ROLES.has(user?.role)) throw AppError.forbidden("A repair shop owner account is required.");
}

async function loadRegistration(user, database, options) {
  const registration = await findRegistrationByOwner(user.id, database, options);
  if (!registration) throw AppError.notFound("No shop is registered to this account.");
  return registration;
}

async function currentCategories(registration, catalog, database) {
  const linked = new Set(await findLinkedCategoryIds(registration.id, database));
  if (linked.size) return catalog.filter((category) => linked.has(String(category.id)));
  const main = catalog.find((category) => category.name === registration.category);
  return main ? [main] : [];
}

function sortByCatalog(categories, catalog) {
  return catalog.filter((category) => categories.some((selected) => selected.id === category.id));
}

async function saveCategories(registration, categories, database) {
  const main = categories.some((category) => category.name === registration.category)
    ? registration.category
    : categories[0].name;
  await replaceLinkedCategories(registration.id, categories.map((category) => String(category.id)), main, database);
}

function result(registration, categories, message) {
  return {
    ...(message ? { message } : {}),
    data: { shopId: String(registration.id), categories: categories.map(toPublicCategory) },
  };
}

export async function listServiceCategories(database = pool) {
  return { data: (await findServiceCategories(database)).map(toPublicCategory) };
}

export async function getOwnerCategories(user, database = pool) {
  requireOwner(user);
  const catalog = await findServiceCategories(database);
  const registration = await loadRegistration(user, database);
  return result(registration, await currentCategories(registration, catalog, database));
}

export function parseCategorySelection(body, catalog) {
  const values = body?.categories;
  if (!Array.isArray(values)) {
    throw AppError.badRequest("Validation failed.", { categories: "Provide categories as a list of category slugs." });
  }
  if (!values.length) {
    throw AppError.badRequest("Validation failed.", { categories: "Select at least one category." });
  }
  const invalid = values.filter((value) => !resolveCategory(value, catalog));
  if (invalid.length) {
    throw AppError.badRequest("Validation failed.", {
      categories: `Unknown categories: ${invalid.map((value) => JSON.stringify(value)).join(", ")}.`,
    });
  }
  const selected = values.map((value) => resolveCategory(value, catalog));
  const duplicates = [...new Set(selected.filter((category, index) => selected.indexOf(category) !== index))];
  if (duplicates.length) {
    throw AppError.badRequest("Validation failed.", {
      categories: `Each category can only be selected once: ${duplicates.map((category) => category.name).join(", ")}.`,
    });
  }
  return sortByCatalog(selected, catalog);
}

export async function replaceOwnerCategories(user, body, database = pool) {
  requireOwner(user);
  const catalog = await findServiceCategories(database);
  const selected = parseCategorySelection(body, catalog);
  return withTransaction(database, async (client) => {
    const registration = await loadRegistration(user, client, { lock: true });
    await saveCategories(registration, selected, client);
    return result(registration, selected, "Supported categories saved.");
  });
}

export async function addOwnerCategory(user, body, database = pool) {
  requireOwner(user);
  const catalog = await findServiceCategories(database);
  const category = resolveCategory(body?.category, catalog);
  if (!category) {
    throw AppError.badRequest("Validation failed.", { category: "Choose a category from the available service categories." });
  }
  return withTransaction(database, async (client) => {
    const registration = await loadRegistration(user, client, { lock: true });
    const current = await currentCategories(registration, catalog, client);
    if (current.some((item) => item.id === category.id)) {
      throw AppError.conflict(`${category.name} is already one of your shop's categories.`);
    }
    const next = sortByCatalog([...current, category], catalog);
    await saveCategories(registration, next, client);
    return result(registration, next, `${category.name} added to your shop's categories.`);
  });
}

export async function removeOwnerCategory(user, value, database = pool) {
  requireOwner(user);
  const catalog = await findServiceCategories(database);
  const category = resolveCategory(value, catalog);
  if (!category) {
    throw AppError.badRequest("Validation failed.", { category: "Choose a category from the available service categories." });
  }
  return withTransaction(database, async (client) => {
    const registration = await loadRegistration(user, client, { lock: true });
    const current = await currentCategories(registration, catalog, client);
    if (!current.some((item) => item.id === category.id)) {
      throw AppError.notFound(`${category.name} is not one of your shop's categories.`);
    }
    if (current.length === 1) {
      throw AppError.conflict("Your shop must support at least one category. Add another category before removing this one.");
    }
    const next = current.filter((item) => item.id !== category.id);
    await saveCategories(registration, next, client);
    return result(registration, next, `${category.name} removed from your shop's categories.`);
  });
}
