// Compensation routes for instructor earnings

import { Router } from "express";
import {
  getInstructorRates,
  createInstructorRate,
  updateInstructorRate,
  deleteInstructorRate,
  calculateCompensation,
  getCompensationReport,
  calculateLessonCompensation,
  getInstructorMissingRatesCount,
  getLessonCompensationBreakdown,
  markLessonCompensationPaid,
  bulkMarkLessonsCompensationPaid,
} from "../services/compensation";
import { authenticate, authorizeRoles } from "../middleware/auth";
import { validate } from "../middleware/validation";
import Joi from "joi";
import { AuthenticatedRequest, AuthUser, ALL_SCHOOLS_ID } from "../types";
import { canViewCompensations } from "../services/permissions";
import { resolveInstructorSchoolId, isInstructorInSchool } from "../utils/instructorUtils";

const router = Router();

/**
 * Resolves schoolId based on user role and available parameters
 * @param user - Authenticated user
 * @param querySchoolId - Optional schoolId from query parameters
 * @param authReqSchoolId - Optional schoolId from AuthenticatedRequest
 * @returns Object with schoolId or error message
 */
async function resolveSchoolId(
  user: AuthUser,
  querySchoolId?: string,
  authReqSchoolId?: string
): Promise<{ schoolId: string } | { error: string }> {
  if (user.role === "SUPER_ADMIN") {
    if (!querySchoolId) {
      return { error: "schoolId query parameter is required" };
    }
    return { schoolId: querySchoolId };
  } else if (user.role === "INSTRUCTOR") {
    // For INSTRUCTOR, if a specific school is requested, verify they belong to it
    if (querySchoolId) {
      if (querySchoolId === ALL_SCHOOLS_ID) {
        return { schoolId: ALL_SCHOOLS_ID };
      }
      const belongs = await isInstructorInSchool(user.id, querySchoolId);
      if (belongs) {
        return { schoolId: querySchoolId };
      }
      return { error: "You are not associated with this school" };
    }

    // Default: get their primary school
    const schoolId = await resolveInstructorSchoolId(user.id);
    if (!schoolId) {
      return { error: "Instructor not associated with any school" };
    }
    return { schoolId };
  } else {
    const userSchoolId = authReqSchoolId || user['schoolId'];
    if (!userSchoolId) {
      return { error: "User is not associated with a school" };
    }
    return { schoolId: userSchoolId };
  }
}

const createRateSchema = Joi.object({
  instructor_id: Joi.string().uuid().required(),
  category_id: Joi.string().uuid().required(),
  rate_type: Joi.string().valid("hourly").required(),
  rate_value: Joi.number().min(0).required(),
  is_active: Joi.boolean().optional(),
});

const updateRateSchema = Joi.object({
  category_id: Joi.string().uuid().optional(),
  rate_type: Joi.string().valid("hourly").optional(),
  rate_value: Joi.number().min(0).optional(),
  is_active: Joi.boolean().optional(),
});

const calculateSchema = Joi.object({
  instructorId: Joi.string().uuid().required(),
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().required(),
  schoolId: Joi.string().optional(),
});

const reportSchema = Joi.object({
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().required(),
  schoolId: Joi.string().optional(),
});

const markPaidSchema = Joi.object({
  paid: Joi.boolean().required(),
});

const bulkMarkPaidSchema = Joi.object({
  lessonIds: Joi.array().items(Joi.string().uuid()).min(1).max(500).required(),
});

const lessonIdParamSchema = Joi.object({
  lessonId: Joi.string().uuid().required(),
});

