/**
 * @fileoverview Disciplines Routes
 * @description Routes for managing water sports disciplines
 * @author Ridesk Team
 * @version 1.0.0
 */

import { Router } from "express";
import { supabaseAdmin } from "../database/supabase";
import { AppError, AuthenticatedRequest } from "../types";
import { authenticate, authorizeRoles } from "../middleware/auth";
import {
  validate,
  createDisciplineSchema,
  updateDisciplineSchema,
} from "../middleware/validation";
import { generateSlug } from "../utils/slugify";

const router = Router();

/**
 * Public endpoint to get active disciplines for a school.
 * This is used by unauthenticated flows like public instructor registration.
 */
router.get(
  "/public/:schoolId/active",
  async (req, res, next) => {
    try {
      const { schoolId } = req.params;

      if (!schoolId) {
        throw new AppError("School ID is required", 400);
      }

      const { data, error } = await (supabaseAdmin as any).rpc(
        "get_active_disciplines",
        { p_school_id: schoolId },
      );

      if (error) {
        throw new AppError(
          `Failed to fetch disciplines: ${error.message}`,
          500,
        );
      }

      res.json({
        success: true,
        data: data || [],
        message: "Disciplines retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/disciplines:
 *   get:
 *     summary: Get all active disciplines
 *     description: Retrieve all active water sports disciplines
 *     tags: [Disciplines]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Disciplines retrieved successfully
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
 *                             example: "kite"
 *                           slug:
 *                             type: string
 *                             example: "kite"
 *                           display_name:
 *                             type: string
 *                             example: "Kitesurfing"
 *                           icon:
 *                             type: string
 *                             example: "kite"
 *                           color:
 *                             type: string
 *                             example: "#3B82F6"
 *                           is_active:
 *                             type: boolean
 *                             example: true
 *                           sort_order:
 *                             type: integer
 *                             example: 1
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *             example:
 *               success: true
 *               data:
 *                 - id: "123e4567-e89b-12d3-a456-426614174000"
 *                   name: "kite"
 *                   slug: "kite"
 *                   display_name: "Kitesurfing"
 *                   icon: "kite"
 *                   color: "#3B82F6"
 *                   is_active: true
 *                   sort_order: 1
 *                   created_at: "2024-01-01T00:00:00.000Z"
 *                   updated_at: "2024-01-01T00:00:00.000Z"
 *                 - id: "456e7890-e89b-12d3-a456-426614174001"
 *                   name: "surf"
 *                   slug: "surf"
 *                   display_name: "Surfing"
 *                   icon: "surf"
 *                   color: "#10B981"
 *                   is_active: true
 *                   sort_order: 2
 *                   created_at: "2024-01-01T00:00:00.000Z"
 *                   updated_at: "2024-01-01T00:00:00.000Z"
 *                 - id: "789e0123-e89b-12d3-a456-426614174002"
 *                   name: "wing"
 *                   slug: "wing"
 *                   display_name: "Wing Foiling"
 *                   icon: "wing"
 *                   color: "#F59E0B"
 *                   is_active: true
 *                   sort_order: 3
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

      // Use raw SQL to get active disciplines for this school
      const { data, error } = await (supabaseAdmin as any).rpc(
        "get_active_disciplines",
        { p_school_id: targetSchoolId },
      );

      if (error) {
        throw new AppError(
          `Failed to fetch disciplines: ${error.message}`,
          500,
        );
      }

      res.json({
        success: true,
        data: data || [],
        message: "Disciplines retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/disciplines/all:
 *   get:
 *     summary: Get all disciplines including inactive
 *     description: Retrieve all disciplines including inactive ones for a school. SCHOOL_ADMIN can only access their own school's disciplines. SUPER_ADMIN can access any school by providing schoolId query parameter.
 *     tags: [Disciplines]
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
 *         description: All disciplines retrieved successfully
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
 *                             example: "kite"
 *                           slug:
 *                             type: string
 *                             example: "kite"
 *                           display_name:
 *                             type: string
 *                             example: "Kitesurfing"
 *                           icon:
 *                             type: string
 *                             nullable: true
 *                             example: "kite"
 *                           color:
 *                             type: string
 *                             example: "#3B82F6"
 *                           is_active:
 *                             type: boolean
 *                             example: true
 *                           sort_order:
 *                             type: integer
 *                             example: 1
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
  "/all",
  authenticate,
  authorizeRoles(["SUPER_ADMIN", "SCHOOL_ADMIN"]),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { schoolId } = req.query;

      let targetSchoolId: string | undefined;
      if (authReq.user.role === "SUPER_ADMIN" && schoolId) {
        targetSchoolId = schoolId as string;
      } else if (authReq.user.role === "SCHOOL_ADMIN") {
        targetSchoolId = authReq.user.schoolId || undefined;
      }

      if (!targetSchoolId) {
        throw new AppError("School ID is required", 400);
      }

      let query = (supabaseAdmin as any)
        .from("disciplines")
        .select("*")
        .eq("school_id", targetSchoolId);

      query = query
        .order("sort_order", { ascending: true })
        .order("display_name", { ascending: true });

      const { data, error } = await query;

      if (error) {
        throw new AppError(
          `Failed to fetch all disciplines: ${error.message}`,
          500,
        );
      }

      res.json({
        success: true,
        data: data || [],
        message: "All disciplines retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/disciplines/{id}/toggle-status:
 *   patch:
 *     summary: Toggle discipline active status
 *     description: Toggle the active/inactive status of a discipline (SUPER_ADMIN only)
 *     tags: [Disciplines]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Discipline ID
 *     responses:
 *       200:
 *         description: Discipline status toggled successfully
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
 *                         name:
 *                           type: string
 *                         slug:
 *                           type: string
 *                         display_name:
 *                           type: string
 *                         icon:
 *                           type: string
 *                         color:
 *                           type: string
 *                         is_active:
 *                           type: boolean
 *                         sort_order:
 *                           type: integer
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                         updated_at:
 *                           type: string
 *                           format: date-time
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

      if (!id) {
        throw new AppError("Discipline ID is required", 400);
      }

      const { data: discipline, error: fetchError } = await (
        supabaseAdmin as any
      )
        .from("disciplines")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !discipline) {
        throw new AppError("Discipline not found", 404);
      }

      // Check if SCHOOL_ADMIN is trying to toggle a discipline from another school
      if (
        authReq.user.role === "SCHOOL_ADMIN" &&
        discipline.school_id !== authReq.user.schoolId
      ) {
        throw new AppError("Access denied to this school", 403);
      }

      const { data: updatedDiscipline, error: updateError } = await (
        supabaseAdmin as any
      )
        .from("disciplines")
        .update({
          is_active: !discipline.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        throw new AppError(
          `Failed to toggle discipline status: ${updateError.message}`,
          500,
        );
      }

      res.json({
        success: true,
        data: updatedDiscipline,
        message: `Discipline ${updatedDiscipline.is_active ? "activated" : "deactivated"} successfully`,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/disciplines:
 *   post:
 *     summary: Create a new discipline
 *     description: Create a new water sports discipline for a school. SCHOOL_ADMIN can create disciplines for their own school. SUPER_ADMIN can create disciplines for any school by providing school_id in the request body.
 *     tags: [Disciplines]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, color]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: "kitesurf"
 *                 description: "Internal name (also used as display_name)"
 *               slug:
 *                 type: string
 *                 pattern: "^[a-z0-9-]+$"
 *                 minLength: 2
 *                 maxLength: 50
 *                 nullable: true
 *                 example: "kitesurf"
 *                 description: "Auto-generated from name if not provided"
 *               icon:
 *                 type: string
 *                 nullable: true
 *                 example: "kite"
 *               color:
 *                 type: string
 *                 pattern: "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
 *                 example: "#3B82F6"
 *                 default: "#3B82F6"
 *               is_active:
 *                 type: boolean
 *                 example: true
 *                 default: true
 *               sort_order:
 *                 type: integer
 *                 minimum: 0
 *                 example: 1
 *                 default: 0
 *               school_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *                 description: "Required for SUPER_ADMIN, ignored for SCHOOL_ADMIN"
 *           example:
 *             name: "kitesurf"
 *             icon: "kite"
 *             color: "#3B82F6"
 *             is_active: true
 *             sort_order: 1
 *             school_id: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       201:
 *         description: Discipline created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
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
  validate(createDisciplineSchema),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { name, slug, icon, color, is_active, sort_order, school_id } =
        req.body;

      // Determine target school_id
      let targetSchoolId: string | undefined;
      if (authReq.user.role === "SUPER_ADMIN") {
        if (school_id) {
          targetSchoolId = school_id;
        } else {
          throw new AppError(
            "School ID is req for creating disciplines. Please provide school_id in the request body.",
            400,
          );
        }
      } else if (authReq.user.role === "SCHOOL_ADMIN") {
        targetSchoolId = authReq.user.schoolId || undefined;
        if (!targetSchoolId) {
          throw new AppError(
            "School ID is required. Your account is not associated with a school.",
            400,
          );
        }
      } else {
        throw new AppError(
          "Unauthorized: Only SUPER_ADMIN and SCHOOL_ADMIN can create disciplines",
          403,
        );
      }

      if (!targetSchoolId) {
        throw new AppError("School ID is required", 400);
      }

      const finalSlug = slug || generateSlug(name);
      const finalDisplayName = name;

      // Check if name or slug already exists for this school
      const { data: existingDiscipline } = await (supabaseAdmin as any)
        .from("disciplines")
        .select("id")
        .eq("school_id", targetSchoolId)
        .or(`name.eq.${name},slug.eq.${finalSlug}`)
        .limit(1);

      if (existingDiscipline && existingDiscipline.length > 0) {
        throw new AppError(
          "A discipline with this name or slug already exists for this school",
          409,
        );
      }

      // Create the discipline
      const { data: newDiscipline, error } = await (supabaseAdmin as any)
        .from("disciplines")
        .insert({
          name,
          slug: finalSlug,
          display_name: finalDisplayName,
          icon: icon || null,
          color: color || "#3B82F6",
          is_active: is_active !== undefined ? is_active : true,
          sort_order: sort_order || 0,
          school_id: targetSchoolId,
        })
        .select()
        .single();

      if (error) {
        throw new AppError(
          `Failed to create discipline: ${error.message}`,
          500,
        );
      }

      res.status(201).json({
        success: true,
        data: newDiscipline,
        message: "Discipline created successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/disciplines/{id}:
 *   put:
 *     summary: Update a discipline
 *     description: Update an existing discipline. SCHOOL_ADMIN can only update disciplines from their own school. SUPER_ADMIN can update any discipline.
 *     tags: [Disciplines]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Discipline ID
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
 *                 example: "kitesurf"
 *                 description: "Updates both name and display_name"
 *               slug:
 *                 type: string
 *                 pattern: "^[a-z0-9-]+$"
 *                 minLength: 2
 *                 maxLength: 50
 *                 nullable: true
 *                 example: "kitesurf"
 *               icon:
 *                 type: string
 *                 nullable: true
 *                 example: "kite"
 *               color:
 *                 type: string
 *                 pattern: "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
 *                 example: "#10B981"
 *               is_active:
 *                 type: boolean
 *                 example: true
 *               sort_order:
 *                 type: integer
 *                 minimum: 0
 *                 example: 2
 *           example:
 *             name: "kitesurf"
 *             color: "#10B981"
 *             sort_order: 2
 *     responses:
 *       200:
 *         description: Discipline updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
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
  validate(updateDisciplineSchema),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { id } = req.params;
      const { name, slug, icon, color, is_active, sort_order } = req.body;

      // Check if discipline exists
      const { data: discipline, error: fetchError } = await (
        supabaseAdmin as any
      )
        .from("disciplines")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !discipline) {
        throw new AppError("Discipline not found", 404);
      }

      // Check if SCHOOL_ADMIN is trying to update a discipline from another school
      if (
        authReq.user.role === "SCHOOL_ADMIN" &&
        discipline.school_id !== authReq.user.schoolId
      ) {
        throw new AppError("Access denied to this school", 403);
      }

      // Build update object
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (name !== undefined) {
        updateData.name = name;
        updateData.display_name = name;
      }
      if (slug !== undefined) updateData.slug = slug;
      if (icon !== undefined) {
        updateData.icon = icon === null || icon === "" ? null : icon;
      }
      if (color !== undefined) updateData.color = color;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (sort_order !== undefined) updateData.sort_order = sort_order;

      if (name || slug) {
        const { data: existingDiscipline } = await (supabaseAdmin as any)
          .from("disciplines")
          .select("id")
          .eq("school_id", discipline.school_id)
          .or(`name.eq.${name || ""},slug.eq.${slug || ""}`)
          .neq("id", id)
          .limit(1);

        if (existingDiscipline && existingDiscipline.length > 0) {
          throw new AppError(
            "A discipline with this name or slug already exists for this school",
            409,
          );
        }
      }

      // Update discipline
      const { data: updatedDiscipline, error } = await (supabaseAdmin as any)
        .from("disciplines")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw new AppError(
          `Failed to update discipline: ${error.message}`,
          500,
        );
      }

      res.json({
        success: true,
        data: updatedDiscipline,
        message: "Discipline updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/disciplines/{id}:
 *   delete:
 *     summary: Delete a discipline
 *     description: Delete a discipline. Cannot delete if the discipline is used in any lessons. SCHOOL_ADMIN can only delete disciplines from their own school. SUPER_ADMIN can delete any discipline.
 *     tags: [Disciplines]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Discipline ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Discipline deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Discipline deleted successfully"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: Cannot delete discipline that is used in existing lessons
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Cannot delete discipline that is used in existing lessons"
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

      const { data: discipline, error: fetchError } = await (
        supabaseAdmin as any
      )
        .from("disciplines")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !discipline) {
        throw new AppError("Discipline not found", 404);
      }

      // Check if SCHOOL_ADMIN is trying to delete a discipline from another school
      if (
        authReq.user.role === "SCHOOL_ADMIN" &&
        discipline.school_id !== authReq.user.schoolId
      ) {
        throw new AppError("Access denied to this school", 403);
      }

      // Check if discipline is used in lessons
      const { data: lessons, error: lessonsError } = await (
        supabaseAdmin as any
      )
        .from("lessons")
        .select("id")
        .eq("discipline", discipline.name)
        .eq("school_id", discipline.school_id)
        .limit(1);

      if (lessonsError) {
        throw new AppError(
          `Failed to check discipline usage: ${lessonsError.message}`,
          500,
        );
      }

      if (lessons && lessons.length > 0) {
        throw new AppError(
          "Cannot delete discipline that is used in existing lessons",
          409,
        );
      }

      // Delete the discipline
      const { error } = await (supabaseAdmin as any)
        .from("disciplines")
        .delete()
        .eq("id", id);

      if (error) {
        throw new AppError(
          `Failed to delete discipline: ${error.message}`,
          500,
        );
      }

      res.json({
        success: true,
        message: "Discipline deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
