// Calls the profile API (/api/users/me). The server identifies the user from
// the HTTP-only session cookie, so no user ID is ever sent from the browser.

export class ProfileApiError extends Error {
  constructor(status, message, errors = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function readResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ProfileApiError(response.status, body.message || "Something went wrong. Please try again.", body.errors || {});
  }
  return body;
}

export async function fetchMyProfile(signal) {
  const body = await fetch("/api/users/me", { credentials: "include", signal }).then(readResponse);
  return body.data;
}

export async function updateMyProfile({ name, phone }) {
  const body = await fetch("/api/users/me", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, phone }),
  }).then(readResponse);
  return body;
}

export async function uploadMyPhoto(file) {
  const form = new FormData();
  form.append("photo", file);
  return fetch("/api/users/me/photo", { method: "PUT", credentials: "include", body: form }).then(readResponse);
}

export async function removeMyPhoto() {
  return fetch("/api/users/me/photo", { method: "DELETE", credentials: "include" }).then(readResponse);
}
