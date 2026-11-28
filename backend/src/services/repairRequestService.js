import {
  findRepairRequestForViewer,
  findRepairRequestPhotos,
  findRepairRequestStatusHistory,
} from "../models/repairRequestModel.js";
import { AppError } from "../utils/AppError.js";

// Request IDs are UUIDs for new requests; older and test requests use short
// slugs, so any value of letters, digits, "-" and "_" up to 100 characters is
// a well-formed ID.
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function formatPhoto(row, requestId) {
  return {
    id: row.id,
    name: row.original_name,
    contentType: row.content_type,
    size: Number(row.size_bytes),
    uploadedAt: toIso(row.created_at),
    url: `/api/repair-requests/${encodeURIComponent(requestId)}/photos/${row.id}`,
  };
}

function formatHistory(rows) {
  return rows.map((row) => ({
    status: row.status,
    ...(row.rejection_reason ? { rejectionReason: row.rejection_reason } : {}),
    createdAt: toIso(row.created_at),
  }));
}

// Response shape matches the items of GET /api/repair-requests (so existing
// frontend code can use either), plus grouped appointment details, photos and
// timestamps.
export function toRepairRequestDetails(row, photos, history) {
  const statusHistory = formatHistory(history);
  const createdAt = toIso(row.created_at);
  const updatedAt = statusHistory.reduce(
    (latest, entry) => (entry.createdAt && entry.createdAt > latest ? entry.createdAt : latest),
    createdAt,
  );
  return {
    id: row.id,
    viewerAccess: row.viewer_access,
    customerId: String(row.customer_id),
    customer: { id: String(row.customer_id), name: row.customer_name, email: row.customer_email, phone: row.customer_phone },
    shopId: String(row.shop_id),
    shop: { id: String(row.shop_id), name: row.shop_name || "Repair shop" },
    category: row.category,
    problemDescription: row.problem_description,
    applianceDetails: row.appliance_details,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    location: row.location,
    serviceType: row.service_type,
    appointmentDate: row.appointment_date,
    appointmentTime: row.appointment_time,
    appointment: {
      preferredDate: row.appointment_date || null,
      preferredTime: row.appointment_time || null,
      serviceType: row.service_type,
      location: row.location,
    },
    priority: row.priority,
    emergency: row.priority === "emergency",
    urgencyInformation: row.urgency_information || "",
    status: row.status,
    rejectionReason: row.rejection_reason || "",
    cancellationReason: row.cancellation_reason || "",
    cancellationDetails: row.cancellation_details || "",
    statusHistory,
    photos: photos.map((photo) => formatPhoto(photo, row.id)),
    createdAt,
    updatedAt,
  };
}

// Returns the request when the viewer submitted it or owns the approved shop
// it was sent to. Anyone else gets the same 404 as for a missing request, so
// the response never reveals that someone else's request exists.
export async function getRepairRequestDetails(requestId, viewer, database) {
  if (!viewer) throw AppError.unauthorized("Log in to view this repair request.");
  if (typeof requestId !== "string" || !REQUEST_ID_PATTERN.test(requestId)) {
    throw new AppError(400, "Invalid repair request ID.", { code: "INVALID_ID" });
  }
  const row = await findRepairRequestForViewer(requestId, viewer.id, database);
  if (!row) throw AppError.notFound("Repair request not found.");
  const [photos, history] = await Promise.all([
    findRepairRequestPhotos(row.id, database),
    findRepairRequestStatusHistory(row.id, database),
  ]);
  return toRepairRequestDetails(row, photos, history);
}
