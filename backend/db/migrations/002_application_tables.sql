-- Tables used by the current API routes (authentication, user profiles, shop
-- directory, shop registration, repair requests). Before migrations existed,
-- the server created these at startup; this file is the same DDL, so it also
-- upgrades a database that the old startup code already set up.
--
-- Everything uses IF NOT EXISTS, so it is safe on a clean database and on an
-- existing one. The runner wraps this file in a transaction.

-- ---------------------------------------------------------------------------
-- Users and sessions (users, customers and user_sessions come from 001)
-- ---------------------------------------------------------------------------

ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Registration treats emails as case-insensitive and ignores surrounding spaces.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_unique ON users (LOWER(BTRIM(email)));

-- The API stores shop owners as 'owner'; 001 only allowed 'shop_owner'.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('customer', 'owner', 'shop_owner', 'admin'));

CREATE TABLE IF NOT EXISTS user_profile_photos (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  data BYTEA NOT NULL,
  size_bytes INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Shop directory: shops, categories and the links between them
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shops (
  id BIGSERIAL PRIMARY KEY,
  owner_user_id BIGINT REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (BTRIM(name) <> ''),
  location TEXT NOT NULL,
  address TEXT NOT NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  operating_hours VARCHAR(120) NOT NULL DEFAULT '',
  image_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shops_owner_user_idx ON shops (owner_user_id);
CREATE INDEX IF NOT EXISTS shops_approved_name_idx
  ON shops (LOWER(name), id) WHERE status = 'approved';

-- 001 creates service_categories without the slug the API filters by.
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS slug TEXT;
UPDATE service_categories
  SET slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
  WHERE slug IS NULL OR BTRIM(slug) = '';
UPDATE service_categories
  SET slug = 'category-' || id::text
  WHERE slug IS NULL OR BTRIM(slug) = '';
ALTER TABLE service_categories ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS service_categories_slug_key ON service_categories (slug);

-- Matches serviceCategories in backend/src/models/shopModel.js and the
-- frontend's category list.
INSERT INTO service_categories (slug, name) VALUES
  ('air-conditioner', 'Air Conditioner'),
  ('refrigerator', 'Refrigerator'),
  ('tv-electronics', 'TV & Electronics'),
  ('washing-machine', 'Washing Machine'),
  ('wifi-internet', 'Wi-Fi & Internet'),
  ('electrical', 'Electrical'),
  ('plumbing', 'Plumbing'),
  ('general-maintenance', 'General Maintenance'),
  ('painting', 'Painting'),
  ('home-appliances', 'Home Appliances'),
  ('water-heater', 'Water Heater'),
  ('security-systems', 'Security Systems')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS shop_categories (
  shop_id BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (shop_id, category_id)
);
CREATE INDEX IF NOT EXISTS shop_categories_category_idx ON shop_categories (category_id, shop_id);

-- ---------------------------------------------------------------------------
-- Shop registrations submitted by owners
-- ---------------------------------------------------------------------------

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
  supports_emergency BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
-- Added after the table first shipped; upgrades older databases.
ALTER TABLE shop_registrations ADD COLUMN IF NOT EXISTS supports_emergency BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- Repair requests, their photos and status history
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS repair_requests (
  id TEXT PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_id TEXT NOT NULL,
  category TEXT NOT NULL,
  problem_description TEXT NOT NULL,
  appliance_details TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  location TEXT NOT NULL,
  service_type TEXT NOT NULL DEFAULT 'Home visit',
  appointment_date TEXT NOT NULL DEFAULT '',
  appointment_time TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'regular',
  urgency_information TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending',
  rejection_reason TEXT,
  cancellation_reason TEXT,
  cancellation_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Columns added after the table first shipped; upgrades older databases.
ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS appliance_details TEXT NOT NULL DEFAULT '';
ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT 'Home visit';
ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS appointment_date TEXT NOT NULL DEFAULT '';
ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS appointment_time TEXT NOT NULL DEFAULT '';
ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'regular';
ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS urgency_information TEXT NOT NULL DEFAULT '';
ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS cancellation_details TEXT;

CREATE TABLE IF NOT EXISTS repair_request_photos (
  id UUID PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES repair_requests(id) ON DELETE CASCADE,
  storage_key UUID NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS repair_request_photos_request_id_idx
  ON repair_request_photos (request_id, created_at);

CREATE TABLE IF NOT EXISTS repair_request_status_history (
  id BIGSERIAL PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES repair_requests(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS repair_request_status_history_request_id_idx
  ON repair_request_status_history (request_id, created_at, id);
