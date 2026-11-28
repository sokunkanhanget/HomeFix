// Public repair shop data from the backend (no login needed).

// Converts an API shop into the shape the shop pages already use.
export function toShopView(shop) {
  const categories = Array.isArray(shop.categories)
    ? shop.categories.map((category) => (typeof category === "string" ? category : category.name)).filter(Boolean)
    : typeof shop.category === "string" && shop.category ? [shop.category] : [];
  return {
    ...shop,
    id: String(shop.id),
    image: shop.imageUrl || "",
    rating: 0,
    reviews: 0,
    phone: shop.phone || "",
    location: shop.location || shop.address || "",
    category: categories[0] || "Home Repair",
    services: categories,
    serviceType: shop.serviceType || "Home service",
    profile: { address: shop.address, operatingHours: shop.operatingHours, about: shop.description },
  };
}

export class ShopNotFoundError extends Error {}

export async function fetchShopDetails(shopId, signal) {
  const response = await fetch(`/api/shops/${encodeURIComponent(shopId)}`, { signal });
  const body = await response.json().catch(() => ({}));
  if (response.status === 404) throw new ShopNotFoundError(body.message || "Repair shop not found.");
  if (!response.ok) throw new Error(body.message || "Could not load this repair shop. Please try again.");
  return toShopView(body.data);
}
