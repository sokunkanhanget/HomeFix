export const requestStorageKey = "homefix-repair-requests";
export const requestStatuses = ["Incoming", "Accepted", "In progress", "Completed"];

export function requestStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (["incoming", "awaiting confirmation", "pending"].includes(normalized)) return "Incoming";
  if (["accepted", "confirmed"].includes(normalized)) return "Accepted";
  if (["in progress", "in-progress"].includes(normalized)) return "In progress";
  if (normalized === "completed") return "Completed";
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
