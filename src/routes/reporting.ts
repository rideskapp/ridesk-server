import { Router } from "express";
import { authenticate, authorizeRoles } from "../middleware/auth";
import { AuthenticatedRequest } from "../types";
import { AppError } from "../types";
import { getReportingData } from "../services/reporting";

const router = Router();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @swagger
 * /api/reporting:
 *   get:
 *     summary: Get reporting data for a school
 *     description: Retrieve business analytics data including revenue, bookings, and breakdowns by booking type, discipline, and instructor. SCHOOL_ADMIN can only access their own school's data. SUPER_ADMIN can access any school by providing schoolId query parameter.
 *     tags: [Reporting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: schoolId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID (required for SUPER_ADMIN, optional for SCHOOL_ADMIN. SCHOOL_ADMIN cannot query other schools; providing a different schoolId will result in a 403 error)
 *         required: false
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *         required: true
 *         example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *         required: true
 *         example: "2024-01-31"
 *     responses:
 *       200:
 *         description: Reporting data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         overview:
 *                           type: object
 *                           properties:
 *                             totalRevenue:
 *                               type: number
 *                               example: 15000.50
 *                               description: "Total revenue in the date range"
 *                             bookingCount:
 *                               type: integer
 *                               example: 25
 *                               description: "Total number of bookings"
 *                             studentCount:
 *                               type: integer
 *                               example: 18
 *                               description: "Unique number of students"
 *                             averageRevenuePerBooking:
 *                               type: number
 *                               example: 600.02
 *                               description: "Average revenue per booking"
 *                         breakdownByBookingType:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               type:
 *                                 type: string
 *                                 example: "Private"
 *                                 enum: ["Private", "Group", "Packages"]
 *                               revenue:
 *                                 type: number
 *                                 example: 8000.00
 *                               count:
 *                                 type: integer
 *                                 example: 10
 *                         breakdownByDiscipline:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               discipline:
 *                                 type: string
 *                                 example: "kite"
 *                               revenue:
 *                                 type: number
 *                                 example: 10000.00
 *                               count:
 *                                 type: integer
 *                                 example: 15
 *                         breakdownByInstructor:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               instructorId:
 *                                 type: string
 *                                 format: uuid
 *                                 example: "123e4567-e89b-12d3-a456-426614174000"
 *                               instructorName:
 *                                 type: string
 *                                 example: "John Doe"
 *                               revenue:
 *                                 type: number
 *                                 example: 5000.00
 *                                 description: "Revenue allocated to this instructor"
 *                               lessonCount:
 *                                 type: integer
 *                                 example: 12
 *                         paidVsPending:
 *                           type: object
 *                           properties:
 *                             paid:
 *                               type: number
 *                               example: 10000.00
 *                               description: "Revenue from paid bookings"
 *                             pending:
 *                               type: number
 *                               example: 4000.00
 *                               description: "Revenue from pending bookings"
 *                             overdue:
 *                               type: number
 *                               example: 1000.50
 *                               description: "Revenue from overdue bookings"
 *             example:
 *               success: true
 *               message: "Reporting data retrieved successfully"
 *               data:
 *                 overview:
 *                   totalRevenue: 15000.50
 *                   bookingCount: 25
 *                   studentCount: 18
 *                   averageRevenuePerBooking: 600.02
 *                 breakdownByBookingType:
 *                   - type: "Private"
 *                     revenue: 8000.00
 *                     count: 10
 *                   - type: "Group"
 *                     revenue: 5000.00
 *                     count: 12
 *                   - type: "Packages"
 *                     revenue: 2000.50
 *                     count: 3
 *                 breakdownByDiscipline:
 *                   - discipline: "kite"
 *                     revenue: 10000.00
 *                     count: 15
 *                   - discipline: "surf"
 *                     revenue: 5000.50
 *                     count: 10
 *                 breakdownByInstructor:
 *                   - instructorId: "123e4567-e89b-12d3-a456-426614174000"
 *                     instructorName: "John Doe"
 *                     revenue: 5000.00
 *                     lessonCount: 12
 *                   - instructorId: "123e4567-e89b-12d3-a456-426614174001"
 *                     instructorName: "Jane Smith"
 *                     revenue: 3000.00
 *                     lessonCount: 8
 *                 paidVsPending:
 *                   paid: 10000.00
 *                   pending: 4000.00
 *                   overdue: 1000.50
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const {
        schoolId: querySchoolId,
        startDate,
        endDate,
      } = req.query as {
        schoolId?: string;
        startDate?: string;
        endDate?: string;
      };

      if (!startDate || !endDate) {
        throw new AppError("startDate and endDate are required", 400);
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        throw new AppError("Invalid date format. Use YYYY-MM-DD", 400);
      }

      // Validate dates are parseable
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new AppError("Invalid date values", 400);
      }

      if (start > end) {
        throw new AppError("startDate must be before or equal to endDate", 400);
      }

      // Validate UUID format if querySchoolId is provided
      if (querySchoolId && !UUID_REGEX.test(querySchoolId)) {
        throw new AppError("Invalid schoolId format", 400);
      }

      // Prevent SCHOOL_ADMIN from accessing other schools
      if (
        authReq.user.role === "SCHOOL_ADMIN" &&
        querySchoolId &&
        querySchoolId !== authReq.user.schoolId
      ) {
        throw new AppError("Access denied to the specified school", 403);
      }

      const schoolId =
        authReq.user.role === "SUPER_ADMIN" && querySchoolId
          ? querySchoolId
          : authReq.user.schoolId;

      if (!schoolId) {
        throw new AppError("School ID is required", 400);
      }

      const data = await getReportingData(schoolId, startDate, endDate);

      return res.json({
        success: true,
        data,
        message: "Reporting data retrieved successfully",
      });
    } catch (err) {
      return next(err);
    }
  },
);

export default router;
