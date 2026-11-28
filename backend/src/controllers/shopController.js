import * as shops from "../services/shopService.js";

// HTTP layer for the public repair shop listing.
export function createShopController(database) {
  return {
    async listShops(request, response) {
      response.json(await shops.listApprovedShops(request.query, database));
    },
  };
}
