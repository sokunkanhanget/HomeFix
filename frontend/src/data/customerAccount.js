export const customerStorageKey = "homefix-current-customer";
export const customerChangedEvent = "homefix:customer-changed";

// Frontend-only session: keeps the user returned by /api/auth/login or /register in this browser.
export function loadCustomer() {
  try {
    const value = JSON.parse(localStorage.getItem(customerStorageKey) || "null");
    return value && typeof value === "object" && typeof value.name === "string" ? value : null;
  } catch { return null; }
}

export function saveCustomer(user) {
  if (!user || typeof user !== "object") return;
  const { id, name, email, phone, role, photoUrl } = user;
  localStorage.setItem(customerStorageKey, JSON.stringify({
    id, name, email, phone: phone || "", role: role || "customer", photoUrl: photoUrl || null,
  }));
  window.dispatchEvent(new Event(customerChangedEvent));
}

export function clearCustomer() {
  try {
    localStorage.removeItem(customerStorageKey);
    window.dispatchEvent(new Event(customerChangedEvent));
  } catch { /* ignore */ }
}

// Ends the server session (deletes the cookie) and forgets the user in this browser.
export async function logOutCustomer() {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch { /* offline: still log out locally */ }
  clearCustomer();
}

export function summarizeCustomerRequests(requests, normalize) {
  const count = (statuses) => requests.filter((request) => statuses.includes(normalize(request.status))).length;
  return {
    total: requests.length,
    pending: count(["Incoming"]),
    accepted: count(["Accepted", "In progress"]),
    completed: count(["Completed"]),
  };
}

export function recentRequests(requests, limit = 5) {
  return requests.map((request, index) => ({ request, index }))
    .sort((a, b) => {
      const first = Date.parse(a.request.createdAt);
      const second = Date.parse(b.request.createdAt);
      if (Number.isFinite(first) && Number.isFinite(second)) return second - first || a.index - b.index;
      if (Number.isFinite(first)) return -1;
      if (Number.isFinite(second)) return 1;
      return a.index - b.index;
    })
    .slice(0, limit)
    .map(({ request }) => request);
}

export function formatSubmittedDate(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not recorded";
}
