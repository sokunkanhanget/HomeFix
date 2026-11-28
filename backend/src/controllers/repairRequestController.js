import { errorHandler } from "../middleware/errorHandler.js";
import { getRepairRequestDetails } from "../services/repairRequestService.js";

// HTTP layer for GET /api/repair-requests/:requestId. `getViewer` resolves the
// logged-in user from the session (or null). Errors are answered here in the
// standard format so the route also works when mounted without the app-level
// error handler (as in the existing route tests).
export function createRepairRequestDetailsController(database, getViewer) {
  return async function getDetails(request, response, next) {
    try {
      const viewer = await getViewer(request);
      const data = await getRepairRequestDetails(request.params.requestId, viewer, database);
      response.set("Cache-Control", "private, no-store");
      response.json({ request: data });
    } catch (error) {
      errorHandler(error, request, response, next);
    }
  };
}
