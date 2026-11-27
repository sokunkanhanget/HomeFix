import { Router } from "express";
import { pool } from "../config/database.js";
import { authenticate } from "../middleware/authenticate.js";

const profileFields = new Set(["name", "description", "address", "phone", "operatingHours", "imageUrl"]);

function validateShopProfile(body) {
  const errors = {};
  for (const key of Object.keys(body || {})) {
    if (!profileFields.has(key)) errors[key] = "This field cannot be updated here.";
  }
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const address = typeof body?.address === "string" ? body.address.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const operatingHours = typeof body?.operatingHours === "string" ? body.operatingHours.trim() : "";
  const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";

  if (!name) errors.name = "Business name is required.";
  else if (name.length > 120) errors.name = "Business name must be 120 characters or fewer.";
  if (description.length > 1000) errors.description = "Description must be 1,000 characters or fewer.";
  if (!address) errors.address = "Business address is required.";
  else if (address.length > 240) errors.address = "Address must be 240 characters or fewer.";
  if (!phone) errors.phone = "Contact number is required.";
  else if (phone.length > 40 || !/^[+\d][\d\s().-]*$/.test(phone) || phone.replace(/\D/g, "").length < 8 || phone.replace(/\D/g, "").length > 15) {
    errors.phone = "Enter a valid contact number with 8 to 15 digits.";
  }
  if (operatingHours.length > 120) errors.operatingHours = "Operating hours must be 120 characters or fewer.";
  if (imageUrl.length > 2048) errors.imageUrl = "Image URL must be 2,048 characters or fewer.";
  else if (imageUrl) {
    try {
      if (!["https:", "http:"].includes(new URL(imageUrl).protocol)) throw new Error("Invalid protocol");
    } catch {
      errors.imageUrl = "Enter a valid http or https image URL.";
    }
  }

  return { errors, values: { name, description, address, phone, operatingHours, imageUrl: imageUrl || null } };
}

function profileJson(row) {
  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    address: row.address,
    location: row.location,
    phone: row.phone,
    operatingHours: row.operating_hours,
    imageUrl: row.image_url,
    status: row.status,
  };
}

function parseFilters(query) {
  const errors = Object.create(null);
  const filters = {};
  const allowed = new Set(["name", "location", "category", "page", "limit"]);
  for (const key of Object.keys(query)) {
    if (!allowed.has(key)) errors[key] = "Unknown query parameter.";
  }
  for (const [key, max] of [["name", 120], ["location", 240], ["category", 80]]) {
    const value = query[key];
    if (value === undefined) continue;
    if (typeof value !== "string") {
      errors[key] = "Provide a single text value.";
    } else if (value.trim().length > max) {
      errors[key] = `Must contain at most ${max} characters.`;
    } else if (value.includes("\0")) {
      errors[key] = "Must not contain null characters.";
    } else {
      filters[key] = value.trim();
    }
  }
  for (const [key, fallback, max] of [["page", 1, Number.MAX_SAFE_INTEGER], ["limit", 12, 100]]) {
    const value = query[key];
    const number = typeof value === "string" && /^[1-9]\d*$/.test(value) ? Number(value) : NaN;
    if (value === undefined) filters[key] = fallback;
    else if (!Number.isSafeInteger(number) || number > max) {
      errors[key] = `Must be an integer between 1 and ${max}.`;
    } else filters[key] = number;
  }
  if (filters.page && filters.limit && !Number.isSafeInteger((filters.page - 1) * filters.limit)) {
    errors.page = "Page offset is too large.";
  }
  return { filters, errors };
}

