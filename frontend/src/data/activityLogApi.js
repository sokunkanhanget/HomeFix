// Administrator activity log API: GET /api/admin/activity-logs.

export const activityActions = [
  ["user.registered", "User registered"],
  ["shop.registration_submitted", "Shop registration submitted"],
  ["shop.registration_approved", "Shop registration approved"],
  ["shop.registration_rejected", "Shop registration rejected"],
  ["shop.emergency_service_updated", "Emergency service setting changed"],
  ["booking.created", "Booking created"],
  ["booking.status_changed", "Booking status changed"],
  ["emergency_request.created", "Emergency request created"],
  ["emergency_request.status_changed", "Emergency request status changed"],
];

export const activityLabel = (action) => activityActions.find(([value]) => value === action)?.[1] || action;

export class ActivityLogError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function fetchActivityLogs({ page = 1, limit = 25, action = "", entityType = "", entityId = "" } = {}, signal) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (action) params.set("action", action);
  if (entityType) params.set("entityType", entityType);
  if (entityId) params.set("entityId", entityId);
  const response = await fetch(`/api/admin/activity-logs?${params}`, { credentials: "include", signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ActivityLogError(response.status, body.message || "Could not load the activity log.");
  return body;
}
