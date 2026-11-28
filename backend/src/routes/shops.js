import { createHash } from "node:crypto";
import { Router } from "express";
import { verifyAuthToken } from "../authToken.js";
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

const SESSION_COOKIE = "homefix_session";

export async function initializeShopSchema(database = pool) {
  await database.query(`
    CREATE TABLE IF NOT EXISTS shop_registrations (
      id BIGSERIAL PRIMARY KEY,
      owner_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      address TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      phone TEXT,
      email TEXT,
      operating_hours TEXT,
      service_type TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ
    )
  `);
}

function getSessionToken(request) {
  const cookies = request.headers.cookie?.split(";") || [];
  const sessionCookie = cookies.find((cookie) => cookie.trim().startsWith(`${SESSION_COOKIE}=`));
  return sessionCookie?.trim().slice(SESSION_COOKIE.length + 1) || "";
}

async function getOwner(request, database) {
  const token = getSessionToken(request);
  if (!token) return null;

  let claims;
  try {
    claims = verifyAuthToken(token, process.env.AUTH_TOKEN_SECRET);
  } catch {
    return null;
  }
  if (claims.role !== "owner") return null;

  const result = await database.query(
    `SELECT users.id, users.name, users.email, users.phone
     FROM users
     JOIN user_sessions ON user_sessions.user_id = users.id
     WHERE users.id = $1 AND users.role = 'owner'
       AND user_sessions.token_hash = $2 AND user_sessions.expires_at > NOW()`,
    [claims.sub, createHash("sha256").update(token).digest("hex")],
  );
  return result.rows[0] || null;
}

function formatRegistration(row) {
  return {
    id: String(row.id),
    name: row.name,
    category: row.category,
    address: row.address,
    description: row.description,
    phone: row.phone,
    email: row.email,
    operatingHours: row.operating_hours,
    serviceType: row.service_type,
    status: row.status,
    submittedAt: row.submitted_at,
    owner: {
      id: String(row.owner_id),
      name: row.owner_name,
      email: row.owner_email,
      phone: row.owner_phone,
    },
  };
}

export function createShopRouter(database = pool) {
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

  router.get("/", async (_request, response) => {
    try {
      const result = await database.query(
        `SELECT id, name, category, address, description, phone, email,
                operating_hours, service_type, status, submitted_at
         FROM shop_registrations
         WHERE status = 'approved'
         ORDER BY submitted_at DESC`,
      );
      return response.json(result.rows.map((row) => ({
        id: String(row.id),
        name: row.name,
        category: row.category,
        location: row.address,
        address: row.address,
        description: row.description,
        phone: row.phone,
        email: row.email,
        operatingHours: row.operating_hours,
        serviceType: row.service_type,
        status: row.status,
      })));
    } catch (error) {
      console.error("Could not load approved shops:", error);
      return response.status(500).json({ message: "Could not load shops. Please try again." });
    }
  });

  router.post("/registrations", async (request, response) => {
    let owner;
    try {
      owner = await getOwner(request, database);
    } catch (error) {
      console.error("Shop registration authentication failed:", error);
      return response.status(500).json({ message: "Could not verify your account. Please try again." });
    }
    if (!owner) {
      return response.status(401).json({ message: "Log in with a shop owner account to register your shop." });
    }

    const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
    const category = typeof request.body?.category === "string" ? request.body.category.trim() : "";
    const address = typeof request.body?.address === "string" ? request.body.address.trim() : "";
    const description = typeof request.body?.description === "string" ? request.body.description.trim() : "";
    const phone = typeof request.body?.phone === "string" ? request.body.phone.trim() : "";
    const email = typeof request.body?.email === "string" ? request.body.email.trim() : "";
    const operatingHours = typeof request.body?.operatingHours === "string" ? request.body.operatingHours.trim() : "";
    const serviceType = typeof request.body?.serviceType === "string" ? request.body.serviceType.trim() : "";

    if (!name || !address) {
      return response.status(400).json({ message: "Shop name and address are required." });
    }
    if (
      name.length > 120 || category.length > 120 || address.length > 240 ||
      description.length > 1000 || phone.length > 40 || email.length > 254 ||
      operatingHours.length > 120 || serviceType.length > 120
    ) {
      return response.status(400).json({ message: "One or more fields are too long." });
    }

    try {
      const result = await database.query(
        `INSERT INTO shop_registrations
           (owner_id, name, category, address, description, phone, email, operating_hours, service_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, owner_id, name, category, address, description, phone, email,
                   operating_hours, service_type, status, submitted_at`,
        [
          owner.id, name, category || null, address, description, phone || null, email || null,
          operatingHours || null, serviceType || null,
        ],
      );
      return response.status(201).json({
        message: "Shop registration submitted for review.",
        registration: formatRegistration({
          ...result.rows[0],
          owner_name: owner.name,
          owner_email: owner.email,
          owner_phone: owner.phone,
        }),
      });
    } catch (error) {
      if (error.code === "23505") {
        return response.status(409).json({ message: "Your account already has a shop registration." });
      }
      console.error("Shop registration failed:", error);
      return response.status(500).json({ message: "Could not submit your shop registration. Please try again." });
    }
  });

  return router;
}

export default createShopRouter();
