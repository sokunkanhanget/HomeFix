const STORAGE_KEY = "homefix.repairRequests.v1";

export function getRepairRequests() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const requests = stored ? JSON.parse(stored) : [];
    return Array.isArray(requests) ? requests : [];
  } catch {
    return [];
  }
}

export function saveRepairRequest(request) {
  const requests = getRepairRequests();
  const updatedRequests = [request, ...requests];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRequests));
  return updatedRequests;
}
