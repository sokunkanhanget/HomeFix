import { listActivityLogs } from "../services/activityLogService.js";
import { decideShopRegistration, listShopRegistrations } from "../services/shopReviewService.js";

// HTTP layer for administrator-only endpoints. request.user is the verified
// admin (see routes/admin.js).
export function createAdminController(database) {
  return {
    async listActivityLogs(request, response) {
      response.set("Cache-Control", "private, no-store");
      response.json(await listActivityLogs(request.query, database));
    },

    async listShopRegistrations(request, response) {
      response.json(await listShopRegistrations(request.query, database));
    },

    async reviewShopRegistration(request, response) {
      const data = await decideShopRegistration(request.params.shopId, request.body, request.user, database);
      response.json({ message: `Shop registration ${data.status}.`, data });
    },
  };
}
