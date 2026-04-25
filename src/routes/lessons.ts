/**
 * @fileoverview Lesson routes - rescheduling and conflicts
 */

import { Router } from "express";
import { authenticate, authorizeRoles } from "../middleware/auth";
import { validate } from "../middleware/validation";
import Joi from "joi";
import {
  getLessonsByRange,
  getInstructorLessons,
  getInstructorConflicts,
  rescheduleLesson,
  computeTimeEnd,
  hasInstructorLessonOverlap,
  getLessonById,
  getLessonCountsByStudents,
} from "../services/lessons";
import { supabaseAdmin } from "../database/supabase";
import { isSchoolDateAvailable } from "../services/schoolCalendar";
import { checkInstructorAvailabilitySlot } from "../services/availability";
import {
  deductBookingMinutes,
  restoreBookingMinutes,
  getConfirmedLessonsDuration,
} from "../services/bookings";
import {
  canInstructorEditLessonsInSchool,
  INSTRUCTOR_LESSON_EDIT_FORBIDDEN_ERROR,
  NO_BOOKED_HOURS_ERROR,
} from "../services/instructorLessonPermissions";
import { AppError, AuthenticatedRequest } from "../types";

const router = Router();

// Check if lesson date/time is in the past

const isLessonInPast = (lessonDate: string, lessonTime: string): boolean => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  if (lessonDate < todayStr) {
    return true;
  }

  if (lessonDate > todayStr) {
    return false;
  }

  const [hours, minutes] = lessonTime.split(":").map(Number);
  const lessonDateTime = new Date(
    year,
    now.getMonth(),
    now.getDate(),
    hours || 0,
    minutes || 0,
    0,
  );

  return lessonDateTime < now;
};

/**
 * Middleware to set instructor_id for INSTRUCTOR role
 * This must run before validation because instructor_id is required in the schema
 */
const setInstructorIdForInstructors = (req: any, res: any, next: any) => {
  const user = req.user;
  if (user && user.role === "INSTRUCTOR") {
    // If an instructor provided an instructor_id, it must be their own
    if (req.body.instructor_id && req.body.instructor_id !== user.id) {
      return res.status(403).json({
        success: false,
        error: "Instructors can only create lessons for themselves.",
      });
    }
    // Force instructor_id to be the current user
    req.body.instructor_id = user.id;
  }
  next();
};

const rescheduleSchema = Joi.object({
  date: Joi.string().isoDate().required(),
  timeStart: Joi.string()
    .pattern(/^\d{2}:\d{2}(:\d{2})?$/)
    .required(),
  durationMinutes: Joi.number().integer().min(30).max(720).required(), // 30 minutes to 12 hours
  instructorId: Joi.string().uuid().optional(),
});

const updateLessonSchema = Joi.object({
  lesson_status_id: Joi.string().uuid().optional().allow(null),
  duration: Joi.number().integer().min(15).max(720).optional(),
  time: Joi.string()
    .pattern(/^\d{2}:\d{2}(:\d{2})?$/)
    .optional(),
});

const rangeSchema = Joi.object({
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().required(),
  instructorId: Joi.string().uuid().optional(),
  discipline: Joi.string().optional(),
  studentId: Joi.string().uuid().optional(),
  limit: Joi.number().integer().min(1).max(1000).optional(),
  offset: Joi.number().integer().min(0).optional(),
  schoolId: Joi.string().uuid().optional(),
});

const lessonCountsSchema = Joi.object({
  startDate: Joi.string().isoDate().required().messages({
    "string.isoDate": "Start date must be a valid ISO date",
    "any.required": "Start date is required",
  }),
  endDate: Joi.string().isoDate().required().messages({
    "string.isoDate": "End date must be a valid ISO date",
    "any.required": "End date is required",
  }),
  studentIds: Joi.alternatives()
    .try(
      Joi.string()
        .custom((value, helpers) => {
          if (
            !value ||
            typeof value !== "string" ||
            value.trim().length === 0
          ) {
            return helpers.error("any.required", {
              message: "Student IDs are required",
            });
          }

          const tokens = value
            .split(",")
            .map((token: string) => token.trim())
            .filter((token: string) => token.length > 0);

          if (tokens.length === 0) {
            return helpers.error("any.required", {
              message: "At least one student ID is required",
            });
          }

          if (tokens.length > 100) {
            return helpers.error("any.custom", {
              message: "Maximum 100 student IDs allowed",
            });
          }

          const uuidSchema = Joi.string().uuid();
          for (const token of tokens) {
            const { error } = uuidSchema.validate(token);
            if (error) {
              return helpers.error("string.guid", {
                message: `Invalid UUID format: ${token}`,
              });
            }
          }

          return value;
        })
        .messages({
          "any.required": "Student IDs are required",
          "any.custom": "Maximum 100 student IDs allowed",
          "string.guid": "Student IDs must be valid UUIDs",
        }),
      Joi.array().items(Joi.string().uuid()).min(1).max(100).messages({
        "array.min": "At least one student ID is required",
        "array.max": "Maximum 100 student IDs allowed",
      }),
    )
    .required()
    .messages({
      "any.required": "Student IDs are required",
    }),
  schoolId: Joi.string().uuid().optional().messages({
    "string.guid": "School ID must be a valid UUID",
  }),
});

const instructorRangeSchema = Joi.object({
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
  discipline: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(1000).optional(),
  offset: Joi.number().integer().min(0).optional(),
  schoolId: Joi.string().optional(),
});

const instructorConflictsSchema = Joi.object({
  instructorIds: Joi.string().required(),
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().required(),
});

const createLessonSchema = Joi.object({
  instructor_id: Joi.string().uuid().required(),
  student_id: Joi.string().uuid().optional(),
  student_ids: Joi.array().items(Joi.string().uuid()).min(1).optional(),
  product_id: Joi.string().uuid().optional(),
  booking_id: Joi.string().uuid().optional(),
  date: Joi.string().isoDate().required(),
  time: Joi.string()
    .pattern(/^\d{2}:\d{2}(:\d{2})?$/)
    .required(),
  duration: Joi.number().integer().min(30).max(480).required(), // 30 minutes to 8 hours
  discipline: Joi.string().required().min(1).messages({
    "string.empty": '"discipline" is not allowed to be empty',
    "any.required": '"discipline" is required',
  }),
  level: Joi.string().optional().allow(null, ""),
  notes: Joi.string().max(1000).allow("").optional().default(""),
  lesson_status_id: Joi.string().uuid().optional(),
  status: Joi.string().optional(),
  source: Joi.string().optional().default("manual"),
}).custom((value, helpers) => {
  if (
    !value.student_id &&
    (!value.student_ids || value.student_ids.length === 0)
  ) {
    return helpers.error("any.custom", {
      message: "Either student_id or student_ids must be provided",
    });
  }
  return value;
});

