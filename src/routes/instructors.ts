/**
 * @fileoverview Instructor management routes for Ridesk Server
 * @description Handles instructor CRUD operations for school admins
 * @author Ridesk Team
 * @version 1.0.0
 */

import { Router } from "express";
import {
  getInstructorById,
  getAllInstructors,
  updateInstructor,
  deleteInstructor,
  searchInstructors,
  createInstructorBySchoolAdmin,
  getInstructorStats,
} from "../services/instructors";
import { supabaseAdmin } from "../database/supabase";
import { AppError } from "../types";
import {
  createInstructorSchema,
  createInstructorBySchoolAdminSchema,
  updateInstructorSchema,
  paginationSchema,
  searchSchema,
} from "../middleware/validation";
import { AuthenticatedRequest } from "../types";
import { validate } from "../middleware/validation";
import { authenticate, authorizeRoles } from "../middleware/auth";

const router = Router();

/**
 * @swagger
 * /api/instructors:
 *   post:
 *     summary: Create a new instructor
 *     description: Create a new instructor for the authenticated school admin's school
 *     tags: [Instructors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateInstructorRequest'
 *     responses:
 *       201:
 *         description: Instructor created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Instructor'
 *                     message:
 *                       type: string
 *                       example: "Instructor created successfully"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  validate(createInstructorSchema),
  async (req, res, next) => {
    try {
      const instructorData = req.body;
      const { schoolId: querySchoolId } = req.query as { schoolId?: string };
      const user = (req as unknown as AuthenticatedRequest).user;

      let targetSchoolId: string | undefined;
      if (user.role === "SUPER_ADMIN" && querySchoolId) {
        targetSchoolId = querySchoolId;
      } else if (user.role === "SCHOOL_ADMIN") {
        targetSchoolId = user.schoolId ?? undefined;
      }

      if (!targetSchoolId) {
        return res.status(403).json({
          success: false,
          error: "School ID is required",
        });
      }
      // Use the multi-school compatible function
      const result = await createInstructorBySchoolAdmin(
        instructorData,
        targetSchoolId,
        user.id,
        `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Admin",
      );

      return res.status(201).json({
        success: true,
        data: result.instructor,
        message: result.message || "Instructor created successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/instructors:
 *   get:
 *     summary: Get all instructors for a school
 *     description: Get paginated list of instructors for the authenticated school admin's school
 *     tags: [Instructors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *           maximum: 1000
 *           default: 10
 *         description: Number of instructors per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering instructors
 *     responses:
 *       200:
 *         description: Instructors retrieved successfully
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
 *                         $ref: '#/components/schemas/Instructor'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                     message:
 *                       type: string
 *                       example: "Instructors retrieved successfully"
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
  validate(paginationSchema, "query"),
  async (req, res, next) => {
    try {
      const { page, limit, search, schoolId: querySchoolId } = req.query;
      const user = (req as unknown as AuthenticatedRequest).user;

      let targetSchoolId: string | undefined;
      if (user.role === "SUPER_ADMIN" && querySchoolId) {
        targetSchoolId = querySchoolId as string;
      } else if (user.role === "SCHOOL_ADMIN") {
        targetSchoolId = user.schoolId ?? undefined;
      }

      if (!targetSchoolId) {
        return res.status(403).json({
          success: false,
          error: "School ID is required",
        });
      }

      const result = await getAllInstructors(
        targetSchoolId,
        Number(page),
        Number(limit),
        search as string,
      );

      return res.json({
        success: true,
        data: {
          instructors: result.instructors,
          pagination: result.pagination,
        },
        message: "Instructors retrieved successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/instructors/search:
 *   get:
 *     summary: Search instructors
 *     description: Search instructors within the authenticated school admin's school
 *     tags: [Instructors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
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
 *                         $ref: '#/components/schemas/Instructor'
 *                     message:
 *                       type: string
 *                       example: "Search results retrieved successfully"
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
  "/search",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN"]),
  validate(searchSchema, "query"),
  async (req, res, next) => {
    try {
      const { q } = req.query;
      const user = (req as unknown as AuthenticatedRequest).user;

      if (!user.schoolId) {
        return res.status(403).json({
          success: false,
          error: "User not associated with any school",
        });
      }

      const instructors = await searchInstructors(user.schoolId, q as string);

      return res.json({
        success: true,
        data: instructors,
        message: "Search results retrieved successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/instructors/stats:
 *   get:
 *     summary: Get instructor statistics for a school
 *     description: Returns count of active and total instructors for the school
 *     tags: [Instructors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: schoolId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID (required for SUPER_ADMIN, optional for SCHOOL_ADMIN)
 *     responses:
 *       200:
 *         description: Instructor statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     activeCount:
 *                       type: integer
 *                       description: Number of active instructors
 *                     totalCount:
 *                       type: integer
 *                       description: Total number of instructors
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/stats",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  async (req, res, next) => {
    try {
      const { schoolId: querySchoolId } = req.query as { schoolId?: string };
      const user = (req as unknown as AuthenticatedRequest).user;

      let targetSchoolId: string | undefined;
      if (user.role === "SUPER_ADMIN" && querySchoolId) {
        targetSchoolId = querySchoolId;
      } else if (user.role === "SCHOOL_ADMIN") {
        targetSchoolId = user.schoolId ?? undefined;
      }

      if (!targetSchoolId) {
        return res.status(403).json({
          success: false,
          error: "School ID is required",
        });
      }

      const stats = await getInstructorStats(targetSchoolId);
      return res.json({ success: true, data: stats });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/instructors/{id}:
 *   get:
 *     summary: Get instructor by ID
 *     description: Get a specific instructor by ID (must belong to the authenticated school admin's school)
 *     tags: [Instructors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Instructor ID
 *     responses:
 *       200:
 *         description: Instructor retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Instructor'
 *                     message:
 *                       type: string
 *                       example: "Instructor retrieved successfully"
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
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { schoolId: querySchoolId } = req.query as { schoolId?: string };
      const user = (req as unknown as AuthenticatedRequest).user;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: "Instructor ID is required",
        });
      }

      let targetSchoolId: string | undefined;
      if (user.role === "SUPER_ADMIN" && querySchoolId) {
        targetSchoolId = querySchoolId;
      } else if (user.role === "SCHOOL_ADMIN") {
        targetSchoolId = user.schoolId ?? undefined;
      }

      if (!targetSchoolId) {
        return res.status(403).json({
          success: false,
          error: "School ID is required",
        });
      }
      const instructor = await getInstructorById(id, targetSchoolId);

      return res.json({
        success: true,
        data: instructor,
        message: "Instructor retrieved successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/instructors/{id}:
 *   put:
 *     summary: Update instructor
 *     description: Update an instructor (must belong to the authenticated school admin's school)
 *     tags: [Instructors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Instructor ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateInstructorRequest'
 *     responses:
 *       200:
 *         description: Instructor updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Instructor'
 *                     message:
 *                       type: string
 *                       example: "Instructor updated successfully"
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
  "/:id",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  validate(updateInstructorSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const { schoolId: querySchoolId } = req.query as { schoolId?: string };
      const user = (req as unknown as AuthenticatedRequest).user;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: "Instructor ID is required",
        });
      }

      let targetSchoolId: string | undefined;
      if (user.role === "SUPER_ADMIN" && querySchoolId) {
        targetSchoolId = querySchoolId;
      } else if (user.role === "SCHOOL_ADMIN") {
        targetSchoolId = user.schoolId ?? undefined;
      }

      if (!targetSchoolId) {
        return res.status(403).json({
          success: false,
          error: "School ID is required",
        });
      }
      const instructor = await updateInstructor(id, updateData, targetSchoolId);

      return res.json({
        success: true,
        data: instructor,
        message: "Instructor updated successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/instructors/{id}:
 *   delete:
 *     summary: Deactivate instructor
 *     description: Deactivate an instructor (must belong to the authenticated school admin's school)
 *     tags: [Instructors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Instructor ID
 *     responses:
 *       200:
 *         description: Instructor deactivated successfully
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
 *                         success:
 *                           type: boolean
 *                     message:
 *                       type: string
 *                       example: "Instructor deactivated successfully"
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
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { schoolId: querySchoolId } = req.query as { schoolId?: string };
      const user = (req as unknown as AuthenticatedRequest).user;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: "Instructor ID is required",
        });
      }

      let targetSchoolId: string | undefined;
      if (user.role === "SUPER_ADMIN" && querySchoolId) {
        targetSchoolId = querySchoolId;
      } else if (user.role === "SCHOOL_ADMIN") {
        targetSchoolId = user.schoolId ?? undefined;
      }

      if (!targetSchoolId) {
        return res.status(403).json({
          success: false,
          error: "School ID is required",
        });
      }
      const result = await deleteInstructor(id, targetSchoolId);

      return res.json({
        success: true,
        data: result,
        message: "Instructor deactivated successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/instructors/school-admin:
 *   post:
 *     summary: Create instructor by school admin
 *     description: School admin creates an instructor and sends invitation
 *     tags: [Instructors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, email, specialties, languages]
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 example: "Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.doe@example.com"
 *               whatsappNumber:
 *                 type: string
 *                 example: "+1234567890"
 *               avatar:
 *                 type: string
 *                 format: uri
 *                 example: "https://example.com/avatar.jpg"
 *               specialties:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [kite, surf, wing]
 *                 example: ["kite", "surf"]
 *               languages:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["English", "Spanish"]
 *               notes:
 *                 type: string
 *                 example: "Experienced instructor"
 *     responses:
 *       201:
 *         description: Instructor created and invitation sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     instructor:
 *                       type: object
 *                     invitation:
 *                       type: object
 *                 message:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/school-admin",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  validate(createInstructorBySchoolAdminSchema),
  async (req, res, next) => {
    try {
      const instructorData = req.body;
      const { schoolId: querySchoolId } = req.query as { schoolId?: string };
      const user = (req as unknown as AuthenticatedRequest).user;

      let targetSchoolId: string | undefined;
      if (user.role === "SUPER_ADMIN" && querySchoolId) {
        targetSchoolId = querySchoolId;
      } else if (user.role === "SCHOOL_ADMIN") {
        targetSchoolId = user.schoolId ?? undefined;
      }

      if (!targetSchoolId) {
        return res.status(403).json({
          success: false,
          error: "School ID is required",
        });
      }

      // Check if user already exists
      const { data: existingUsers } =
        await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers.users.find(
        (user) => user.email === instructorData.email,
      );

      if (existingUser) {
        // User exists, check if they're already an instructor
        const { data: existingInstructor } = await supabaseAdmin
          .from("users")
          .select("*")
          .eq("id", existingUser.id)
          .eq("role", "INSTRUCTOR")
          .single();

        if (existingInstructor) {
          // Check if instructor is already linked to this school via instructor_schools table
          const { data: existingLink } = await supabaseAdmin
            .from("instructor_schools")
            .select("*")
            .eq("instructor_id", existingUser.id)
            .eq("school_id", targetSchoolId)
            .single();

          if (existingLink) {
            // Check if link is already active
            if (existingLink.is_active) {
              return res.status(400).json({
                success: false,
                error: "Instructor is already associated with this school",
              });
            }

            // Link exists but is inactive (was previously deactivated) - reactivate it
            const { data: reactivatedLink, error: reactivateError } =
              await supabaseAdmin
                .from("instructor_schools")
                .update({
                  is_active: true,
                  updated_at: new Date().toISOString(),
                })
                .eq("instructor_id", existingUser.id)
                .eq("school_id", targetSchoolId)
                .select()
                .single();

            if (reactivateError) {
              throw new AppError("Failed to reactivate instructor", 500);
            }

            return res.status(200).json({
              success: true,
              data: {
                instructor: existingInstructor,
                link: reactivatedLink,
                message: "Instructor reactivated for your school",
              },
              message: "Instructor reactivated successfully",
            });
          }

          // No existing link - create new one
          const { data: newLink, error: linkError } = await supabaseAdmin
            .from("instructor_schools")
            .insert({
              instructor_id: existingUser.id,
              school_id: targetSchoolId,
              is_active: true,
            })
            .select()
            .single();

          if (linkError) {
            throw new AppError("Failed to link instructor to school", 500);
          }

          return res.status(200).json({
            success: true,
            data: {
              instructor: existingInstructor,
              link: newLink,
              message: "Existing instructor linked to your school",
            },
            message: "Instructor linked successfully",
          });
        } else {
          // User exists but not an instructor, just link them to the school
          const { error: linkError } = await supabaseAdmin
            .from("users")
            .update({ school_id: targetSchoolId })
            .eq("id", existingUser.id);

          if (linkError) {
            console.error("Failed to link user to school:", linkError);
          }

          return res.status(201).json({
            success: true,
            data: {
              message: "User already exists and has been linked to the school",
            },
          });
        }
      } else {
        // User doesn't exist, create instructor immediately with is_active: false
        const instructor = await createInstructorBySchoolAdmin(
          instructorData,
          targetSchoolId,
          user.id,
          `${user.firstName} ${user.lastName}`,
        );

        return res.status(201).json({
          success: true,
          data: {
            instructor,
            message: instructor.invitation
              ? "Instructor created and invitation sent"
              : "Instructor created successfully",
          },
        });
      }
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
