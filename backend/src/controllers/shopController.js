import * as shops from "../services/shopService.js";

// HTTP layer for public (no login) repair shop data.
export function createShopController(database) {
  return {
    // GET /api/shops?page=1&limit=12
    async listShops(request, response) {
      response.json(await shops.listApprovedShops(request.query, database));
    },

    // GET /api/shops/:shopId
    async getShopDetails(request, response) {
      const data = await shops.getPublicShopDetails(request.params.shopId, database);
      response.set("Cache-Control", "public, max-age=60");
      response.json({ data });
    },
  };
}
