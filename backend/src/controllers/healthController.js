import { getHealthReport } from "../services/healthService.js";

// HTTP layer for the health check: 200 when everything is reachable,
// 503 when the API is up but the database is not.
export function createHealthController(options) {
  return async function healthCheck(_request, response) {
    const { healthy, report } = await getHealthReport(options);
    response.status(healthy ? 200 : 503).json(report);
  };
}

export const healthCheck = createHealthController();