// Escape LIKE metacharacters so user text always means a literal substring.
function contains(value) {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

export function createShopsRouter(database = pool) {
  const router = Router();

  async function getOwnerShop(userId) {
    const result = await database.query(`
      SELECT id, owner_user_id, name, description, address, location, phone,
        operating_hours, image_url, status
      FROM shops WHERE owner_user_id = $1 ORDER BY id LIMIT 1
    `, [userId]);
    return result.rows[0] || null;
  }

  router.get("/owner/shop-profile", authenticate, async (request, response) => {
    if (request.user.role !== "shop_owner" && request.user.role !== "admin") {
      return response.status(403).json({ message: "A repair shop owner account is required." });
    }
    try {
      const shop = await getOwnerShop(request.user.id);
      if (!shop) return response.status(404).json({ message: "No shop is linked to this account." });
      return response.json({ data: profileJson(shop) });
    } catch (error) {
      console.error("Could not load owner shop profile:", error.code || error.name);
      return response.status(500).json({ message: "Could not load your shop profile." });
    }
  });

  router.put("/owner/shop-profile", authenticate, async (request, response) => {
    if (request.user.role !== "shop_owner") {
      return response.status(403).json({ message: "A repair shop owner account is required." });
    }
    const { errors, values } = validateShopProfile(request.body);
    if (Object.keys(errors).length) return response.status(400).json({ message: "Validation failed.", errors });
    try {
      const result = await database.query(`
        UPDATE shops
        SET name = $1, description = $2, address = $3, location = $3,
            phone = $4, operating_hours = $5, image_url = $6
        WHERE id = (SELECT id FROM shops WHERE owner_user_id = $7 ORDER BY id LIMIT 1)
          AND owner_user_id = $7
        RETURNING id, owner_user_id, name, description, address, location, phone,
          operating_hours, image_url, status
      `, [values.name, values.description, values.address, values.phone, values.operatingHours, values.imageUrl, request.user.id]);
      if (!result.rows.length) return response.status(404).json({ message: "No shop is linked to this account." });
      return response.json({ message: "Shop profile updated.", data: profileJson(result.rows[0]) });
    } catch (error) {
      console.error("Could not update owner shop profile:", error.code || error.name);
      return response.status(500).json({ message: "Could not save your shop profile." });
    }
  });

  router.get("/admin/shops/:shopId/profile", authenticate, async (request, response) => {
    if (request.user.role !== "admin") return response.status(403).json({ message: "Administrator access is required." });
    if (!/^[1-9]\d*$/.test(request.params.shopId)) return response.status(400).json({ message: "Invalid shop ID." });
    try {
      const result = await database.query(`
        SELECT id, owner_user_id, name, description, address, location, phone,
          operating_hours, image_url, status
        FROM shops WHERE id = $1
      `, [request.params.shopId]);
      if (!result.rows.length) return response.status(404).json({ message: "Shop not found." });
      return response.json({ data: profileJson(result.rows[0]) });
    } catch (error) {
      console.error("Administrator could not load shop profile:", error.code || error.name);
      return response.status(500).json({ message: "Could not load the shop profile." });
    }
  });

  router.put("/admin/shops/:shopId/profile", authenticate, async (request, response) => {
    if (request.user.role !== "admin") return response.status(403).json({ message: "Administrator access is required." });
    if (!/^[1-9]\d*$/.test(request.params.shopId)) return response.status(400).json({ message: "Invalid shop ID." });
    const { errors, values } = validateShopProfile(request.body);
    if (Object.keys(errors).length) return response.status(400).json({ message: "Validation failed.", errors });
    try {
      const result = await database.query(`
        UPDATE shops
        SET name = $1, description = $2, address = $3, location = $3,
            phone = $4, operating_hours = $5, image_url = $6
        WHERE id = $7
        RETURNING id, owner_user_id, name, description, address, location, phone,
          operating_hours, image_url, status
      `, [values.name, values.description, values.address, values.phone, values.operatingHours, values.imageUrl, request.params.shopId]);
      if (!result.rows.length) return response.status(404).json({ message: "Shop not found." });
      return response.json({ message: "Shop profile updated.", data: profileJson(result.rows[0]) });
    } catch (error) {
      console.error("Administrator could not update shop profile:", error.code || error.name);
      return response.status(500).json({ message: "Could not save the shop profile." });
    }
  });

  router.get("/service-categories", async (_request, response) => {
    try {
      const result = await database.query("SELECT slug, name FROM service_categories ORDER BY name, slug");
      response.json({ data: result.rows });
    } catch (error) {
      console.error("Could not load service categories:", error);
      response.status(500).json({ message: "Could not load service categories. Please try again." });
    }
  });

  router.get("/shops", async (request, response) => {
    const { filters, errors } = parseFilters(request.query);
    if (Object.keys(errors).length) {
      return response.status(400).json({ message: "Validation failed.", errors });
    }
    try {
      if (filters.category) {
        const category = await database.query("SELECT id FROM service_categories WHERE slug = $1", [filters.category]);
        if (!category.rows.length) {
          return response.status(400).json({
            message: "Validation failed.",
            errors: { category: "Unknown service category. Use a slug from /api/service-categories." },
          });
        }
      }
      const values = [];
      const bind = (value) => { values.push(value); return `$${values.length}`; };
      const conditions = ["s.status = 'approved'"];
      if (filters.name) conditions.push(`s.name ILIKE ${bind(contains(filters.name))} ESCAPE E'\\\\'`);
      if (filters.location) {
        const parameter = bind(contains(filters.location));
        conditions.push(`(s.location ILIKE ${parameter} ESCAPE E'\\\\' OR s.address ILIKE ${parameter} ESCAPE E'\\\\')`);
      }
      if (filters.category) {
        conditions.push(`EXISTS (
          SELECT 1 FROM shop_categories sc
          JOIN service_categories c ON c.id = sc.category_id
          WHERE sc.shop_id = s.id AND c.slug = ${bind(filters.category)}
        )`);
      }
      const limit = bind(filters.limit);
      const offset = bind((filters.page - 1) * filters.limit);
      // One statement gives the count and page the same database snapshot,
      // including when OFFSET is beyond the last matching shop.
      const result = await database.query(`
        WITH filtered AS (
          SELECT s.id, s.name, s.location, s.address, s.description, s.phone,
            s.operating_hours AS "operatingHours", s.image_url AS "imageUrl"
          FROM shops s WHERE ${conditions.join(" AND ")}
        ), paged AS (
          SELECT s.id::text AS id, s.name, s.location, s.address, s.description,
            s.phone, s."operatingHours", s."imageUrl",
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object('slug', c.slug, 'name', c.name) ORDER BY c.name, c.slug)
              FROM shop_categories sc JOIN service_categories c ON c.id = sc.category_id
              WHERE sc.shop_id = s.id
            ), '[]'::jsonb) AS categories
          FROM filtered s ORDER BY LOWER(s.name), s.id LIMIT ${limit} OFFSET ${offset}
        )
        SELECT (SELECT COUNT(*) FROM filtered) AS total,
          COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY LOWER(p.name), p.id::bigint)
            FROM paged p), '[]'::jsonb) AS data
      `, values);
      const { data, total: count } = result.rows[0];
      const total = Number(count);
      response.json({
        data,
        pagination: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) },
      });
    } catch (error) {
      console.error("Could not search shops:", error);
      response.status(500).json({ message: "Could not load repair shops. Please try again." });
    }
  });

  return router;
}

export default createShopsRouter();
