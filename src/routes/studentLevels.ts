// Student Levels Routes

import { Router } from "express";
import { supabaseAdmin } from "../database/supabase";
import { AppError, AuthenticatedRequest } from "../types";
import { authenticate, authorizeRoles } from "../middleware/auth";
import {
  validate,
  createStudentLevelSchema,
  updateStudentLevelSchema,
} from "../middleware/validation";
import { generateSlug } from "../utils/slugify";

const router = Router();

/**
 * @swagger
 * /api/student-levels:
 *   get:
 *     summary: Get all student levels
 *     description: Retrieve all student levels for a school. SCHOOL_ADMIN can only access their own school's levels. SUPER_ADMIN can access any school by providing schoolId query parameter.
 *     tags: [Student Levels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: schoolId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID (required for SUPER_ADMIN, optional for SCHOOL_ADMIN. SCHOOL_ADMIN cannot query other schools)
 *         required: false
 *     responses:
 *       200:
 *         description: Student levels retrieved successfully
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
 *                             example: "Beginner"
 *                           slug:
 *                             type: string
 *                             example: "beginner"
 *                           description:
 *                             type: string
 *                             nullable: true
 *                             example: "Beginner level students"
 *                           color:
 *                             type: string
 *                             example: "#6B7280"
 *                           is_active:
 *                             type: boolean
 *                             example: true
 *                           school_id:
 *                             type: string
 *                             format: uuid
 *                             example: "123e4567-e89b-12d3-a456-426614174001"
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
 *               message: "Student levels retrieved successfully"
 *               data:
 *                 - id: "123e4567-e89b-12d3-a456-426614174000"
 *                   name: "Beginner"
 *                   slug: "beginner"
 *                   description: "Beginner level students"
 *                   color: "#6B7280"
 *                   is_active: true
 *                   school_id: "123e4567-e89b-12d3-a456-426614174001"
 *                   created_at: "2024-01-01T00:00:00.000Z"
 *                   updated_at: "2024-01-01T00:00:00.000Z"
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
  authorizeRoles(["SUPER_ADMIN", "SCHOOL_ADMIN"]),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { schoolId } = req.query;

      // For SCHOOL_ADMIN, use their school_id. For SUPER_ADMIN, use query param if provided
      let targetSchoolId: string | undefined;
      if (authReq.user.role === "SUPER_ADMIN" && schoolId) {
        targetSchoolId = schoolId as string;
      } else if (authReq.user.role === "SCHOOL_ADMIN") {
        targetSchoolId = authReq.user.schoolId || undefined;
      }

      if (!targetSchoolId) {
        throw new AppError("School ID is required", 400);
      }

      const { data, error } = await (supabaseAdmin as any)
        .from("student_levels")
        .select("*")
        .eq("school_id", targetSchoolId)
        .order("name", { ascending: true });

      if (error) {
        throw new AppError(
          `Failed to fetch student levels: ${error.message}`,
          500,
        );
      }

      res.json({
        success: true,
        data: data || [],
        message: "Student levels retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/student-levels:
 *   post:
 *     summary: Create a new student level
 *     description: Create a new student level for a school. SCHOOL_ADMIN can create levels for their own school. SUPER_ADMIN can create levels for any school by providing school_id in the request body.
 *     tags: [Student Levels]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: "Beginner"
 *               slug:
 *                 type: string
 *                 pattern: "^[a-z0-9-]+$"
 *                 minLength: 2
 *                 maxLength: 50
 *                 nullable: true
 *                 example: "beginner"
 *                 description: "Auto-generated from name if not provided"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 nullable: true
 *                 example: "Beginner level students"
 *               color:
 *                 type: string
 *                 pattern: "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
 *                 nullable: true
 *                 example: "#6B7280"
 *                 description: "Hex color code (defaults to #6B7280 if not provided)"
 *               active:
 *                 type: boolean
 *                 example: true
 *                 description: "Whether the level is active (defaults to true)"
 *               school_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 example: "123e4567-e89b-12d3-a456-426614174001"
 *                 description: "Required for SUPER_ADMIN, ignored for SCHOOL_ADMIN"
 *           example:
 *             name: "Beginner"
 *             slug: "beginner"
 *             description: "Beginner level students"
 *             color: "#6B7280"
 *             active: true
 *             school_id: "123e4567-e89b-12d3-a456-426614174001"
 *     responses:
 *       201:
 *         description: Student level created successfully
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
 *                         name:
 *                           type: string
 *                           example: "Beginner"
 *                         slug:
 *                           type: string
 *                           example: "beginner"
 *                         description:
 *                           type: string
 *                           nullable: true
 *                           example: "Beginner level students"
 *                         color:
 *                           type: string
 *                           example: "#6B7280"
 *                         is_active:
 *                           type: boolean
 *                           example: true
 *                         school_id:
 *                           type: string
 *                           format: uuid
 *                           example: "123e4567-e89b-12d3-a456-426614174001"
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-01-01T00:00:00.000Z"
 *                         updated_at:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-01-01T00:00:00.000Z"
 *             example:
 *               success: true
 *               message: "Student level created successfully"
 *               data:
 *                 id: "123e4567-e89b-12d3-a456-426614174000"
 *                 name: "Beginner"
 *                 slug: "beginner"
 *                 description: "Beginner level students"
 *                 color: "#6B7280"
 *                 is_active: true
 *                 school_id: "123e4567-e89b-12d3-a456-426614174001"
 *                 created_at: "2024-01-01T00:00:00.000Z"
 *                 updated_at: "2024-01-01T00:00:00.000Z"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         $ref: '#/components/responses/ConflictError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  authenticate,
  authorizeRoles(["SUPER_ADMIN", "SCHOOL_ADMIN"]),
  validate(createStudentLevelSchema),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { name, slug, description, color, active, school_id } = req.body;

      // Determine target school_id
      let targetSchoolId: string;
      if (authReq.user.role === "SUPER_ADMIN" && school_id) {
        targetSchoolId = school_id;
      } else if (
        authReq.user.role === "SCHOOL_ADMIN" &&
        authReq.user.schoolId
      ) {
        targetSchoolId = authReq.user.schoolId;
      } else {
        throw new AppError("School ID is required", 400);
      }

      const finalSlug = slug || generateSlug(name);

      // Check if name or slug already exists for this school
      const { data: existingLevel } = await (supabaseAdmin as any)
        .from("student_levels")
        .select("id")
        .eq("school_id", targetSchoolId)
        .or(`name.eq.${name},slug.eq.${finalSlug}`)
        .limit(1);

      if (existingLevel && existingLevel.length > 0) {
        throw new AppError(
          "A student level with this name or slug already exists for this school",
          409,
        );
      }

      // Create the student level
      const { data: newLevel, error } = await (supabaseAdmin as any)
        .from("student_levels")
        .insert({
          name,
          slug: finalSlug,
          description: description || null,
          color: color || "#6B7280",
          is_active: active !== undefined ? active : true,
          school_id: targetSchoolId,
        })
        .select()
        .single();

      if (error) {
        throw new AppError(
          `Failed to create student level: ${error.message}`,
          500,
        );
      }

      res.status(201).json({
        success: true,
        data: newLevel,
        message: "Student level created successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/student-levels/{id}:
 *   put:
 *     summary: Update a student level
 *     description: Update an existing student level. SCHOOL_ADMIN can only update levels from their own school. SUPER_ADMIN can update any level.
 *     tags: [Student Levels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Student level ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: "Beginner"
 *               slug:
 *                 type: string
 *                 pattern: "^[a-z0-9-]+$"
 *                 minLength: 2
 *                 maxLength: 50
 *                 nullable: true
 *                 example: "beginner"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 nullable: true
 *                 example: "Beginner level students"
 *               color:
 *                 type: string
 *                 pattern: "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
 *                 nullable: true
 *                 example: "#6B7280"
 *               active:
 *                 type: boolean
 *                 example: true
 *           example:
 *             name: "Beginner"
 *             description: "Updated beginner level description"
 *             color: "#10B981"
 *             active: true
 *     responses:
 *       200:
 *         description: Student level updated successfully
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
 *                         name:
 *                           type: string
 *                           example: "Beginner"
 *                         slug:
 *                           type: string
 *                           example: "beginner"
 *                         description:
 *                           type: string
 *                           nullable: true
 *                           example: "Updated beginner level description"
 *                         color:
 *                           type: string
 *                           example: "#10B981"
 *                         is_active:
 *                           type: boolean
 *                           example: true
 *                         school_id:
 *                           type: string
 *                           format: uuid
 *                           example: "123e4567-e89b-12d3-a456-426614174001"
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-01-01T00:00:00.000Z"
 *                         updated_at:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-01-01T00:00:00.000Z"
 *             example:
 *               success: true
 *               message: "Student level updated successfully"
 *               data:
 *                 id: "123e4567-e89b-12d3-a456-426614174000"
 *                 name: "Beginner"
 *                 slug: "beginner"
 *                 description: "Updated beginner level description"
 *                 color: "#10B981"
 *                 is_active: true
 *                 school_id: "123e4567-e89b-12d3-a456-426614174001"
 *                 created_at: "2024-01-01T00:00:00.000Z"
 *                 updated_at: "2024-01-01T00:00:00.000Z"
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
  authorizeRoles(["SUPER_ADMIN", "SCHOOL_ADMIN"]),
  validate(updateStudentLevelSchema),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { id } = req.params;
      const { name, slug, description, color, active } = req.body;

      // Check if level exists
      const { data: level, error: fetchError } = await (supabaseAdmin as any)
        .from("student_levels")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !level) {
        throw new AppError("Student level not found", 404);
      }

      // Check if SCHOOL_ADMIN is trying to update a level from another school
      if (
        authReq.user.role === "SCHOOL_ADMIN" &&
        level.school_id !== authReq.user.schoolId
      ) {
        throw new AppError("Access denied to this school", 403);
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (name !== undefined) updateData.name = name;
      if (slug !== undefined) updateData.slug = slug;
      if (description !== undefined)
        updateData.description = description || null;
      if (color !== undefined) updateData.color = color;
      if (active !== undefined) updateData.is_active = active;

      if (name || slug) {
        const { data: existingLevel } = await (supabaseAdmin as any)
          .from("student_levels")
          .select("id")
          .eq("school_id", level.school_id)
          .or(`name.eq.${name || ""},slug.eq.${slug || ""}`)
          .neq("id", id)
          .limit(1);

        if (existingLevel && existingLevel.length > 0) {
          throw new AppError(
            "A student level with this name or slug already exists for this school",
            409,
          );
        }
      }

      // Update level
      const { data: updatedLevel, error } = await (supabaseAdmin as any)
        .from("student_levels")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw new AppError(
          `Failed to update student level: ${error.message}`,
          500,
        );
      }

      res.json({
        success: true,
        data: updatedLevel,
        message: "Student level updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/student-levels/{id}/toggle-status:
 *   patch:
 *     summary: Toggle student level active status
 *     description: Toggle the active/inactive status of a student level. SCHOOL_ADMIN can only toggle levels from their own school. SUPER_ADMIN can toggle any level.
 *     tags: [Student Levels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Student level ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Student level status toggled successfully
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
 *                         name:
 *                           type: string
 *                           example: "Beginner"
 *                         slug:
 *                           type: string
 *                           example: "beginner"
 *                         description:
 *                           type: string
 *                           nullable: true
 *                           example: "Beginner level students"
 *                         color:
 *                           type: string
 *                           example: "#6B7280"
 *                         is_active:
 *                           type: boolean
 *                           example: false
 *                         school_id:
 *                           type: string
 *                           format: uuid
 *                           example: "123e4567-e89b-12d3-a456-426614174001"
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-01-01T00:00:00.000Z"
 *                         updated_at:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-01-01T00:00:00.000Z"
 *             example:
 *               success: true
 *               message: "Student level deactivated successfully"
 *               data:
 *                 id: "123e4567-e89b-12d3-a456-426614174000"
 *                 name: "Beginner"
 *                 slug: "beginner"
 *                 description: "Beginner level students"
 *                 color: "#6B7280"
 *                 is_active: false
 *                 school_id: "123e4567-e89b-12d3-a456-426614174001"
 *                 created_at: "2024-01-01T00:00:00.000Z"
 *                 updated_at: "2024-01-01T00:00:00.000Z"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch(
  "/:id/toggle-status",
  authenticate,
  authorizeRoles(["SUPER_ADMIN", "SCHOOL_ADMIN"]),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { id } = req.params;

      const { data: level, error: fetchError } = await (supabaseAdmin as any)
        .from("student_levels")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !level) {
        throw new AppError("Student level not found", 404);
      }

      // Check if SCHOOL_ADMIN is trying to toggle a level from another school
      if (
        authReq.user.role === "SCHOOL_ADMIN" &&
        level.school_id !== authReq.user.schoolId
      ) {
        throw new AppError("Access denied to this school", 403);
      }

      const { data: updatedLevel, error: updateError } = await (
        supabaseAdmin as any
      )
        .from("student_levels")
        .update({
          is_active: !level.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        throw new AppError(
          `Failed to toggle student level status: ${updateError.message}`,
          500,
        );
      }

      res.json({
        success: true,
        data: updatedLevel,
        message: `Student level ${updatedLevel.is_active ? "activated" : "deactivated"} successfully`,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/student-levels/{id}:
 *   delete:
 *     summary: Delete a student level
 *     description: Delete a student level. Cannot delete if the level is used by any students. SCHOOL_ADMIN can only delete levels from their own school. SUPER_ADMIN can delete any level.
 *     tags: [Student Levels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Student level ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Student level deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Student level deleted successfully"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: Cannot delete student level that is used by students
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Cannot delete student level that is used by students"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  "/:id",
  authenticate,
  authorizeRoles(["SUPER_ADMIN", "SCHOOL_ADMIN"]),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { id } = req.params;

      const { data: level, error: fetchError } = await (supabaseAdmin as any)
        .from("student_levels")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !level) {
        throw new AppError("Student level not found", 404);
      }

      // Check if SCHOOL_ADMIN is trying to delete a level from another school
      if (
        authReq.user.role === "SCHOOL_ADMIN" &&
        level.school_id !== authReq.user.schoolId
      ) {
        throw new AppError("Access denied to this school", 403);
      }

      try {
        const { data: users, error: usersError } = await (supabaseAdmin as any)
          .from("users")
          .select("id")
          .eq("role", "USER")
          .eq("student_level_id", id)
          .limit(1);

        if (usersError) {
          const errorMsg = usersError.message || "";
          if (
            errorMsg.includes("does not exist") ||
            errorMsg.includes("column") ||
            errorMsg.includes("unknown column")
          ) {
          } else {
            throw new AppError(
              `Failed to check student level usage: ${usersError.message}`,
              500,
            );
          }
        } else if (users && users.length > 0) {
          throw new AppError(
            "Cannot delete student level that is used by students",
            409,
          );
        }
      } catch (error: any) {
        if (error instanceof AppError) {
          throw error;
        }
      }

      // Delete the level
      const { error } = await (supabaseAdmin as any)
        .from("student_levels")
        .delete()
        .eq("id", id);

      if (error) {
        throw new AppError(
          `Failed to delete student level: ${error.message}`,
          500,
        );
      }

      res.json({
        success: true,
        message: "Student level deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
