export const requestStorageKey = "homefix-repair-requests";
export const requestsChangedEvent = "homefix:requests-changed";
export const emergencyStatuses = ["Incoming", "Accepted", "In progress", "Completed", "Rejected"];
export const requestStatuses = ["Incoming", "Accepted", "In progress", "Completed"];

export function requestStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (["incoming", "awaiting confirmation", "pending", "emergency - awaiting response"].includes(normalized)) return "Incoming";
  if (["accepted", "confirmed"].includes(normalized)) return "Accepted";
  if (["in progress", "in-progress"].includes(normalized)) return "In progress";
  if (normalized === "completed") return "Completed";
  if (normalized === "cancelled") return "Cancelled";
  return status || "Unknown";
}

export function parseRequests(saved) {
  try {
    const requests = JSON.parse(saved || "[]");
    return Array.isArray(requests) ? requests.filter((item) => item && typeof item === "object" && typeof item.id === "string") : [];
  } catch { return []; }
}

export function requestsForShop(requests, shop) {
  return requests.filter((request) => request.shopId ? request.shopId === shop.id : request.shop === shop.name)
    .map((request, index) => ({ request, index }))
    .sort((a, b) => {
      const first = Date.parse(a.request.createdAt);
      const second = Date.parse(b.request.createdAt);
      if (Number.isFinite(first) && Number.isFinite(second)) return second - first || a.index - b.index;
      if (Number.isFinite(first)) return -1;
      if (Number.isFinite(second)) return 1;
      return a.index - b.index;
    }).map(({ request }) => request);
}

export function summarizeRequests(requests) {
  return Object.fromEntries(requestStatuses.map((status) => [status, requests.filter((request) => requestStatus(request.status) === status).length]));
}

export function isEmergencyRequest(request) {
  return request.priority === "emergency" || request.isEmergency === true || request.emergency === true;
}

export const statusTransitions = { Incoming: ["Accepted", "Rejected"], Accepted: ["In progress"], "In progress": ["Completed"] };

// Records a status change on any request without notifying the customer (e.g. the customer's own cancellation).
export function recordStatusChange(request, status, now = new Date().toISOString(), changes = {}) {
  return {
    ...request, ...changes, status, updatedAt: now,
    statusHistory: [...(Array.isArray(request.statusHistory) ? request.statusHistory : []), { status, createdAt: now }],
  };
}

// Customer cancellation is allowed only before repair work starts.
export function cancelRepairRequest(request, reason = "", details = "", now = new Date().toISOString()) {
  if (!["Incoming", "Accepted"].includes(requestStatus(request.status))) {
    throw new Error("This request has changed and can no longer be cancelled.");
  }
  const notification = {
    id: `${request.id}-Cancelled-${now}`,
    status: "Cancelled",
    createdAt: now,
    read: false,
    message: `Your ${isEmergencyRequest(request) ? "emergency" : "repair"} request for ${request.shop || "your repair shop"} was cancelled.${reason ? ` Reason: ${reason.trim()}${details.trim() ? ` (${details.trim()})` : ""}` : ""}`,
  };
  return recordStatusChange(request, "Cancelled", now, {
    cancelledAt: now,
    ...(reason.trim() ? { cancellationReason: reason.trim() } : {}),
    ...(details.trim() ? { cancellationDetails: details.trim() } : {}),
    notifications: [...(Array.isArray(request.notifications) ? request.notifications : []), notification],
  });
}

// Shop-driven status change: records the change and creates an unread in-app notification for the customer.
export function transitionRequest(request, status, reason = "", now = new Date().toISOString()) {
  if (!statusTransitions[requestStatus(request.status)]?.includes(status)) {
    throw new Error("This request has changed. Review its current status before continuing.");
  }
  if (status === "Rejected" && !reason.trim()) throw new Error("Please provide a reason for rejecting this request.");
  const notification = {
    id: `${request.id}-${status}-${now}`,
    status,
    createdAt: now,
    read: false,
    message: `${request.shop || "Your repair shop"} updated your ${isEmergencyRequest(request) ? "emergency" : "repair"} request to ${status.toLowerCase()}.${status === "Rejected" ? ` Reason: ${reason.trim()}` : ""}`,
  };
  return recordStatusChange(request, status, now, {
    ...(status === "Rejected" ? { rejectionReason: reason.trim() } : {}),
    notifications: [...(Array.isArray(request.notifications) ? request.notifications : []), notification],
  });
}

export function transitionEmergencyRequest(request, status, reason = "", now = new Date().toISOString()) {
  if (!isEmergencyRequest(request)) throw new Error("This is not an emergency request.");
  return transitionRequest(request, status, reason, now);
}

// Full timeline shown to customers: submission followed by every recorded status change.
export function requestTimeline(request) {
  const history = Array.isArray(request.statusHistory) ? request.statusHistory.filter((entry) => entry && entry.status) : [];
  return Number.isFinite(Date.parse(request.createdAt)) ? [{ status: "Submitted", createdAt: request.createdAt }, ...history] : history;
}

export function lastStatusUpdate(request) {
  const value = request.updatedAt || request.statusHistory?.at?.(-1)?.createdAt || request.createdAt;
  return Number.isFinite(Date.parse(value)) ? value : "";
}

export function saveRequests(requests) {
  // Save the status and its customer notification together before announcing success.
  localStorage.setItem(requestStorageKey, JSON.stringify(requests));
  window.dispatchEvent(new Event(requestsChangedEvent));
}
