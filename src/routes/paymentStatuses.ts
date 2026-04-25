import { Router } from "express";
import { supabaseAdmin } from "../database/supabase";
import { AppError } from "../types";
import { authenticate, authorizeRoles } from "../middleware/auth";

const router = Router();

/**
 * @swagger
 * /api/payment-statuses:
 *   get:
 *     summary: Get all active payment statuses
 *     description: Retrieve all active payment statuses. Currently statuses are global across all schools. Available to all authenticated users.
 *     tags: [Payment Statuses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment statuses retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                             example: "123e4567-e89b-12d3-a456-426614174000"
 *                           name:
 *                             type: string
 *                             example: "paid"
 *                             description: "Internal status name (slug)"
 *                           display_name:
 *                             type: string
 *                             example: "Paid"
 *                             description: "Human-readable display name"
 *                           description:
 *                             type: string
 *                             nullable: true
 *                             example: "Payment has been completed"
 *                           color:
 *                             type: string
 *                             example: "#10B981"
 *                             description: "Hex color code for UI display"
 *                           is_active:
 *                             type: boolean
 *                             example: true
 *                           sort_order:
 *                             type: integer
 *                             example: 1
 *                             description: "Display order"
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2024-01-01T00:00:00.000Z"
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2024-01-01T00:00:00.000Z"
 *             example:
 *               success: true
 *               message: "Payment statuses retrieved successfully"
 *               data:
 *                 - id: "123e4567-e89b-12d3-a456-426614174000"
 *                   name: "paid"
 *                   display_name: "Paid"
 *                   description: "Payment has been completed"
 *                   color: "#10B981"
 *                   is_active: true
 *                   sort_order: 1
 *                   created_at: "2024-01-01T00:00:00.000Z"
 *                   updated_at: "2024-01-01T00:00:00.000Z"
 *                 - id: "123e4567-e89b-12d3-a456-426614174001"
 *                   name: "pending"
 *                   display_name: "Pending"
 *                   description: "Payment is pending"
 *                   color: "#F59E0B"
 *                   is_active: true
 *                   sort_order: 2
 *                   created_at: "2024-01-01T00:00:00.000Z"
 *                   updated_at: "2024-01-01T00:00:00.000Z"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN", "INSTRUCTOR", "USER"]),
  async (_req, res, next) => {
    try {
      // Note: Currently statuses are global. If schoolId is provided, it's accepted for future school-scoping.
      // The RPC function would need to be updated to filter by school_id if statuses become school-specific.
      // Future: const schoolId = _req.query["schoolId"] as string | undefined;
      const { data, error } = await (supabaseAdmin as any).rpc(
        "get_active_payment_statuses",
      );

      if (error) {
        throw new AppError(
          `Failed to fetch payment statuses: ${error.message}`,
          500,
        );
      }

      res.json({
        success: true,
        data: data || [],
        message: "Payment statuses retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
