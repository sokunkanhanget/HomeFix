async function readResponse(response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Could not load repair requests. Please try again.");
  return result;
}

export function displayRepairRequest(request) {
  return {
    ...request,
    shop: request.shop?.name || "Repair shop",
    appliance: request.category,
    issue: request.problemDescription,
    brandModel: request.applianceDetails,
    customerName: request.contactName || request.customer?.name,
    customerPhone: request.contactPhone || request.customer?.phone,
    phone: request.contactPhone,
    date: request.appointmentDate || "As soon as possible",
    time: request.appointmentTime || "Shop to confirm arrival",
    preferredDate: request.appointmentDate,
    preferredTime: request.appointmentTime,
    photoAttachments: request.photos || [],
    updatedAt: request.statusHistory?.at(-1)?.createdAt || request.createdAt,
  };
}

export async function loadRepairRequests() {
  const requests = [];
  let page = 1;
  let totalPages;
  do {
    const result = await fetch(`/api/repair-requests?page=${page}&limit=100`, { credentials: "include" }).then(readResponse);
    requests.push(...result.requests.map(displayRepairRequest));
    totalPages = result.pagination.totalPages;
    page++;
  } while (page <= totalPages);
  return requests;
}

export async function updateRepairStatus(id, status, rejectionReason = "", cancellation = {}) {
  const result = await fetch(`/api/repair-requests/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...cancellation, status: status === "In progress" ? "In Progress" : status, rejectionReason }),
  }).then(readResponse);
  return result.request;
}
