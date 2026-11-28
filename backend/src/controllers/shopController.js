import { getPublicShopDetails } from "../services/shopService.js";

// Public (no login) shop details for customers comparing shops.
export function createShopDetailsController(database) {
  return async function getShopDetails(request, response) {
    const data = await getPublicShopDetails(request.params.shopId, database);
    response.set("Cache-Control", "public, max-age=60");
    response.json({ data });
  };
}