/**
 * @swagger
 * /api/compensation/instructor/{instructorId}:
 *   get:
 *     summary: Get instructor rates
 *     description: Get all active rates for a specific instructor
 *     tags: [Compensation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instructorId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Instructor ID
 *       - in: query
 *         name: schoolId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Optional school ID for verification
 *     responses:
 *       200:
 *         description: Instructor rates retrieved successfully
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
 *                           instructor_id:
 *                             type: string
 *                           discipline:
 *                             type: string
 *                           rate_type:
 *                             type: string
 *                           rate_value:
 *                             type: number
 *                           is_active:
 *                             type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/instructor/:instructorId",
  authenticate,
  async (req, res, next) => {
    try {
      const { instructorId } = req.params;
      const { schoolId } = req.query as { schoolId?: string };
      const user = (req as unknown as AuthenticatedRequest).user;

      if (user.role === "INSTRUCTOR" && user.id !== instructorId) {
        return res.status(403).json({
          success: false,
          error: "You can only view your own rates",
        });
      }

      // Get schoolId (required now)
      const authReq = req as unknown as AuthenticatedRequest;
      const result = await resolveSchoolId(user, schoolId, authReq.schoolId);
      if ('error' in result) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }
      const effectiveSchoolId = result.schoolId;

      const userSchoolId = user.role === 'INSTRUCTOR' ? effectiveSchoolId : (user['schoolId'] ?? undefined);
      
      if (!canViewCompensations(user.role, userSchoolId, effectiveSchoolId)) {
        return res.status(403).json({
          success: false,
          error: "You do not have permission to view compensations",
        });
      }

      // @ts-expect-error - effectiveSchoolId is guaranteed to be string after validation above
      const rates = await getInstructorRates(instructorId, effectiveSchoolId);

      return res.status(200).json({
        success: true,
        data: rates,
      });
    } catch (error: any) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/compensation/rates:
 *   post:
 *     summary: Create instructor rate
 *     description: Create a new rate for an instructor
 *     tags: [Compensation]
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
 *               - discipline
 *               - rate_type
 *               - rate_value
 *             properties:
 *               instructor_id:
 *                 type: string
 *                 format: uuid
 *               discipline:
 *                 type: string
 *                 enum: [kite, surf, wing]
 *               rate_type:
 *                 type: string
 *                 enum: [hourly]
 *               rate_value:
 *                 type: number
 *                 minimum: 0
 *               is_active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Rate created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: Rate already exists for this instructor and discipline
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/rates",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  validate(createRateSchema),
  async (req, res, next) => {
    try {
      const rateData = req.body;
      const user = (req as unknown as AuthenticatedRequest).user;
      const authReq = req as unknown as AuthenticatedRequest;

      // Get schoolId and add to rateData
      const { schoolId: querySchoolId } = req.query as { schoolId?: string };
      const result = await resolveSchoolId(user, querySchoolId, authReq.schoolId);
      if ('error' in result) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }
      const schoolId = result.schoolId;

      // Include school_id in rateData
      const rate = await createInstructorRate(
        { ...rateData, school_id: schoolId },
        schoolId
      );

      return res.status(201).json({
        success: true,
        data: rate,
        message: "Instructor rate created successfully",
      });
    } catch (error: any) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/compensation/rates/{id}:
 *   put:
 *     summary: Update instructor rate
 *     description: Update an existing instructor rate
 *     tags: [Compensation]
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
 *             properties:
 *               discipline:
 *                 type: string
 *                 enum: [kite, surf, wing]
 *               rate_type:
 *                 type: string
 *                 enum: [hourly]
 *               rate_value:
 *                 type: number
 *                 minimum: 0
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Rate updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/rates/:id",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  validate(updateRateSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const user = (req as unknown as AuthenticatedRequest).user;
      const authReq = req as unknown as AuthenticatedRequest;

      // Get schoolId (required now)
      const { schoolId: querySchoolId } = req.query as { schoolId?: string };
      const result = await resolveSchoolId(user, querySchoolId, authReq.schoolId);
      if ('error' in result) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }
      const schoolId = result.schoolId;

      // @ts-expect-error - schoolId is guaranteed to be string after validation above
      const rate = await updateInstructorRate(id, updates, schoolId);

      return res.status(200).json({
        success: true,
        data: rate,
        message: "Instructor rate updated successfully",
      });
    } catch (error: any) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/compensation/rates/{id}:
 *   delete:
 *     summary: Delete instructor rate
 *     description: Soft delete an instructor rate by setting is_active to false
 *     tags: [Compensation]
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
 *         description: Rate deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  "/rates/:id",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const user = (req as unknown as AuthenticatedRequest).user;
      const authReq = req as unknown as AuthenticatedRequest;

      // Get schoolId (required now)
      const { schoolId: querySchoolId } = req.query as { schoolId?: string };
      const result = await resolveSchoolId(user, querySchoolId, authReq.schoolId);
      if ('error' in result) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }
      const schoolId = result.schoolId;

      // @ts-expect-error - schoolId is guaranteed to be string after validation above
      await deleteInstructorRate(id, schoolId);

      return res.status(200).json({
        success: true,
        message: "Instructor rate deleted successfully",
      });
    } catch (error: any) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/compensation/calculate:
 *   get:
 *     summary: Calculate instructor compensation
 *     description: Calculate compensation for an instructor over a date range
 *     tags: [Compensation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instructorId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *         name: schoolId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Compensation calculated successfully
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
 *                         instructorId:
 *                           type: string
 *                         instructorName:
 *                           type: string
 *                         totalCompensation:
 *                           type: number
 *                         totalHours:
 *                           type: number
 *                         lessonCount:
 *                           type: integer
 *                         lessons:
 *                           type: array
 *                           items:
 *                             type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/calculate",
  authenticate,
  validate(calculateSchema, "query"),
  async (req, res, next) => {
    try {
      const { instructorId, startDate, endDate, schoolId: querySchoolId } = req.query as {
        instructorId: string;
        startDate: string;
        endDate: string;
        schoolId?: string;
      };

      console.log(`[Compensation] Calculate route called:`, { instructorId, startDate, endDate, querySchoolId });

      const user = (req as unknown as AuthenticatedRequest).user;

      if (user.role === "INSTRUCTOR" && user.id !== instructorId) {
        return res.status(403).json({
          success: false,
          error: "You can only view your own compensation",
        });
      }

      // Get schoolId (required now)
      const authReq = req as unknown as AuthenticatedRequest;
      const result = await resolveSchoolId(user, querySchoolId, authReq.schoolId);
      if ('error' in result) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }
      const effectiveSchoolId = result.schoolId;

      const userSchoolId = user.role === 'INSTRUCTOR' ? effectiveSchoolId : (user['schoolId'] ?? undefined);

      if (!canViewCompensations(user.role, userSchoolId, effectiveSchoolId)) {
        return res.status(403).json({
          success: false,
          error: "You do not have permission to view compensations",
        });
      }

      const summary = await calculateCompensation(
        instructorId,
        startDate,
        endDate,
        effectiveSchoolId,
      );

      return res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/compensation/report:
 *   get:
 *     summary: Get compensation report
 *     description: Get compensation report for all instructors in a school over a date range
 *     tags: [Compensation]
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
 *         name: schoolId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Report generated successfully
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
 *                         instructorSummaries:
 *                           type: array
 *                           items:
 *                             type: object
 *                         stats:
 *                           type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/report",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  validate(reportSchema, "query"),
  async (req, res, next) => {
    try {
      const { startDate, endDate, schoolId: querySchoolId } = req.query as {
        startDate: string;
        endDate: string;
        schoolId?: string;
      };
      const user = (req as unknown as AuthenticatedRequest).user;

      const userSchoolId = user['schoolId'] ?? undefined;
      const targetSchoolId = (querySchoolId as string) || userSchoolId || '';
      if (!canViewCompensations(user.role, userSchoolId, targetSchoolId)) {
        return res.status(403).json({
          success: false,
          error: "You do not have permission to view compensations",
        });
      }

      let schoolId: string | undefined;
      if (user.role === "SUPER_ADMIN" && querySchoolId) {
        schoolId = querySchoolId as string;
      } else if (user.role === "SCHOOL_ADMIN") {
        schoolId = userSchoolId;
      }

      if (!schoolId) {
        return res.status(400).json({
          success: false,
          error: "School ID is required",
        });
      }

      const report = await getCompensationReport(schoolId, startDate, endDate);

      return res.status(200).json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/compensation/lesson:
 *   get:
 *     summary: Calculate compensation for a single lesson
 *     description: Calculate compensation amount for a specific lesson
 *     tags: [Compensation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instructorId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: duration
 *         required: true
 *         schema:
 *           type: number
 *         description: Duration in hours
 *     responses:
 *       200:
 *         description: Compensation calculated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: number
 *                       nullable: true
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/lesson",
  authenticate,
  async (req, res, next) => {
    try {
      const { instructorId, categoryId, duration, schoolId: querySchoolId } = req.query as {
        instructorId: string;
        categoryId: string;
        duration: string;
        schoolId?: string;
      };
      const user = (req as unknown as AuthenticatedRequest).user;

      if (!instructorId || !categoryId || !duration) {
        return res.status(400).json({
          success: false,
          error: "instructorId, categoryId, and duration are required",
        });
      }

      const durationHours = parseFloat(duration);
      if (isNaN(durationHours) || durationHours <= 0) {
        return res.status(400).json({
          success: false,
          error: "duration must be a positive number",
        });
      }

      // Get schoolId (required now)
      const authReq = req as unknown as AuthenticatedRequest;
      const result = await resolveSchoolId(user, querySchoolId, authReq.schoolId);
      if ('error' in result) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }
      const schoolId = result.schoolId;

      const compensation = await calculateLessonCompensation(
        instructorId,
        categoryId,
        durationHours,
        schoolId,
      );

      return res.status(200).json({
        success: true,
        data: compensation,
      });
    } catch (error: any) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/compensation/lesson/breakdown:
 *   get:
 *     summary: Get detailed compensation breakdown for a lesson
 *     description: Get detailed breakdown including rate, product, category, and calculation details
 *     tags: [Compensation]
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
 *       - in: query
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Category ID
 *       - in: query
 *         name: duration
 *         required: true
 *         schema:
 *           type: number
 *         description: Duration in hours
 *       - in: query
 *         name: productId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID (optional)
 *       - in: query
 *         name: productName
 *         schema:
 *           type: string
 *         description: Product name (optional)
 *     responses:
 *       200:
 *         description: Breakdown retrieved successfully
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
 *                         amount:
 *                           type: number
 *                         hourlyRate:
 *                           type: number
 *                         hours:
 *                           type: number
 *                         rateType:
 *                           type: string
 *                         formula:
 *                           type: string
 *                         instructorId:
 *                           type: string
 *                         productId:
 *                           type: string
 *                         productName:
 *                           type: string
 *                         categoryId:
 *                           type: string
 *                         categoryName:
 *                           type: string
 *                         rateId:
 *                           type: string
 *                         isVisible:
 *                           type: boolean
 *                         isCalculated:
 *                           type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/lesson/breakdown",
  authenticate,
  async (req, res, next) => {
    try {
      const { instructorId, categoryId, duration, productId, productName, schoolId: querySchoolId } = req.query as {
        instructorId: string;
        categoryId: string;
        duration: string;
        productId?: string;
        productName?: string;
        schoolId?: string;
      };
      const user = (req as unknown as AuthenticatedRequest).user;

      if (!instructorId || !categoryId || !duration) {
        return res.status(400).json({
          success: false,
          error: "instructorId, categoryId, and duration are required",
        });
      }

      const durationHours = parseFloat(duration);
      if (isNaN(durationHours) || durationHours <= 0) {
        return res.status(400).json({
          success: false,
          error: "duration must be a positive number",
        });
      }

      // Get schoolId (required now)
      const authReq = req as unknown as AuthenticatedRequest;
      const result = await resolveSchoolId(user, querySchoolId, authReq.schoolId);
      if ('error' in result) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }
      const schoolId = result.schoolId;

      const breakdown = await getLessonCompensationBreakdown(
        instructorId,
        categoryId,
        durationHours,
        schoolId,
        productId,
        productName,
      );

      return res.status(200).json({
        success: true,
        data: breakdown,
      });
    } catch (error: any) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/compensation/instructor/{instructorId}/missing-rates:
 *   get:
 *     summary: Get count of missing rates for an instructor
 *     description: Get the number of categories without configured rates for an instructor
 *     tags: [Compensation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instructorId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Instructor ID
 *       - in: query
 *         name: schoolId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID
 *     responses:
 *       200:
 *         description: Missing rates count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: number
 *                       example: 5
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
  "/instructor/:instructorId/missing-rates",
  authenticate,
  authorizeRoles(["SUPER_ADMIN", "SCHOOL_ADMIN"]),
  async (req, res, next) => {
    try {
      const { instructorId } = req.params;
      const { schoolId } = req.query;
      const user = (req as unknown as AuthenticatedRequest).user;

      if (!instructorId || typeof instructorId !== 'string') {
        return res.status(400).json({
          success: false,
          error: "instructorId is required",
        });
      }

      if (!schoolId || typeof schoolId !== 'string') {
        return res.status(400).json({
          success: false,
          error: "schoolId is required",
        });
      }

      const userSchoolId = user['schoolId'] ?? undefined;
      const validatedSchoolId: string = schoolId as string;
      let effectiveSchoolId: string;
      if (user.role === "SUPER_ADMIN") {
        effectiveSchoolId = validatedSchoolId;
      } else {
        const resolvedId = userSchoolId || validatedSchoolId;
        if (!resolvedId) {
          return res.status(400).json({
            success: false,
            error: "schoolId is required",
          });
        }
        effectiveSchoolId = resolvedId;
      }

      const missingCount = await getInstructorMissingRatesCount(
        instructorId,
        effectiveSchoolId,
      );

      return res.json({
        success: true,
        data: missingCount,
        message: "Missing rates count retrieved successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/compensation/lesson/{lessonId}/paid:
 *   patch:
 *     summary: Mark lesson compensation as paid/unpaid
 *     description: Update the compensation paid status for a single lesson
 *     tags: [Compensation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
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
 *             required:
 *               - paid
 *             properties:
 *               paid:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Lesson compensation status updated successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.patch(
  "/lesson/:lessonId/paid",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  validate(lessonIdParamSchema, "params"),
  validate(markPaidSchema),
  async (req, res, next) => {
    try {
      const { lessonId } = req.params as { lessonId: string };
      const { paid } = req.body;
      const user = (req as unknown as AuthenticatedRequest).user;

      await markLessonCompensationPaid(
        lessonId,
        paid,
        user.id,
        String(user.role),
        user.schoolId ? String(user.schoolId) : undefined,
      );

      return res.status(200).json({
        success: true,
        data: { lessonId, compensationPaid: paid },
        message: `Lesson marked as ${paid ? "paid" : "unpaid"}`,
      });
    } catch (error: any) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/compensation/lessons/bulk-mark-paid:
 *   post:
 *     summary: Bulk mark lessons compensation as paid
 *     description: Mark multiple lessons' compensation as paid at once
 *     tags: [Compensation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - lessonIds
 *             properties:
 *               lessonIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       200:
 *         description: Lessons marked as paid successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post(
  "/lessons/bulk-mark-paid",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  validate(bulkMarkPaidSchema),
  async (req, res, next) => {
    try {
      const { lessonIds } = req.body;
      const user = (req as unknown as AuthenticatedRequest).user;

      const updatedCount = await bulkMarkLessonsCompensationPaid(
        lessonIds,
        user.id,
        String(user.role),
        user.schoolId ? String(user.schoolId) : undefined,
      );

      return res.status(200).json({
        success: true,
        data: { updatedCount },
        message: `Marked ${updatedCount} lesson(s) as paid`,
      });
    } catch (error: any) {
      return next(error);
    }
  },
);

export default router;

