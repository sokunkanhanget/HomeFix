-- HomeFix core relational schema (PostgreSQL 14+)
-- Applied by the migration runner (cd backend && npm run migrate), which wraps
-- this file in a transaction and records it in schema_migrations.

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  phone VARCHAR(40),
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'shop_owner', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Earlier iterations named the authentication-session table `customers`.
-- Restore its proper name and preserve its records before creating the real
-- customer profile table.
DO $$
BEGIN
  IF to_regclass('public.customers') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'token_hash'
     ) THEN
    IF to_regclass('public.user_sessions') IS NULL THEN
      ALTER TABLE public.customers RENAME TO user_sessions;
    ELSE
      INSERT INTO public.user_sessions (token_hash, user_id, expires_at, created_at)
      SELECT token_hash, user_id, expires_at, created_at
      FROM public.customers
      ON CONFLICT (token_hash) DO NOTHING;
      DROP TABLE public.customers;
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.customers_expires_at_idx') IS NOT NULL
     AND to_regclass('public.user_sessions_expires_at_idx') IS NULL THEN
    ALTER INDEX public.customers_expires_at_idx RENAME TO user_sessions_expires_at_idx;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx ON user_sessions (expires_at);

CREATE TABLE IF NOT EXISTS customers (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO customers (user_id)
SELECT id FROM users WHERE role = 'customer'
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS repair_shops (
  id BIGSERIAL PRIMARY KEY,
  owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(254),
  address TEXT NOT NULL,
  district VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL DEFAULT 'Phnom Penh',
  service_mode VARCHAR(20) NOT NULL CHECK (service_mode IN ('home_visit', 'in_shop', 'both')),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS repair_shops_owner_idx ON repair_shops (owner_user_id);
CREATE INDEX IF NOT EXISTS repair_shops_status_location_idx ON repair_shops (status, district, city);

CREATE TABLE IF NOT EXISTS service_categories (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS shop_services (
  id BIGSERIAL PRIMARY KEY,
  shop_id BIGINT NOT NULL REFERENCES repair_shops(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  base_price NUMERIC(10,2),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shop_services_price_nonnegative CHECK (base_price IS NULL OR base_price >= 0),
  CONSTRAINT shop_services_currency_code CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT shop_services_shop_name_unique UNIQUE (shop_id, name)
);
CREATE INDEX IF NOT EXISTS shop_services_category_idx ON shop_services (category_id, active);

CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  booking_number VARCHAR(24) NOT NULL UNIQUE,
  customer_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  shop_id BIGINT NOT NULL REFERENCES repair_shops(id) ON DELETE RESTRICT,
  shop_service_id BIGINT REFERENCES shop_services(id) ON DELETE SET NULL,
  service_name_snapshot VARCHAR(120) NOT NULL,
  appliance VARCHAR(100) NOT NULL,
  brand_model VARCHAR(160),
  issue_description TEXT NOT NULL,
  service_mode VARCHAR(20) NOT NULL CHECK (service_mode IN ('home_visit', 'in_shop')),
  service_address TEXT NOT NULL,
  preferred_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  customer_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(40) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'declined')),
  quoted_amount NUMERIC(10,2),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bookings_amount_nonnegative CHECK (quoted_amount IS NULL OR quoted_amount >= 0),
  CONSTRAINT bookings_currency_code CHECK (currency ~ '^[A-Z]{3}$')
);
CREATE INDEX IF NOT EXISTS bookings_customer_created_idx ON bookings (customer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_shop_status_created_idx ON bookings (shop_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS booking_status_history (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  changed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  old_status VARCHAR(24),
  new_status VARCHAR(24) NOT NULL
    CHECK (new_status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'declined')),
  note TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS booking_status_history_booking_idx ON booking_status_history (booking_id, changed_at);

CREATE TABLE IF NOT EXISTS booking_photos (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  storage_url TEXT NOT NULL,
  original_filename VARCHAR(255),
  content_type VARCHAR(100),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS booking_photos_booking_idx ON booking_photos (booking_id);

CREATE TABLE IF NOT EXISTS reviews (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  customer_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  shop_id BIGINT NOT NULL REFERENCES repair_shops(id) ON DELETE RESTRICT,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reviews_shop_created_idx ON reviews (shop_id, created_at DESC);
