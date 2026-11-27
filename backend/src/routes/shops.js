import { Router } from "express";
import { pool } from "../config/database.js";

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
          SELECT s.id, s.name, s.location, s.address, s.description
          FROM shops s WHERE ${conditions.join(" AND ")}
        ), paged AS (
          SELECT s.id::text AS id, s.name, s.location, s.address, s.description,
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
