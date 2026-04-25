/**
 * @fileoverview School management routes for Ridesk Server
 * @description Handles school CRUD operations and multi-school data separation
 * @author Ridesk Team
 * @version 1.0.0
 */

import { Router } from "express";
import {
  createSchool,
  getSchoolById,
  getSchoolBySlug,
  getSchoolByUserId,
  getAllSchools,
  updateSchool,
  deactivateSchool,
  searchSchools,
} from "../services/schools";
import {
  createSchoolSchema,
  updateSchoolSchema,
  paginationSchema,
  searchSchema,
} from "../middleware/validation";
import { AppError, AuthenticatedRequest } from "../types";
import { validate } from "../middleware/validation";
import {
  authenticate,
  authorizeRoles,
  authorizeSchoolAccess,
} from "../middleware/auth";

const router = Router();

/**
 * @swagger
 * /api/schools:
 *   post:
 *     summary: Create a new school
 *     description: Create a new school with the provided information. SUPER_ADMIN can create any school, SCHOOL_ADMIN can create their own school.
 *     tags: [Schools]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSchoolRequest'
 *           example:
 *             name: "Ridesk Kitesurf School"
 *             slug: "ridesks-kitesurf-school"
 *             logo: "https://example.com/logo.png"
 *             email: "info@ridesks.com"
 *             phone: "+39 123 456 7890"
 *             address: "Via del Mare 123, 00100 Roma, Italy"
 *             spotName: "Fregene Beach"
 *             windguruUrl: "https://www.windguru.cz/station/123"
 *             disciplines: ["kite", "surf"]
 *             openHoursStart: "09:00"
 *             openHoursEnd: "18:00"
 *     responses:
 *       201:
 *         description: School created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/School'
 *             example:
 *               success: true
 *               message: "School created successfully"
 *               data:
 *                 id: "123e4567-e89b-12d3-a456-426614174000"
 *                 name: "Ridesk Kitesurf School"
 *                 slug: "ridesks-kitesurf-school"
 *                 logo: "https://example.com/logo.png"
 *                 email: "info@ridesks.com"
 *                 phone: "+39 123 456 7890"
 *                 address: "Via del Mare 123, 00100 Roma, Italy"
 *                 spotName: "Fregene Beach"
 *                 windguruUrl: "https://www.windguru.cz/station/123"
 *                 disciplines: ["kite", "surf"]
 *                 openHoursStart: "09:00"
 *                 openHoursEnd: "18:00"
 *                 isActive: true
 *                 createdAt: "2024-01-01T00:00:00.000Z"
 *                 updatedAt: "2024-01-01T00:00:00.000Z"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         $ref: '#/components/responses/ConflictError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/",
  authenticate,
  authorizeRoles(["SUPER_ADMIN", "SCHOOL_ADMIN"]),
  validate(createSchoolSchema),
  async (req, res, next) => {
    try {
      const schoolData = req.body;
      const user = (req as unknown as AuthenticatedRequest).user; // Get the authenticated user

      const school = await createSchool(schoolData);

      // If the user is a SCHOOL_ADMIN, automatically assign the school to them
      if (user.role === "SCHOOL_ADMIN") {
        const { updateUserSchool } = await import("../services/auth");
        await updateUserSchool(user.id, school.id);
      }

      res.status(201).json({
        success: true,
        data: school,
        message: "School created successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/schools:
 *   get:
 *     summary: Get all schools (paginated)
 *     description: Retrieve a paginated list of all schools. Only SUPER_ADMIN can access this endpoint.
 *     tags: [Schools]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of schools per page
 *     responses:
 *       200:
 *         description: Schools retrieved successfully
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
 *                         $ref: '#/components/schemas/School'
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationMeta'
 *             example:
 *               success: true
 *               message: "Schools retrieved successfully"
 *               data:
 *                 - id: "123e4567-e89b-12d3-a456-426614174000"
 *                   name: "Ridesk Kitesurf School"
 *                   slug: "ridesks-kitesurf-school"
 *                   logo: "https://example.com/logo.png"
 *                   email: "info@ridesks.com"
 *                   phone: "+39 123 456 7890"
 *                   address: "Via del Mare 123, 00100 Roma, Italy"
 *                   spotName: "Fregene Beach"
 *                   windguruUrl: "https://www.windguru.cz/station/123"
 *                   disciplines: ["kite", "surf"]
 *                   openHoursStart: "09:00"
 *                   openHoursEnd: "18:00"
 *                   isActive: true
 *                   createdAt: "2024-01-01T00:00:00.000Z"
 *                   updatedAt: "2024-01-01T00:00:00.000Z"
 *               pagination:
 *                 page: 1
 *                 limit: 10
 *                 total: 1
 *                 totalPages: 1
 *                 hasNext: false
 *                 hasPrev: false
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/",
  authenticate,
  authorizeRoles(["SUPER_ADMIN"]),
  validate(paginationSchema, "query"),
  async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const result = await getAllSchools(Number(page), Number(limit));

      res.json({
        success: true,
        data: result.schools,
        pagination: result.pagination,
        message: "Schools retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/schools/search:
 *   get:
 *     summary: Search schools
 *     description: Search schools by name or slug. Only SUPER_ADMIN can access this endpoint.
 *     tags: [Schools]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (school name or slug)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of schools per page
 *     responses:
 *       200:
 *         description: Schools found successfully
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
 *                         $ref: '#/components/schemas/School'
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/search",
  authenticate,
  authorizeRoles(["SUPER_ADMIN"]),
  validate(searchSchema, "query"),
  async (req, res, next) => {
    try {
      const { query, page, limit } = req.query;
      const result = await searchSchools(
        query as string,
        Number(page),
        Number(limit),
      );

      res.json({
        success: true,
        data: result.schools,
        pagination: result.pagination,
        message: "Search results retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/schools/{id}:
 *   get:
 *     summary: Get school by ID
 *     description: Retrieve a specific school by its ID. SUPER_ADMIN can access any school, school members can only access their own school.
 *     tags: [Schools]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID
 *     responses:
 *       200:
 *         description: School retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/School'
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
  "/:id",
  authenticate,
  authorizeSchoolAccess,
  async (req, res, next) => {
    try {
      const id = req.params["id"];
      if (!id) {
        throw new AppError("School ID is required", 400);
      }
      const school = await getSchoolById(id);

      res.json({
        success: true,
        data: school,
        message: "School retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/schools/user/{userId}:
 *   get:
 *     summary: Get school by user ID
 *     description: Retrieve a school associated with a specific user. Returns null if user has no school.
 *     tags: [Schools]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: School retrieved successfully or null if user has no school
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/School'
 *                     - type: null
 *                 message:
 *                   type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
/**
 * @swagger
 * /api/schools/user/{userId}:
 *   get:
 *     summary: Get school by user ID
 *     description: Retrieve a school associated with a specific user. Returns null if user has no school.
 *     tags: [Schools]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: School retrieved successfully or null if user has no school
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/School'
 *                     - type: null
 *                 message:
 *                   type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/user/:userId", authenticate, async (req, res, next) => {
  try {
    const userId = req.params["userId"];
    if (!userId) {
      throw new AppError("User ID is required", 400);
    }

    // Users can only access their own school data
    const authReq = req as unknown as AuthenticatedRequest;
    if (authReq.user.id !== userId && authReq.user.role !== "SUPER_ADMIN") {
      throw new AppError("Access denied", 403);
    }

    const school = await getSchoolByUserId(userId);

    res.json({
      success: true,
      data: school,
      message: school ? "School retrieved successfully" : "User has no school",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/schools/slug/{slug}:
 *   get:
 *     summary: Get school by slug
 *     description: Retrieve a school by its slug. This is a public endpoint for displaying school information on public pages.
 *     tags: [Schools]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: School slug
 *     responses:
 *       200:
 *         description: School retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/School'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/slug/:slug", async (req, res, next) => {
  try {
    const slug = req.params["slug"];
    const school = await getSchoolBySlug(slug);

    res.json({
      success: true,
      data: school,
      message: "School retrieved successfully",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/schools/{id}:
 *   put:
 *     summary: Update school
 *     description: Update school information. SUPER_ADMIN can update any school, SCHOOL_ADMIN can only update their own school.
 *     tags: [Schools]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *             $ref: '#/components/schemas/UpdateSchoolRequest'
 *     responses:
 *       200:
 *         description: School updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/School'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         $ref: '#/components/responses/ConflictError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  authenticate,
  authorizeSchoolAccess,
  validate(updateSchoolSchema),
  async (req, res, next) => {
    try {
      const id = req.params["id"];
      if (!id) {
        throw new AppError("School ID is required", 400);
      }
      const schoolData = { ...req.body, id };
      const school = await updateSchool(schoolData);

      res.json({
        success: true,
        data: school,
        message: "School updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/schools/{id}:
 *   delete:
 *     summary: Deactivate school
 *     description: Deactivate a school (soft delete). Only SUPER_ADMIN can deactivate schools.
 *     tags: [Schools]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID
 *     responses:
 *       200:
 *         description: School deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/School'
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
  "/:id",
  authenticate,
  authorizeRoles(["SUPER_ADMIN"]),
  async (req, res, next) => {
    try {
      const id = req.params["id"];
      if (!id) {
        throw new AppError("School ID is required", 400);
      }
      const result = await deactivateSchool(id);

      res.json({
        success: true,
        data: result,
        message: "School deactivated successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
