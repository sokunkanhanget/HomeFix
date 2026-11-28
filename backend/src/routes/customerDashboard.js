import { Router } from "express";
import { pool } from "../config/database.js";
import { authenticate } from "../middleware/authenticate.js";

export function createCustomerDashboardRouter(database = pool, authenticateRequest = authenticate) {
  const router = Router();

  router.get("/customer/dashboard", authenticateRequest, async (request, response) => {
    if (request.user.role !== "customer") {
      return response.status(403).json({ message: "A customer account is required." });
    }

    try {
      const result = await database.query(`
        WITH customer AS (
          SELECT id, name, email, phone, role
          FROM users
          WHERE id = $1 AND role = 'customer'
        ), customer_bookings AS (
          SELECT b.id, b.booking_number, b.service_name_snapshot, b.appliance,
            b.status, b.created_at, s.name AS shop_name
          FROM bookings b
          LEFT JOIN repair_shops s ON s.id = b.shop_id
          WHERE b.customer_user_id = $1
        ), counts AS (
          SELECT COUNT(*)::int AS total_requests,
            COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
            COUNT(*) FILTER (WHERE status = 'confirmed')::int AS accepted_count,
            COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress_count,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_count
          FROM customer_bookings
        ), recent AS (
          SELECT id::text AS id, booking_number AS "bookingNumber",
            service_name_snapshot AS "serviceName", appliance, status,
            created_at AS "createdAt", shop_name AS "shopName"
          FROM customer_bookings
          ORDER BY created_at DESC, id DESC
          LIMIT 5
        )
        SELECT (SELECT to_jsonb(customer) FROM customer) AS customer,
          to_jsonb(counts) AS summary,
          COALESCE((SELECT jsonb_agg(to_jsonb(recent) ORDER BY recent."createdAt" DESC, recent.id DESC)
            FROM recent), '[]'::jsonb) AS "recentRequests"
      `, [request.user.id]);

      const dashboard = result.rows[0];
      if (!dashboard?.customer) return response.status(404).json({ message: "Customer account not found." });
      return response.json({ data: dashboard });
    } catch (error) {
      console.error("Could not load customer dashboard:", error.code || error.name);
      return response.status(500).json({ message: "Could not load your repair dashboard." });
    }
  });

  return router;
}

export default createCustomerDashboardRouter();
