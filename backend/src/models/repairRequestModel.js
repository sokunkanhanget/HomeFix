import { pool } from "../config/database.js";

// Loads one repair request only if the viewer may see it: the customer who
// submitted it, or the owner of the approved shop it was sent to. Access is
// checked in SQL, so a request the viewer may not see is never loaded.
export async function findRepairRequestForViewer(requestId, viewerId, database = pool) {
  const result = await database.query(
    `SELECT repair_requests.id, repair_requests.customer_id, repair_requests.shop_id,
            repair_requests.category, repair_requests.problem_description,
            repair_requests.appliance_details, repair_requests.contact_name,
            repair_requests.contact_phone, repair_requests.location,
            repair_requests.service_type, repair_requests.appointment_date,
            repair_requests.appointment_time, repair_requests.priority,
            repair_requests.urgency_information, repair_requests.status,
            repair_requests.rejection_reason, repair_requests.cancellation_reason,
            repair_requests.cancellation_details, repair_requests.created_at,
            users.name AS customer_name, users.email AS customer_email, users.phone AS customer_phone,
            shop_registrations.name AS shop_name,
            CASE WHEN repair_requests.customer_id = $2 THEN 'customer' ELSE 'shop_owner' END AS viewer_access
     FROM repair_requests
     JOIN users ON users.id = repair_requests.customer_id
     LEFT JOIN shop_registrations ON shop_registrations.id::text = repair_requests.shop_id
     WHERE repair_requests.id = $1
       AND (
         repair_requests.customer_id = $2
         OR (shop_registrations.owner_id = $2 AND shop_registrations.status = 'approved')
       )`,
    [requestId, viewerId],
  );
  return result.rows[0] || null;
}

export async function findRepairRequestPhotos(requestId, database = pool) {
  const result = await database.query(
    `SELECT id, original_name, content_type, size_bytes, created_at
     FROM repair_request_photos WHERE request_id = $1 ORDER BY created_at, id`,
    [requestId],
  );
  return result.rows;
}

export async function findRepairRequestStatusHistory(requestId, database = pool) {
  const result = await database.query(
    `SELECT status, rejection_reason, created_at
     FROM repair_request_status_history WHERE request_id = $1 ORDER BY created_at, id`,
    [requestId],
  );
  return result.rows;
}
