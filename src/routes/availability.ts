/**
 * @fileoverview Availability routes
 */

import { Router } from "express";
import { authenticate, authorizeRoles } from "../middleware/auth";
import { validate } from "../middleware/validation";
import Joi from "joi";
import {
  addInstructorAvailability,
  getInstructorAvailability,
  removeInstructorAvailability,
  checkInstructorAvailabilitySlot,
  getAvailableInstructorsForSlot,
  getBatchInstructorAvailability,
  addBatchInstructorAvailability,
} from "../services/availability";
import { AuthenticatedRequest } from "../types";

const router = Router();

const rangeQuerySchema = Joi.object({
  instructorId: Joi.string().uuid().required(),
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().required(),
});

const slotSchema = Joi.object({
  date: Joi.string().isoDate().required(),
  timeStart: Joi.string()
    .pattern(/^\d{1,2}(:\d{2}(:\d{2})?)?$/)
    .required(),
  timeEnd: Joi.string()
    .pattern(/^\d{1,2}(:\d{2}(:\d{2})?)?$/)
    .required(),
});

const addSchema = slotSchema.keys({
  instructorId: Joi.string().uuid().required(),
});

const removeSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

const checkSchema = Joi.object({
  instructorId: Joi.string().uuid().required(),
  date: Joi.string().isoDate().required(),
  timeStart: Joi.string()
    .pattern(/^\d{1,2}(:\d{2}(:\d{2})?)?$/)
    .required(),
  timeEnd: Joi.string()
    .pattern(/^\d{1,2}(:\d{2}(:\d{2})?)?$/)
    .required(),
});

const slotQuerySchema = Joi.object({
  date: Joi.string().isoDate().required(),
  timeStart: Joi.string()
    .pattern(/^\d{1,2}(:\d{2}(:\d{2})?)?$/)
    .required(),
  timeEnd: Joi.string()
    .pattern(/^\d{1,2}(:\d{2}(:\d{2})?)?$/)
    .required(),
  discipline: Joi.string().optional(),
});

