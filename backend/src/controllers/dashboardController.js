import * as dashboards from "../services/dashboardService.js";

export function createDashboardController(database) {
  return {
    async getOwnerDashboard(request, response) {
      const dashboard = await dashboards.getOwnerDashboard(request.user, request.query, database);
      response.set("Cache-Control", "private, no-store");
      response.json(dashboard);
    },
  };
}