/**
 * @swagger
 * /api/lessons:
 *   get:
 *     summary: List lessons by date range
 *     description: Retrieve lessons within a date range, optionally filtered by instructor, discipline, or student. SCHOOL_ADMIN can only access their own school's lessons. SUPER_ADMIN can access any school by providing schoolId query parameter.
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *       - in: query
 *         name: instructorId
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by instructor ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *       - in: query
 *         name: discipline
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by discipline slug
 *         example: "kite"
 *       - in: query
 *         name: studentId
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by student ID
 *         example: "123e4567-e89b-12d3-a456-426614174001"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Maximum number of lessons to return
 *         example: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Number of lessons to skip
 *         example: 0
 *       - in: query
 *         name: schoolId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID (required for SUPER_ADMIN, optional for SCHOOL_ADMIN. SCHOOL_ADMIN cannot query other schools)
 *         required: false
 *     responses:
 *       200:
 *         description: Lessons retrieved successfully
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
 *                         description: Lesson object with full details
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
  validate(rangeSchema, "query"),
  async (req, res, next) => {
    try {
      const {
        startDate,
        endDate,
        instructorId,
        discipline,
        studentId,
        limit,
        offset,
        schoolId: querySchoolId,
      } = req.query as unknown as {
        startDate: string;
        endDate: string;
        instructorId?: string;
        discipline?: string;
        studentId?: string;
        limit?: number;
        offset?: number;
        schoolId?: string;
      };
      const user = (req as any).user as { schoolId: string; role: string };

      // For SUPER_ADMIN, use query param if provided. For SCHOOL_ADMIN, use user.schoolId
      let targetSchoolId: string | undefined;
      if (user.role === "SUPER_ADMIN" && querySchoolId) {
        targetSchoolId = querySchoolId;
      } else if (user.role === "SCHOOL_ADMIN") {
        targetSchoolId = user.schoolId;
      }

      if (!targetSchoolId) {
        return res.status(403).json({
          success: false,
          error: "School ID is required",
        });
      }

      const data = await getLessonsByRange(targetSchoolId, startDate, endDate, {
        ...(instructorId && { instructorId }),
        ...(discipline && { discipline }),
        ...(studentId && { studentId }),
        ...(limit && { limit }),
        ...(offset && { offset }),
      });
      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/lessons/counts:
 *   get:
 *     summary: Get lesson counts for multiple students
 *     description: Returns total and upcoming lesson counts for multiple students in a single optimized query
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: studentIds
 *         required: true
 *         schema:
 *           oneOf:
 *             - type: string
 *               pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(,[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})*$'
 *               description: Comma-separated UUIDs
 *             - type: array
 *               items:
 *                 type: string
 *                 format: uuid
 *               minItems: 1
 *               maxItems: 100
 *               description: JSON array of UUIDs
 *       - in: query
 *         name: schoolId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID (required for SUPER_ADMIN, optional for SCHOOL_ADMIN)
 *     responses:
 *       200:
 *         description: Lesson counts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       studentId:
 *                         type: string
 *                         format: uuid
 *                       total:
 *                         type: integer
 *                       upcoming:
 *                         type: integer
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
  "/counts",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  validate(lessonCountsSchema, "query"),
  async (req, res, next) => {
    try {
      const {
        startDate,
        endDate,
        studentIds: studentIdsParam,
        schoolId: querySchoolId,
      } = req.query as unknown as {
        startDate: string;
        endDate: string;
        studentIds: string | string[];
        schoolId?: string;
      };

      const user = (req as any).user as { schoolId: string; role: string };

      // For SUPER_ADMIN, use query param if provided. For SCHOOL_ADMIN, use user.schoolId
      let targetSchoolId: string | undefined;
      if (user.role === "SUPER_ADMIN" && querySchoolId) {
        targetSchoolId = querySchoolId;
      } else if (user.role === "SCHOOL_ADMIN") {
        targetSchoolId = user.schoolId;
      }

      if (!targetSchoolId) {
        return res.status(403).json({
          success: false,
          error: "School ID is required",
        });
      }

      // Parse studentIds: handle both comma-separated string and array
      let studentIds: string[];
      if (typeof studentIdsParam === "string") {
        studentIds = studentIdsParam
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);
      } else if (Array.isArray(studentIdsParam)) {
        studentIds = studentIdsParam;
      } else {
        return res.status(400).json({
          success: false,
          error:
            "Student IDs must be provided as comma-separated string or array",
        });
      }

      if (studentIds.length === 0) {
        return res.json({ success: true, data: [] });
      }

      const counts = await getLessonCountsByStudents(
        targetSchoolId,
        startDate,
        endDate,
        studentIds,
      );

      return res.json({ success: true, data: counts });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/lessons/instructor:
 *   get:
 *     summary: List lessons for the authenticated instructor
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: discipline
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Instructor lessons list
 */
