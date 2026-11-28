CREATE TABLE IF NOT EXISTS shop_registration_categories (
  registration_id BIGINT NOT NULL REFERENCES shop_registrations(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (registration_id, category_id)
);
CREATE INDEX IF NOT EXISTS shop_registration_categories_category_idx
  ON shop_registration_categories (category_id, registration_id);

INSERT INTO shop_registration_categories (registration_id, category_id)
SELECT shop_registrations.id, service_categories.id
FROM shop_registrations
JOIN service_categories ON service_categories.name = shop_registrations.category
ON CONFLICT DO NOTHING;