/**
 * @swagger
 * /api/availability:
 *   get:
 *     summary: Get instructor availability by date range
 *     description: Retrieve all availability slots for an instructor within a date range. Available to SCHOOL_ADMIN, INSTRUCTOR, and SUPER_ADMIN.
 *     tags: [Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instructorId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: Instructor ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *         description: Start date (YYYY-MM-DD)
 *         example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *         description: End date (YYYY-MM-DD)
 *         example: "2024-01-31"
 *     responses:
 *       200:
 *         description: Availability fetched successfully
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
 *                           instructor_id:
 *                             type: string
 *                             format: uuid
 *                           date:
 *                             type: string
 *                             format: date
 *                           time_start:
 *                             type: string
 *                             format: time
 *                           time_end:
 *                             type: string
 *                             format: time
 *                           is_active:
 *                             type: boolean
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// Get availability range
router.get(
  "/",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "INSTRUCTOR", "SUPER_ADMIN"]),
  validate(rangeQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const { instructorId, startDate, endDate } = req.query as unknown as {
        instructorId: string;
        startDate: string;
        endDate: string;
      };
      const data = await getInstructorAvailability(
        instructorId,
        startDate,
        endDate,
      );
      return res.json({ success: true, data, message: "Availability fetched" });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/availability:
 *   post:
 *     summary: Add instructor availability slot
 *     description: Add a new availability slot for an instructor. Available to SCHOOL_ADMIN, INSTRUCTOR, and SUPER_ADMIN.
 *     tags: [Availability]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [instructorId, date, timeStart, timeEnd]
 *             properties:
 *               instructorId:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2024-01-15"
 *                 description: "Date for the availability slot (YYYY-MM-DD)"
 *               timeStart:
 *                 type: string
 *                 pattern: "^\\d{1,2}(:\\d{2}(:\\d{2})?)?$"
 *                 example: "09:00"
 *                 description: "Start time (HH:mm or HH:mm:ss format)"
 *               timeEnd:
 *                 type: string
 *                 pattern: "^\\d{1,2}(:\\d{2}(:\\d{2})?)?$"
 *                 example: "18:00"
 *                 description: "End time (HH:mm or HH:mm:ss format)"
 *           example:
 *             instructorId: "123e4567-e89b-12d3-a456-426614174000"
 *             date: "2024-01-15"
 *             timeStart: "09:00"
 *             timeEnd: "18:00"
 *     responses:
 *       201:
 *         description: Availability slot added successfully
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
 *                         id:
 *                           type: string
 *                           format: uuid
 *                           example: "123e4567-e89b-12d3-a456-426614174000"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// Add availability
router.post(
  "/",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "INSTRUCTOR", "SUPER_ADMIN"]),
  validate(addSchema),
  async (req, res, next) => {
    try {
      const { instructorId, date, timeStart, timeEnd } = req.body as {
        instructorId: string;
        date: string;
        timeStart: string;
        timeEnd: string;
      };
      const id = await addInstructorAvailability(
        instructorId,
        date,
        timeStart,
        timeEnd,
      );
      return res
        .status(201)
        .json({ success: true, data: { id }, message: "Availability added" });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/availability/{id}:
 *   delete:
 *     summary: Remove (deactivate) availability slot
 *     description: Soft deactivate an availability slot by ID. Available to SCHOOL_ADMIN, INSTRUCTOR, and SUPER_ADMIN.
 *     tags: [Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Availability slot ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Availability slot removed successfully
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
 *                         id:
 *                           type: string
 *                           format: uuid
 *                     message:
 *                       type: string
 *                       enum: ["Availability removed", "No change"]
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// Remove availability (soft deactivate)
router.delete(
  "/:id",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "INSTRUCTOR", "SUPER_ADMIN"]),
  validate(removeSchema, "params"),
  async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const ok = await removeInstructorAvailability(id);
      return res.json({
        success: ok,
        data: { id },
        message: ok ? "Availability removed" : "No change",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/availability/check:
 *   get:
 *     summary: Check if instructor is available for a specific slot
 *     description: Check if an instructor has availability for a specific time slot. Available to SCHOOL_ADMIN, INSTRUCTOR, and SUPER_ADMIN.
 *     tags: [Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instructorId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Instructor ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Date to check (YYYY-MM-DD)
 *         example: "2024-01-15"
 *       - in: query
 *         name: timeStart
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^\\d{1,2}(:\\d{2}(:\\d{2})?)?$"
 *         description: Start time (HH:mm or HH:mm:ss format)
 *         example: "09:00"
 *       - in: query
 *         name: timeEnd
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^\\d{1,2}(:\\d{2}(:\\d{2})?)?$"
 *         description: End time (HH:mm or HH:mm:ss format)
 *         example: "10:00"
 *     responses:
 *       200:
 *         description: Availability check result
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
 *                         available:
 *                           type: boolean
 *                           description: "Whether the instructor is available for the specified slot"
 *                           example: true
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// Check a specific slot for an instructor
router.get(
  "/check",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "INSTRUCTOR", "SUPER_ADMIN"]),
  validate(checkSchema, "query"),
  async (req, res, next) => {
    try {
      const { instructorId, date, timeStart, timeEnd } =
        req.query as unknown as {
          instructorId: string;
          date: string;
          timeStart: string;
          timeEnd: string;
        };
      const available = await checkInstructorAvailabilitySlot(
        instructorId,
        date,
        timeStart,
        timeEnd,
      );
      return res.json({ success: true, data: { available } });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/availability/available-instructors:
 *   get:
 *     summary: List available instructors for a time slot
 *     description: Get a list of instructors who are available for a specific time slot, optionally filtered by discipline. Uses the authenticated user's school. Available to SCHOOL_ADMIN and SUPER_ADMIN.
 *     tags: [Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Date to check (YYYY-MM-DD)
 *         example: "2024-01-15"
 *       - in: query
 *         name: timeStart
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^\\d{1,2}(:\\d{2}(:\\d{2})?)?$"
 *         description: Start time (HH:mm or HH:mm:ss format)
 *         example: "09:00"
 *       - in: query
 *         name: timeEnd
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^\\d{1,2}(:\\d{2}(:\\d{2})?)?$"
 *         description: End time (HH:mm or HH:mm:ss format)
 *         example: "10:00"
 *       - in: query
 *         name: discipline
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional discipline filter
 *         example: "kite"
 *     responses:
 *       200:
 *         description: List of available instructors retrieved successfully
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
 *                           first_name:
 *                             type: string
 *                           last_name:
 *                             type: string
 *                           specialties:
 *                             type: array
 *                             items:
 *                               type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// List available instructors for a slot (uses user's school)
router.get(
  "/available-instructors",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  validate(slotQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const user = (req as unknown as AuthenticatedRequest).user;
      if (!user.schoolId) {
        return res.status(403).json({
          success: false,
          error: "User not associated with any school",
        });
      }

      const { date, timeStart, timeEnd, discipline } = req.query as unknown as {
        date: string;
        timeStart: string;
        timeEnd: string;
        discipline?: string;
      };
      const data = await getAvailableInstructorsForSlot(
        user.schoolId,
        date,
        timeStart,
        timeEnd,
        discipline,
      );
      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/availability/batch:
 *   get:
 *     summary: Get availability for multiple instructors
 *     description: Returns availability slots for multiple instructors in a single optimized request. Available to SCHOOL_ADMIN, INSTRUCTOR, and SUPER_ADMIN.
 *     tags: [Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instructorIds
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(,[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})*$"
 *         description: Comma-separated list of instructor UUIDs
 *         example: "123e4567-e89b-12d3-a456-426614174000,456e7890-e89b-12d3-a456-426614174001"
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *         example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *         example: "2024-01-31"
 *     responses:
 *       200:
 *         description: Availability fetched for all instructors successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       additionalProperties:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                               format: uuid
 *                             instructor_id:
 *                               type: string
 *                               format: uuid
 *                             date:
 *                               type: string
 *                               format: date
 *                             time_start:
 *                               type: string
 *                               format: time
 *                             time_end:
 *                               type: string
 *                               format: time
 *                             is_active:
 *                               type: boolean
 *                       description: "Object keyed by instructor ID, each containing an array of availability slots"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
const batchRangeSchema = Joi.object({
  instructorIds: Joi.string().required(),
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().required(),
});

router.get(
  "/batch",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "INSTRUCTOR", "SUPER_ADMIN"]),
  validate(batchRangeSchema, "query"),
  async (req, res, next) => {
    try {
      const { instructorIds, startDate, endDate } = req.query as unknown as {
        instructorIds: string;
        startDate: string;
        endDate: string;
      };
      const ids = instructorIds.split(",").filter(Boolean);
      const data = await getBatchInstructorAvailability(
        ids,
        startDate,
        endDate,
      );
      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  },
);

const batchAddSchema = Joi.object({
  instructorId: Joi.string().uuid().required(),
  slots: Joi.array().items(slotSchema).min(1).required(),
});

/**
 * @swagger
 * /api/availability/batch:
 *   post:
 *     summary: Add multiple instructor availability slots
 *     description: Add multiple availability slots for an instructor in one request.
 *     tags: [Availability]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [instructorId, slots]
 *             properties:
 *               instructorId:
 *                 type: string
 *                 format: uuid
 *               slots:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [date, timeStart, timeEnd]
 *                   properties:
 *                     date:
 *                       type: string
 *                       format: date
 *                     timeStart:
 *                       type: string
 *                       pattern: "^\\d{1,2}(:\\d{2}(:\\d{2})?)?$"
 *                     timeEnd:
 *                       type: string
 *                       pattern: "^\\d{1,2}(:\\d{2}(:\\d{2})?)?$"
 *     responses:
 *       201:
 *         description: Availability slots added successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post(
  "/batch",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "INSTRUCTOR", "SUPER_ADMIN"]),
  validate(batchAddSchema),
  async (req, res, next) => {
    try {
      const { instructorId, slots } = req.body as {
        instructorId: string;
        slots: Array<{ date: string; timeStart: string; timeEnd: string }>;
      };
      

      
      const ids = await addBatchInstructorAvailability(instructorId, slots);
      return res
        .status(201)
        .json({ success: true, data: { ids }, message: "Availability added" });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