router.get(
  "/instructor",
  authenticate,
  authorizeRoles(["INSTRUCTOR"]),
  validate(instructorRangeSchema, "query"),
  async (req, res, next) => {
    try {
      const { startDate, endDate, discipline, limit, offset, schoolId } =
        req.query as unknown as {
          startDate?: string;
          endDate?: string;
          discipline?: string;
          limit?: number;
          offset?: number;
          schoolId?: string;
        };
      const user = (req as any).user as { id: string };
      if (!user?.id) {
        return res.status(403).json({
          success: false,
          error: "User not authenticated",
        });
      }
      const data = await getInstructorLessons(user.id, startDate, endDate, {
        ...(discipline && { discipline }),
        ...(limit && { limit }),
        ...(offset && { offset }),
        ...(schoolId && { schoolId }),
      });
      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  },
);

// Test endpoint to debug function structure
router.get(
  "/instructor/test",
  authenticate,
  authorizeRoles(["INSTRUCTOR"]),
  validate(instructorRangeSchema, "query"),
  async (req, res, next) => {
    try {
      const { startDate, endDate, discipline, limit, offset } =
        req.query as unknown as {
          startDate?: string;
          endDate?: string;
          discipline?: string;
          limit?: number;
          offset?: number;
        };
      const user = (req as any).user as { id: string };
      if (!user?.id) {
        return res.status(403).json({
          success: false,
          error: "User not authenticated",
        });
      }

      const data = await getInstructorLessons(user.id, startDate, endDate, {
        ...(discipline && { discipline }),
        ...(limit && { limit }),
        ...(offset && { offset }),
      });

      return res.json({ success: true, data: data || [] });
    } catch (error) {
      return next(error);
    }
  },
);

// Ultra simple test endpoint
router.get(
  "/instructor/test2",
  authenticate,
  authorizeRoles(["INSTRUCTOR"]),
  validate(instructorRangeSchema, "query"),
  async (req, res, next) => {
    try {
      const { startDate, endDate, discipline, limit, offset } =
        req.query as unknown as {
          startDate?: string;
          endDate?: string;
          discipline?: string;
          limit?: number;
          offset?: number;
        };
      const user = (req as any).user as { id: string };
      if (!user?.id) {
        return res.status(403).json({
          success: false,
          error: "User not authenticated",
        });
      }

      const data = await getInstructorLessons(user.id, startDate, endDate, {
        ...(discipline && { discipline }),
        ...(limit && { limit }),
        ...(offset && { offset }),
      });

      return res.json({ success: true, data: data || [] });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/lessons/instructor-conflicts:
 *   get:
 *     summary: Get all lessons for instructors across all schools (for conflict detection)
 *     description: Returns all lessons for specified instructors regardless of school, used to detect conflicts in calendar view
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instructorIds
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated list of instructor UUIDs
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Instructor conflicts retrieved successfully
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
  "/instructor-conflicts",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  validate(instructorConflictsSchema, "query"),
  async (req, res, next) => {
    try {
      const { instructorIds, startDate, endDate } = req.query as unknown as {
        instructorIds: string;
        startDate: string;
        endDate: string;
      };

      const instructorIdArray = instructorIds
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      if (instructorIdArray.length === 0) {
        return res.status(400).json({
          success: false,
          error: "At least one instructor ID is required",
        });
      }

      const data = await getInstructorConflicts(
        instructorIdArray,
        startDate,
        endDate,
      );

      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/lessons/{id}/reschedule:
 *   post:
 *     summary: Reschedule a lesson with conflict checks
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, timeStart, durationMinutes]
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               timeStart:
 *                 type: string
 *                 example: "09:00:00"
 *               durationMinutes:
 *                 type: integer
 *                 example: 120
 *     responses:
 *       200:
 *         description: Lesson rescheduled
 */
// Reschedule a lesson with conflict checks
router.post(
  "/:id/reschedule",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  validate(rescheduleSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          success: false,
          error: "Lesson ID is required",
        });
      }
      const { date, timeStart, durationMinutes, instructorId } = req.body as {
        date: string;
        timeStart: string;
        durationMinutes: number;
        instructorId?: string;
      };

      // Prevent rescheduling lessons to past date/time
      if (isLessonInPast(date, timeStart)) {
        return res.status(400).json({
          success: false,
          error:
            "Cannot reschedule lessons to the past. Please select a future date and time.",
        });
      }

      // Global duration rule: all lessons must align to 15-minute units
      if (durationMinutes % 15 !== 0) {
        return res.status(400).json({
          success: false,
          error:
            "Lesson duration must be in 15-minute increments (15, 30, 45, 60, ...).",
        });
      }

      const data = await rescheduleLesson(
        id,
        date,
        timeStart,
        durationMinutes,
        instructorId,
      );
      return res.json({ success: true, data, message: "Lesson rescheduled" });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/lessons:
 *   post:
 *     summary: Create a new lesson
 *     description: Create a new lesson for a student with an instructor
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - instructor_id
 *               - student_id
 *               - date
 *               - time
 *               - duration
 *               - discipline
 *             properties:
 *               instructor_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the instructor
 *               student_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the student
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Date of the lesson (YYYY-MM-DD)
 *               time:
 *                 type: string
 *                 pattern: '^\\d{2}:\\d{2}(:\\d{2})?$'
 *                 description: Start time of the lesson (HH:MM or HH:MM:SS)
 *               duration:
 *                 type: integer
 *                 minimum: 30
 *                 maximum: 480
 *                 description: Duration in minutes (30-480)
 *               discipline:
 *                 type: string
 *                 description: Water sport discipline (any string value)
 *               level:
 *                 type: string
 *                 enum: [beginner, intermediate, advanced]
 *                 default: beginner
 *                 description: Student skill level
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 default: ''
 *                 description: Optional notes about the lesson
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 default: 0
 *                 description: Lesson price
 *               status:
 *                 type: string
 *                 default: pending
 *                 description: Lesson status
 *               payment_status:
 *                 type: string
 *                 default: unpaid
 *                 description: Payment status
 *               booking_id:
 *                 type: string
 *                 format: uuid
 *                 description: Optional booking ID to link lesson with a booking. Hours will be deducted from booking when status is confirmed.
 *               source:
 *                 type: string
 *                 default: manual
 *                 description: How the lesson was created
 *     responses:
 *       201:
 *         description: Lesson created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     instructor_id:
 *                       type: string
 *                       format: uuid
 *                     student_id:
 *                       type: string
 *                       format: uuid
 *                     date:
 *                       type: string
 *                       format: date
 *                     time:
 *                       type: string
 *                     duration:
 *                       type: integer
 *                     discipline:
 *                       type: string
 *                     level:
 *                       type: string
 *                     notes:
 *                       type: string
 *                     price:
 *                       type: number
 *                     status:
 *                       type: string
 *                     payment_status:
 *                       type: string
 *                     source:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *                   example: "Lesson created successfully"
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post(
  "/",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN", "INSTRUCTOR"]),
  setInstructorIdForInstructors,
  validate(createLessonSchema),
  async (req, res, next) => {
    try {
      const user = (req as any).user as { schoolId?: string; role: string };
      const lessonData = req.body;
      const { schoolId: querySchoolId } = req.query as { schoolId?: string };

      let targetSchoolId: string | undefined;
      if (user.role === "SUPER_ADMIN" && querySchoolId) {
        targetSchoolId = querySchoolId;
      } else if (user.role === "SCHOOL_ADMIN") {
        targetSchoolId = user.schoolId;
      } else if (user.role === "INSTRUCTOR") {
        // Strict primary school lookup for instructors
        const { data: schoolAssocs, error: assocError } = await (supabaseAdmin as any)
          .from("instructor_schools")
          .select("school_id")
          .eq("instructor_id", (user as any).id)
          .eq("is_active", true)
          .eq("is_primary", true);

        if (assocError) {
          return res.status(500).json({
            success: false,
            error: "Failed to verify school association",
            details: assocError.message,
          });
        }

        if (!schoolAssocs || schoolAssocs.length === 0) {
          return res.status(403).json({
            success: false,
            error: "No primary school associated with this instructor.",
          });
        }

        if (schoolAssocs.length > 1) {
          return res.status(403).json({
            success: false,
            error: "Ambiguous school association: multiple primary schools found.",
          });
        }

        targetSchoolId = schoolAssocs[0].school_id;
      }

      if (!targetSchoolId) {
        return res.status(403).json({
          success: false,
          error: "School ID is required",
        });
      }

      // Global duration rule: all lessons must align to 15-minute units
      if (lessonData.duration % 15 !== 0) {
        return res.status(400).json({
          success: false,
          error:
            "Lesson duration must be in 15-minute increments (15, 30, 45, 60, ...).",
        });
      }

      const studentIds: string[] = lessonData.student_ids
        ? Array.isArray(lessonData.student_ids)
          ? lessonData.student_ids
          : [lessonData.student_ids]
        : lessonData.student_id
          ? [lessonData.student_id]
          : [];

      if (studentIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "At least one student must be selected",
        });
      }

      // Validate all students belong to this school.
      // Primary path uses student_schools (multi-school), with a users.school_id
      // fallback for environments/tests that have not migrated table typing/mocks yet.
      let membershipsValid = false;
      const { data: memberships, error: membershipLookupError } =
        await (supabaseAdmin as any)
          .from("student_schools")
          .select("student_id, skill_level")
          .in("student_id", studentIds)
          .eq("school_id", targetSchoolId)
          .eq("is_active", true);

      if (!membershipLookupError && memberships?.length === studentIds.length) {
        membershipsValid = true;
      }

      if (!membershipsValid) {
        const { data: fallbackUsers, error: fallbackError } = await (supabaseAdmin as any)
          .from("users")
          .select("id")
          .in("id", studentIds)
          .eq("school_id", targetSchoolId)
          .eq("role", "USER");

        if (fallbackError) {
          throw new Error(
            `Failed to verify students: ${fallbackError.message}`,
          );
        }

        if (!fallbackUsers || fallbackUsers.length !== studentIds.length) {
          return res.status(400).json({
            success: false,
            error:
              "One or more students not found in this school. Please select valid students from the Students list.",
          });
        }
      }

      const { data: students, error: studentLookupError } = await supabaseAdmin
        .from("users")
        .select("id")
        .in("id", studentIds)
        .eq("role", "USER");
      // .eq("is_active", true); // allow inactive students in lessons

      if (studentLookupError) {
        throw new Error(
          `Failed to verify students: ${studentLookupError.message}`,
        );
      }

      if (!students || students.length !== studentIds.length) {
        return res.status(400).json({
          success: false,
          error:
            "One or more students not found in this school. Please select valid students from the Students list.",
        });
      }

      // If product_id is provided, validate max_participants
      if (lessonData.product_id) {
        const { data: product, error: productError } = await (
          supabaseAdmin as any
        )
          .from("products")
          .select("max_participants")
          .eq("id", lessonData.product_id)
          .eq("school_id", targetSchoolId)
          .single();

        if (!productError && product) {
          const maxParticipants =
            (product as { max_participants?: number }).max_participants || 1;
          if (studentIds.length > maxParticipants) {
            return res.status(400).json({
              success: false,
              error: `This product allows a maximum of ${maxParticipants} participant(s). You have selected ${studentIds.length} student(s).`,
            });
          }
        }
      }

      // Global duration rule: all lessons must align to 15-minute units

      // Check instructor availability for the requested time and duration
      const timeEnd = computeTimeEnd(lessonData.time, lessonData.duration);
      const instructorAvailable = await checkInstructorAvailabilitySlot(
        lessonData.instructor_id,
        lessonData.date,
        lessonData.time,
        timeEnd,
      );

      if (!instructorAvailable) {
        return res.status(400).json({
          success: false,
          error:
            "Instructor is not available for the requested time and duration. Please check the instructor's availability and choose a different time slot.",
        });
      }

      // Check for time conflicts with existing lessons for the same instructor
      const hasOverlap = await hasInstructorLessonOverlap(
        lessonData.instructor_id,
        lessonData.date,
        lessonData.time,
        timeEnd,
      );

      if (hasOverlap) {
        return res.status(400).json({
          success: false,
          error:
            "Instructor already has a lesson scheduled at this time. Please choose a different time slot.",
        });
      }

      const isAvailable = await isSchoolDateAvailable(
        targetSchoolId,
        lessonData.date,
      );
      if (!isAvailable) {
        return res.status(409).json({
          success: false,
          error: "School is closed on the selected date",
        });
      }

      // Check if lesson end time exceeds school closing time
      const { data: school, error: schoolError } = await (supabaseAdmin as any)
        .from("schools")
        .select("open_hours_end")
        .eq("id", targetSchoolId)
        .single();

      if (!schoolError && school?.open_hours_end) {
        const closingTime =
          school.open_hours_end.includes(":") &&
          school.open_hours_end.split(":").length === 2
            ? `${school.open_hours_end}:00`
            : school.open_hours_end;

        if (timeEnd > closingTime) {
          return res.status(400).json({
            success: false,
            error: `Lesson cannot extend beyond school closing time. School closes at ${school.open_hours_end}`,
          });
        }
      }

      // Validate instructor belongs to target school
      const { data: instructorSchool, error: instructorSchoolError } =
        await supabaseAdmin
          .from("instructor_schools")
          .select("school_id")
          .eq("instructor_id", lessonData.instructor_id)
          .eq("school_id", targetSchoolId)
          .maybeSingle();

      if (instructorSchoolError || !instructorSchool) {
        return res.status(400).json({
          success: false,
          error:
            "Instructor is not associated with this school. Please select an instructor assigned to this school.",
        });
      }

      // Check if lesson status is "confirmed" for booking validation and deduction
      let isConfirmed = false;
      if (lessonData.lesson_status_id) {
        const { data: statusData, error: statusError } = await (
          supabaseAdmin as any
        )
          .from("lesson_statuses")
          .select("name")
          .eq("id", lessonData.lesson_status_id)
          .single();

        if (!statusError && statusData) {
          isConfirmed = statusData.name?.toLowerCase() === "confirmed";
        }
      } else if (lessonData.status) {
        isConfirmed = lessonData.status.toLowerCase() === "confirmed";
      }

      let finalDiscipline = lessonData.discipline;
      if (
        (!finalDiscipline || finalDiscipline.trim() === "") &&
        lessonData.booking_id
      ) {
        const { data: booking, error: bookingError } = await (
          supabaseAdmin as any
        )
          .from("bookings")
          .select(
            `
            *,
            products:product_id(id, disciplines:discipline_id(id, slug))
          `,
          )
          .eq("id", lessonData.booking_id)
          .single();

        if (!bookingError && booking?.products?.disciplines?.slug) {
          finalDiscipline = booking.products.disciplines.slug;
        } else if (!bookingError && booking?.products?.disciplines?.id) {
          const { data: disciplineData } = await (supabaseAdmin as any)
            .from("disciplines")
            .select("slug")
            .eq("id", booking.products.disciplines.id)
            .single();

          if (disciplineData?.slug) {
            finalDiscipline = disciplineData.slug;
          }
        }
      }

      if (!finalDiscipline || finalDiscipline.trim() === "") {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          errors: {
            discipline: ['"discipline" is not allowed to be empty'],
          },
        });
      }

      if (lessonData.booking_id) {
        const { data: bookingForCategory, error: bookingForCategoryError } = await (
          supabaseAdmin as any
        )
          .from("bookings")
          .select(
            "id, products:product_id(category_id, product_categories:category_id(associable_to_lessons))",
          )
          .eq("id", lessonData.booking_id)
          .single();
        if (bookingForCategoryError) {
          return res.status(500).json({
            success: false,
            error: "Database error",
            details: bookingForCategoryError,
          });
        }
        if (!bookingForCategory) {
          return res.status(404).json({ success: false, error: "Booking not found" });
        }
        const associableToLessons =
          bookingForCategory?.products?.product_categories?.associable_to_lessons;
        if (associableToLessons === false) {
          return res.status(400).json({
            success: false,
            error:
              "This booking category is not associable to lessons and cannot be used for lesson scheduling.",
          });
        }
      }

      if (lessonData.booking_id && isConfirmed) {
        // Validate booking exists and has sufficient hours
        const { data: booking, error: bookingError } = await (
          supabaseAdmin as any
        )
          .from("bookings")
          .select("*")
          .eq("id", lessonData.booking_id)
          .single();
        if (bookingError || !booking) {
          return res.status(400).json({
            success: false,
            error: user.role === "INSTRUCTOR" ? NO_BOOKED_HOURS_ERROR : "Booking not found",
          });
        }

        // Verify the booking belongs to the student
        const { data: participant, error: participantError } = await (
          supabaseAdmin as any
        )
          .from("booking_participants")
          .select("booking_id")
          .eq("booking_id", lessonData.booking_id)
          .eq("student_id", studentIds[0])
          .single();

        if (participantError || !participant) {
          return res.status(400).json({
            success: false,
            error: "Booking does not belong to this student",
          });
        }

        if (booking.status !== "active") {
          return res.status(400).json({
            success: false,
            error: user.role === "INSTRUCTOR" ? NO_BOOKED_HOURS_ERROR : "Booking is not active",
          });
        }

        if (booking.remaining_minutes < lessonData.duration) {
          const error = user.role === "INSTRUCTOR" 
            ? NO_BOOKED_HOURS_ERROR
            : `Insufficient hours in booking. Available: ${Math.floor(booking.remaining_minutes / 60)} hours, Requested: ${Math.floor(lessonData.duration / 60)} hours`;
          
          return res.status(400).json({
            success: false,
            error,
          });
        }
      }

      const firstStudent = (students || []).find(
        (s: any) => s.id === studentIds[0],
      ) as any;
      const firstMembership = (memberships || []).find(
        (m: any) => m.student_id === firstStudent?.id,
      ) as any;
      const studentSkillLevel = firstMembership?.skill_level;
      const lessonLevel = lessonData.level || studentSkillLevel;

      if (!lessonLevel) {
        return res.status(400).json({
          success: false,
          error:
            "Student must have a skill level set. Please update the student's profile.",
        });
      }

      const insertData: any = {
        instructor_id: lessonData.instructor_id,
        student_id: studentIds[0],
        date: lessonData.date,
        time: lessonData.time,
        duration: lessonData.duration,
        discipline: finalDiscipline,
        level: lessonLevel,
        notes: lessonData.notes || "",
        source: lessonData.source || "manual",
        school_id: targetSchoolId,
        // Legacy DB compatibility: some environments still require this column.
        // Original lessons CHECK allows: paid | unpaid | partial.
        payment_status: "unpaid",
      };

      if (lessonData.product_id) {
        insertData.product_id = lessonData.product_id;
      }

      if (lessonData.booking_id) {
        insertData.booking_id = lessonData.booking_id;
      }

      // Use status IDs if provided, otherwise fallback to string values
      if (lessonData.lesson_status_id) {
        insertData.lesson_status_id = lessonData.lesson_status_id;
        if (lessonData.status) {
          const statusNameLower = lessonData.status.toLowerCase();
          if (statusNameLower === "waiting") {
            insertData.status = "pending";
          } else if (statusNameLower === "confirmed") {
            insertData.status = "confirmed";
          } else {
            insertData.status = "pending";
          }
        } else {
          // Fetch status name from database and map it
          const { data: statusData } = await (supabaseAdmin as any)
            .from("lesson_statuses")
            .select("name")
            .eq("id", lessonData.lesson_status_id)
            .single();
          if (statusData) {
            const statusNameLower = statusData.name?.toLowerCase();
            if (statusNameLower === "waiting") {
              insertData.status = "pending";
            } else if (statusNameLower === "confirmed") {
              insertData.status = "confirmed";
            } else {
              insertData.status = "pending";
            }
          } else {
            insertData.status = "pending";
          }
        }
      } else {
        insertData.status = lessonData.status || "pending";
      }

      const { data: lesson, error } = await supabaseAdmin
        .from("lessons")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create lesson: ${error.message}`);
      }

      // Add lesson participant
      const participants = studentIds.map((studentId) => ({
        lesson_id: lesson.id,
        student_id: studentId,
      }));

      const { error: participantError } = await supabaseAdmin
        .from("lesson_participants")
        .insert(participants);

      if (participantError) {
        console.warn("Failed to add lesson participants:", participantError);
        // Don't fail the request, just log the warning
      }

      // If booking_id is provided and status is confirmed, deduct hours AFTER lesson creation
      if (
        lessonData.booking_id &&
        isConfirmed &&
        studentIds.length > 0 &&
        studentIds[0]
      ) {
        try {
          await deductBookingMinutes(
            lessonData.booking_id,
            lessonData.duration,
            studentIds[0],
          );
        } catch (bookingError: any) {
          console.error(
            "Failed to deduct hours from booking after lesson creation:",
            bookingError,
          );
        }
      }

      return res.status(201).json({
        success: true,
        data: lesson,
        message: "Lesson created successfully",
      });
    } catch (error: any) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/lessons/{id}:
 *   get:
 *     summary: Get lesson by ID
 *     description: Retrieve a single lesson with all related data including instructor, product, participants, booking, and statuses
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Lesson ID
 *     responses:
 *       200:
 *         description: Lesson retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     date:
 *                       type: string
 *                       format: date
 *                     time:
 *                       type: string
 *                     duration:
 *                       type: integer
 *                     discipline:
 *                       type: string
 *                     level:
 *                       type: string
 *                     price:
 *                       type: number
 *                     notes:
 *                       type: string
 *                     instructor:
 *                       type: object
 *                     product:
 *                       type: object
 *                     participants:
 *                       type: array
 *                     booking:
 *                       type: object
 *                     bookingLessons:
 *                       type: array
 *                     lessonStatus:
 *                       type: object
 *                     paymentStatus:
 *                       type: object
 *                 message:
 *                   type: string
 *                   example: "Lesson retrieved successfully"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Lesson not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/:id",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN", "INSTRUCTOR"]),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { id } = req.params;
      const userRole = authReq.user["role"];
      const userId = authReq.user["id"];

      if (!id) {
        return res.status(400).json({
          success: false,
          error: "Lesson ID is required",
        });
      }

      const isSuperAdmin = userRole === "SUPER_ADMIN";
      const isInstructor = userRole === "INSTRUCTOR";
      let schoolId: string | null = null;

      if (isSuperAdmin) {
        schoolId = (req.query["schoolId"] as string) || null;
      } else if (isInstructor) {
        // Get lesson first to find its school_id and instructor_id
        const { data: lessonCheck, error: lessonCheckError } = await (
          supabaseAdmin as any
        )
          .from("lessons")
          .select("instructor_id, school_id")
          .eq("id", id)
          .single();

        if (lessonCheckError || !lessonCheck) {
          return res.status(404).json({
            success: false,
            error: "Lesson not found",
          });
        }

        if (lessonCheck.instructor_id !== userId) {
          return res.status(403).json({
            success: false,
            error: "Instructors can only view their own lessons",
          });
        }

        const {
          data: instructorSchoolAssociation,
          error: instructorSchoolAssociationError,
        } = await supabaseAdmin
          .from("instructor_schools")
          .select("school_id")
          .eq("instructor_id", userId)
          .eq("school_id", lessonCheck.school_id)
          .maybeSingle();

        if (instructorSchoolAssociationError || !instructorSchoolAssociation) {
          return res.status(403).json({
            success: false,
            error: "Instructor not associated with this lesson's school",
          });
        }

        schoolId = lessonCheck.school_id;
      } else {
        schoolId = authReq.user["schoolId"] || null;
        if (!schoolId) {
          return res.status(403).json({
            success: false,
            error: "School ID is required",
          });
        }
      }

      const lesson = await getLessonById(id, schoolId);

      return res.json({
        success: true,
        data: lesson,
        message: "Lesson retrieved successfully",
      });
    } catch (error: any) {
      if (error.statusCode === 404) {
        return res.status(404).json({
          success: false,
          error: error.message || "Lesson not found",
        });
      }
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/lessons/{id}:
 *   patch:
 *     summary: Update lesson status and payment status
 *     description: Update the lesson status and/or payment status of a lesson
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Lesson ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lesson_status_id:
 *                 type: string
 *                 format: uuid
 *                 description: Lesson status ID (optional, can be null)
 *               payment_status_id:
 *                 type: string
 *                 format: uuid
 *                 description: Payment status ID (optional, can be null)
 *           example:
 *             lesson_status_id: "123e4567-e89b-12d3-a456-426614174000"
 *             payment_status_id: "123e4567-e89b-12d3-a456-426614174001"
 *     responses:
 *       200:
 *         description: Lesson updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                 message:
 *                   type: string
 *                   example: "Lesson updated successfully"
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Lesson not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/:id",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN", "INSTRUCTOR"]),
  validate(updateLessonSchema),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const { lesson_status_id, duration, time } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: "Lesson ID is required",
        });
      }

      // Verify lesson exists and belongs to user's school
      const { data: lesson, error: lessonError } = await (supabaseAdmin as any)
        .from("lessons")
        .select(
          "id, school_id, instructor_id, booking_id, student_id, duration, lesson_status_id, status, date, time",
        )
        .eq("id", id)
        .single();

      if (lessonError || !lesson) {
        return res.status(404).json({
          success: false,
          error: "Lesson not found",
        });
      }

      const isInstructor = user.role === "INSTRUCTOR";
      if (isInstructor && lesson.instructor_id !== user.id) {
        return res.status(403).json({
          success: false,
          error: "Instructors can only modify their own lessons",
        });
      }
      if (isInstructor) {
        const canEditLessons = await canInstructorEditLessonsInSchool(
          user.id,
          lesson.school_id,
        );
        if (!canEditLessons) {
          return res.status(403).json({
            success: false,
            error: INSTRUCTOR_LESSON_EDIT_FORBIDDEN_ERROR,
          });
        }
      }
      const schoolId =
        user.role === "SUPER_ADMIN"
          ? lesson.school_id
          : isInstructor
            ? lesson.school_id
            : user.schoolId;
      if (lesson.school_id !== schoolId) {
        return res.status(403).json({
          success: false,
          error: "Access denied to this lesson",
        });
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      let wasAlreadyConfirmed = false;
      if (lesson.lesson_status_id) {
        const { data: oldStatus } = await (supabaseAdmin as any)
          .from("lesson_statuses")
          .select("name")
          .eq("id", lesson.lesson_status_id)
          .single();
        wasAlreadyConfirmed = oldStatus?.name?.toLowerCase() === "confirmed";
      } else if (lesson.status) {
        wasAlreadyConfirmed = lesson.status.toLowerCase() === "confirmed";
      }

      let isChangingToConfirmed = false;
      let isChangingFromConfirmed = false;

      if (lesson_status_id !== undefined) {
        if (lesson_status_id) {
          const { data: status, error: statusError } = await (
            supabaseAdmin as any
          )
            .from("lesson_statuses")
            .select("id, name")
            .eq("id", lesson_status_id)
            .eq("is_active", true)
            .single();

          if (statusError || !status) {
            return res.status(400).json({
              success: false,
              error: "Invalid lesson status",
            });
          }

          const newStatusName = status.name?.toLowerCase();
          isChangingToConfirmed = newStatusName === "confirmed";
          isChangingFromConfirmed =
            wasAlreadyConfirmed && !isChangingToConfirmed;

          updateData.lesson_status_id = lesson_status_id;
          if (newStatusName === "waiting") {
            updateData.status = "pending";
          } else if (newStatusName === "confirmed") {
            updateData.status = "confirmed";
          } else {
            updateData.status = "pending";
          }
        } else {
          isChangingFromConfirmed = wasAlreadyConfirmed;
          updateData.lesson_status_id = lesson_status_id;
          updateData.status = "pending";
        }
      }

      if (duration !== undefined) {
        if (duration % 15 !== 0) {
          return res.status(400).json({
            success: false,
            error:
              "Lesson duration must be in 15-minute increments (15, 30, 45, 60, ...).",
          });
        }
        if (isInstructor && duration > lesson.duration) {
          if (!lesson.booking_id || !lesson.student_id) {
            return res.status(400).json({
              success: false,
              error: NO_BOOKED_HOURS_ERROR,
            });
          }
          const { data: booking, error: bookingError } = await (supabaseAdmin as any)
            .from("bookings")
            .select("id, total_minutes, remaining_minutes, status")
            .eq("id", lesson.booking_id)
            .single();
          if (bookingError || !booking || booking.status !== "active") {
            return res.status(400).json({
              success: false,
              error: NO_BOOKED_HOURS_ERROR,
            });
          }
          const delta = duration - lesson.duration;
          if ((booking.remaining_minutes || 0) < delta) {
            return res.status(400).json({
              success: false,
              error: NO_BOOKED_HOURS_ERROR,
            });
          }
          
          const isResultingConfirmed = isChangingToConfirmed || (wasAlreadyConfirmed && !isChangingFromConfirmed);
          if (isResultingConfirmed && wasAlreadyConfirmed) {
            try {
              await deductBookingMinutes(lesson.booking_id, delta, lesson.student_id);
            } catch (error: any) {
              console.error("Failed to deduct booking minutes for instructor duration increase:", {
                booking_id: lesson.booking_id,
                student_id: lesson.student_id,
                delta,
                error: error.message
              });
              return res.status(400).json({
                success: false,
                error: NO_BOOKED_HOURS_ERROR,
              });
            }
          }
        }

        // If School Admin / Super Admin increases duration, we should also track it in the booking
        if (user.role !== "INSTRUCTOR" && duration > lesson.duration) {
          const delta = duration - lesson.duration;
          // Check if confirmed to deduct
          const isResultingConfirmed = isChangingToConfirmed || (wasAlreadyConfirmed && !isChangingFromConfirmed);
          if (isResultingConfirmed && lesson.booking_id && lesson.student_id) {
            const { data: booking, error: bookingErr } = await (supabaseAdmin as any)
              .from("bookings")
              .select("id, remaining_minutes, status")
              .eq("id", lesson.booking_id)
              .single();
            
            if (bookingErr || !booking) {
              return res.status(400).json({
                success: false,
                error: "Booking lookup failed or booking not found.",
              });
            }

            if (booking.status !== "active") {
              return res.status(400).json({
                success: false,
                error: `Cannot increase duration for an inactive booking (Status: ${booking.status}).`,
              });
            }

            if (booking.remaining_minutes < delta) {
              return res.status(400).json({
                success: false,
                error: `Insufficient hours in booking for this duration increase. Available: ${Math.floor(booking.remaining_minutes / 60)} hours, Requested increase: ${Math.floor(delta / 60)} hours.`,
              });
            }
            
            if (wasAlreadyConfirmed) {
              try {
                await deductBookingMinutes(lesson.booking_id, delta, lesson.student_id);
              } catch (error: any) {
                console.error("Failed to deduct booking minutes for admin duration increase:", {
                  booking_id: lesson.booking_id,
                  student_id: lesson.student_id,
                  delta,
                  error: error.message
                });
                return res.status(error.status || 400).json({
                  success: false,
                  error: error.message || "Failed to adjust booking minutes for duration increase.",
                });
              }
            }
          }
        }

        if (
          duration < lesson.duration &&
          lesson.booking_id &&
          lesson.student_id &&
          wasAlreadyConfirmed &&
          !isChangingFromConfirmed
        ) {
          const delta = lesson.duration - duration;
          try {
            await restoreBookingMinutes(lesson.booking_id, delta, lesson.student_id);
          } catch (error: any) {
            console.error("Failed to restore booking minutes on duration decrease:", {
              lesson_id: lesson.id,
              booking_id: lesson.booking_id,
              delta,
              error: error.message
            });
            // Stop the update if restoration fails to maintain consistency
            return res.status(500).json({
              success: false,
              error: "Failed to restore booking minutes. Lesson update aborted to maintain consistency.",
            });
          }
        }
        updateData.duration = duration;
      }

      if (time !== undefined) {
        const normalizedTime =
          time.includes(":") && time.split(":").length === 2 ? `${time}:00` : time;
        const resultingDuration = updateData.duration ?? lesson.duration;
        const timeEnd = computeTimeEnd(normalizedTime, resultingDuration);

        const instructorAvailable = await checkInstructorAvailabilitySlot(
          lesson.instructor_id,
          lesson.date,
          normalizedTime,
          timeEnd,
        );
        if (!instructorAvailable) {
          return res.status(400).json({
            success: false,
            error:
              "Instructor is not available for the requested time and duration. Please check the instructor's availability and choose a different time slot.",
          });
        }

        const overlaps = await hasInstructorLessonOverlap(
          lesson.instructor_id,
          lesson.date,
          normalizedTime,
          timeEnd,
          lesson.id,
        );
        if (overlaps) {
          return res.status(400).json({
            success: false,
            error:
              "Instructor already has a lesson scheduled at this time. Please choose a different time slot.",
          });
        }

        const { data: school, error: schoolError } = await (supabaseAdmin as any)
          .from("schools")
          .select("open_hours_end")
          .eq("id", lesson.school_id)
          .single();
        if (!schoolError && school?.open_hours_end) {
          const closingTime =
            school.open_hours_end.includes(":") &&
            school.open_hours_end.split(":").length === 2
              ? `${school.open_hours_end}:00`
              : school.open_hours_end;
          if (timeEnd > closingTime) {
            return res.status(400).json({
              success: false,
              error: `Lesson cannot extend beyond school closing time. School closes at ${school.open_hours_end}`,
            });
          }
        }

        updateData.time = normalizedTime;
      }

      if (
        isChangingToConfirmed &&
        !wasAlreadyConfirmed &&
        lesson.booking_id &&
        lesson.student_id &&
        lesson.duration
      ) {
        // Validate booking exists and has sufficient hours BEFORE updating the lesson
        const { data: booking, error: bookingError } = await (
          supabaseAdmin as any
        )
          .from("bookings")
          .select("*")
          .eq("id", lesson.booking_id)
          .single();

        if (bookingError || !booking) {
          return res.status(400).json({
            success: false,
            error: user.role === "INSTRUCTOR" ? NO_BOOKED_HOURS_ERROR : "Booking not found",
          });
        }

        // Verify the booking belongs to the student
        const { data: participant, error: participantError } = await (
          supabaseAdmin as any
        )
          .from("booking_participants")
          .select("booking_id")
          .eq("booking_id", lesson.booking_id)
          .eq("student_id", lesson.student_id)
          .single();

        if (participantError || !participant) {
          return res.status(400).json({
            success: false,
            error: "Booking does not belong to this student",
          });
        }

        if (booking.status !== "active") {
          return res.status(400).json({
            success: false,
            error: user.role === "INSTRUCTOR" ? NO_BOOKED_HOURS_ERROR : "Booking is not active",
          });
        }

        const confirmedDuration = await getConfirmedLessonsDuration(
          lesson.booking_id,
          id,
        );

        const remainingMinutes = booking.total_minutes - confirmedDuration;

        if (remainingMinutes < lesson.duration) {
          const errorMessage = user.role === "INSTRUCTOR" 
            ? NO_BOOKED_HOURS_ERROR
            : (remainingMinutes <= 0
                ? "All hours are already deducted. Cannot confirm this lesson."
                : `Insufficient hours in booking. Available: ${Math.floor(remainingMinutes / 60)} hours, Requested: ${Math.floor(lesson.duration / 60)} hours`);

          return res.status(400).json({
            success: false,
            error: errorMessage,
          });
        }
      }

      const { data: updatedLesson, error: updateError } = await (
        supabaseAdmin as any
      )
        .from("lessons")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        throw new AppError(
          `Failed to update lesson: ${updateError.message}`,
          500,
        );
      }

      // restore hours if changing from confirmed to pending
      if (
        isChangingFromConfirmed &&
        !isChangingToConfirmed &&
        lesson.booking_id &&
        lesson.student_id &&
        lesson.duration
      ) {
        try {
          await restoreBookingMinutes(
            lesson.booking_id,
            lesson.duration,
            lesson.student_id,
          );
        } catch (bookingError: any) {
          console.error(
            "Failed to restore hours from booking after lesson status update:",
            bookingError,
          );
        }
      }

      // Deduct hours if changing to confirmed
      if (
        isChangingToConfirmed &&
        !wasAlreadyConfirmed &&
        lesson.booking_id &&
        lesson.student_id
      ) {
        try {
          const minutesToDeduct = updateData.duration || lesson.duration;
          await deductBookingMinutes(
            lesson.booking_id,
            minutesToDeduct,
            lesson.student_id,
          );
        } catch (bookingError: any) {
          console.error(
            "Failed to deduct hours from booking after lesson status update:",
            bookingError,
          );
          // Propagate error if deduction fails during confirmation
          return res.status(500).json({
            success: false,
            error: "Failed to deduct hours from booking during confirmation.",
            details: bookingError.message
          });
        }
      }

      return res.json({
        success: true,
        data: updatedLesson,
        message: "Lesson updated successfully",
      });
    } catch (error: any) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/lessons/{id}:
 *   delete:
 *     summary: delete a lesson
 *     tags: [Lessons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Lesson deleted
 */
router.delete(
  "/:id",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      if (!id) {
        return res
          .status(400)
          .json({ success: false, error: "Lesson ID is required" });
      }

      // fetch lesson details before deletion to check date/time and restore hours if needed
      const { data: lesson, error: lessonError } = await (supabaseAdmin as any)
        .from("lessons")
        .select(
          "id, booking_id, student_id, duration, lesson_status_id, status, date, time",
        )
        .eq("id", id)
        .single();

      if (lessonError || !lesson) {
        return res.status(404).json({
          success: false,
          error: "Lesson not found",
        });
      }

      if (isLessonInPast(lesson.date, lesson.time)) {
        return res.status(400).json({
          success: false,
          error:
            "Cannot delete past lessons. Only future lessons can be deleted.",
        });
      }

      let isConfirmed = false;
      if (lesson.lesson_status_id) {
        const { data: statusData } = await (supabaseAdmin as any)
          .from("lesson_statuses")
          .select("name")
          .eq("id", lesson.lesson_status_id)
          .single();

        if (statusData && statusData.name?.toLowerCase() === "confirmed") {
          isConfirmed = true;
        }
      } else if (lesson.status && lesson.status.toLowerCase() === "confirmed") {
        isConfirmed = true;
      }

      if (
        isConfirmed &&
        lesson.booking_id &&
        lesson.student_id &&
        lesson.duration
      ) {
        try {
          await restoreBookingMinutes(
            lesson.booking_id,
            lesson.duration,
            lesson.student_id,
          );
        } catch (bookingError: any) {
          console.error(
            "Failed to restore hours from booking after lesson deletion:",
            bookingError,
          );
        }
      }

      const { error: participantsError } = await supabaseAdmin
        .from("lesson_participants")
        .delete()
        .eq("lesson_id", id);
      if (participantsError) {
        console.warn(
          "Failed to delete lesson participants:",
          participantsError.message,
        );
      }

      const { error } = await supabaseAdmin
        .from("lessons")
        .delete()
        .eq("id", id);
      if (error) {
        throw new Error(`Failed to delete lesson: ${error.message}`);
      }

      return res.json({
        success: true,
        data: { id },
        message: "Lesson deleted",
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
