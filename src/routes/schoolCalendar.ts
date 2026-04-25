import { Router } from "express";
import Joi from "joi";
import { authenticate, authorizeRoles, authorizeSchoolAccess } from "../middleware/auth";
import { validate } from "../middleware/validation";
import {
  deleteSpecialDates,
  getWeeklyAvailability,
  isSchoolDateAvailable,
  listSpecialDates,
  setWeeklyAvailability,
  upsertSpecialDatesBulk,
} from "../services/schoolCalendar";

const router = Router({ mergeParams: true });

/**
 * @swagger
 * /api/schools/{schoolId}/calendar/availability:
 *   get:
 *     summary: Get weekly availability pattern
 *     description: Retrieve the weekly availability pattern (Monday-Sunday) for a school. Returns 7 rows representing each day of the week (0=Monday, 6=Sunday).
 *     tags: [School Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schoolId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID
 *     responses:
 *       200:
 *         description: Weekly availability retrieved successfully
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
 *                           weekday:
 *                             type: integer
 *                             minimum: 0
 *                             maximum: 6
 *                             example: 0
 *                             description: "Day of week (0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday)"
 *                           is_available:
 *                             type: boolean
 *                             example: true
 *                             description: "Whether the school is available on this weekday"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

const weeklySchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        weekday: Joi.number().integer().min(0).max(6).required(),
        is_available: Joi.boolean().required(),
      }),
    )
    .length(7)
    .required(),
});

const rangeSchema = Joi.object({
  from: Joi.string().isoDate().required(),
  to: Joi.string().isoDate().required(),
});

const specialBulkSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        date: Joi.string().isoDate().required(),
        is_available: Joi.boolean().required(),
        reason: Joi.string().allow("", null).optional(),
      }),
    )
    .min(1)
    .max(366)
    .required(),
});

const deleteSchema = Joi.object({ dates: Joi.array().items(Joi.string().isoDate()).min(1).required() });

router.get(
  "/availability",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  authorizeSchoolAccess,
  async (req, res, next) => {
    try {
      const schoolId = (req as any).schoolId || req.params["schoolId"] || (req as any).user?.schoolId;
      const data = await getWeeklyAvailability(schoolId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/schools/{schoolId}/calendar/availability:
 *   put:
 *     summary: Set weekly availability pattern
 *     description: Update the weekly availability pattern for all 7 days of the week. Must provide exactly 7 items (Monday-Sunday).
 *     tags: [School Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schoolId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               items:
 *                 type: array
 *                 minItems: 7
 *                 maxItems: 7
 *                 description: "Exactly 7 items representing Monday (0) through Sunday (6)"
 *                 items:
 *                   type: object
 *                   required:
 *                     - weekday
 *                     - is_available
 *                   properties:
 *                     weekday:
 *                       type: integer
 *                       minimum: 0
 *                       maximum: 6
 *                       example: 0
 *                       description: "Day of week (0=Monday through 6=Sunday)"
 *                     is_available:
 *                       type: boolean
 *                       example: true
 *                       description: "Whether the school is available on this weekday"
 *           example:
 *             items:
 *               - { weekday: 0, is_available: true }
 *               - { weekday: 1, is_available: true }
 *               - { weekday: 2, is_available: true }
 *               - { weekday: 3, is_available: true }
 *               - { weekday: 4, is_available: true }
 *               - { weekday: 5, is_available: false }
 *               - { weekday: 6, is_available: false }
 *     responses:
 *       200:
 *         description: Weekly availability updated successfully
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
 *                           weekday:
 *                             type: integer
 *                             example: 0
 *                           is_available:
 *                             type: boolean
 *                             example: true
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/availability",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  authorizeSchoolAccess,
  validate(weeklySchema),
  async (req, res, next) => {
    try {
      const schoolId = (req as any).schoolId || req.params["schoolId"] || (req as any).user?.schoolId;
      const { items } = req.body as { items: { weekday: number; is_available: boolean }[] };
      const data = await setWeeklyAvailability(schoolId, items);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/schools/{schoolId}/calendar/special-dates:
 *   get:
 *     summary: Get special date exceptions
 *     description: Retrieve special date exceptions (holidays, closures, etc.) for a specific date range. These override the weekly availability pattern.
 *     tags: [School Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schoolId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-01-01"
 *         description: Start date (ISO format YYYY-MM-DD)
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-12-31"
 *         description: End date (ISO format YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Special dates retrieved successfully
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
 *                           date:
 *                             type: string
 *                             format: date
 *                             example: "2025-12-25"
 *                             description: "Date in ISO format (YYYY-MM-DD)"
 *                           is_available:
 *                             type: boolean
 *                             example: false
 *                             description: "Whether the school is available on this date"
 *                           reason:
 *                             type: string
 *                             nullable: true
 *                             example: "Christmas Holiday"
 *                             description: "Optional reason for the exception"
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
  "/special-dates",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  authorizeSchoolAccess,
  validate(rangeSchema, "query"),
  async (req, res, next) => {
    try {
      const schoolId = (req as any).schoolId || req.params["schoolId"] || (req as any).user?.schoolId;
      const { from, to } = req.query as unknown as { from: string; to: string };
      const data = await listSpecialDates(schoolId, from, to);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/schools/{schoolId}/calendar/special-dates/bulk:
 *   put:
 *     summary: Upsert special dates in bulk
 *     description: Create or update multiple special date exceptions at once. Use this to set holidays, closures, or special openings. Maximum 366 dates per request.
 *     tags: [School Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schoolId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 366
 *                 description: "Array of special dates to upsert (1-366 items)"
 *                 items:
 *                   type: object
 *                   required:
 *                     - date
 *                     - is_available
 *                   properties:
 *                     date:
 *                       type: string
 *                       format: date
 *                       example: "2025-12-25"
 *                       description: "Date in ISO format (YYYY-MM-DD)"
 *                     is_available:
 *                       type: boolean
 *                       example: false
 *                       description: "Whether the school is available on this date"
 *                     reason:
 *                       type: string
 *                       nullable: true
 *                       example: "Christmas Holiday"
 *                       description: "Optional reason for the exception"
 *           example:
 *             items:
 *               - { date: "2025-12-25", is_available: false, reason: "Christmas" }
 *               - { date: "2025-12-31", is_available: false, reason: "New Year's Eve" }
 *               - { date: "2025-01-01", is_available: false, reason: "New Year's Day" }
 *     responses:
 *       200:
 *         description: Special dates upserted successfully
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
 *                           date:
 *                             type: string
 *                             format: date
 *                             example: "2025-12-25"
 *                           is_available:
 *                             type: boolean
 *                             example: false
 *                           reason:
 *                             type: string
 *                             nullable: true
 *                             example: "Christmas Holiday"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/special-dates/bulk",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  authorizeSchoolAccess,
  validate(specialBulkSchema),
  async (req, res, next) => {
    try {
      const schoolId = (req as any).schoolId || req.params["schoolId"] || (req as any).user?.schoolId;
      const { items } = req.body as { items: { date: string; is_available: boolean; reason?: string }[] };
      const data = await upsertSpecialDatesBulk(schoolId, items);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/schools/{schoolId}/calendar/special-dates:
 *   delete:
 *     summary: Delete special dates
 *     description: Remove special date exceptions. After deletion, these dates will follow the weekly availability pattern again.
 *     tags: [School Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schoolId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dates
 *             properties:
 *               dates:
 *                 type: array
 *                 minItems: 1
 *                 description: "Array of dates to delete (ISO format)"
 *                 items:
 *                   type: string
 *                   format: date
 *                   example: "2025-12-25"
 *           example:
 *             dates: ["2025-12-25", "2025-12-31", "2025-01-01"]
 *     responses:
 *       200:
 *         description: Special dates deleted successfully
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
 *                         deleted:
 *                           type: integer
 *                           example: 3
 *                           description: "Number of dates deleted"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  "/special-dates",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  authorizeSchoolAccess,
  validate(deleteSchema),
  async (req, res, next) => {
    try {
      const schoolId = (req as any).schoolId || req.params["schoolId"] || (req as any).user?.schoolId;
      const { dates } = req.body as { dates: string[] };
      const result = await deleteSpecialDates(schoolId, dates);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/schools/{schoolId}/calendar/is-available:
 *   get:
 *     summary: Check if a specific date is available
 *     description: Check if the school is available on a specific date. This combines weekly pattern and special date exceptions. First checks for special date override, then falls back to weekly pattern.
 *     tags: [School Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schoolId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-12-25"
 *         description: Date to check (ISO format YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Date availability checked successfully
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
 *                         is_available:
 *                           type: boolean
 *                           example: false
 *                           description: "Whether the school is available on the specified date"
 *       400:
 *         description: Date parameter missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/is-available",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN", "INSTRUCTOR"]),
  authorizeSchoolAccess,
  async (req, res, next) => {
    try {
      const schoolId = (req as any).schoolId || req.params["schoolId"] || (req as any).user?.schoolId;
      const date = (req.query["date"] as string) || "";
      if (!date) {
        return res.status(400).json({ success: false, error: "date query required" });
      }
      const available = await isSchoolDateAvailable(schoolId, date);
      return res.json({ success: true, data: { is_available: available } });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;


