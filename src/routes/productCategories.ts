// Product Categories Routes

import { Router } from "express";
import { supabaseAdmin } from "../database/supabase";
import { AppError, AuthenticatedRequest } from "../types";
import { authenticate, authorizeRoles } from "../middleware/auth";
import {
  validate,
  createProductCategorySchema,
  updateProductCategorySchema,
} from "../middleware/validation";
import { generateSlug } from "../utils/slugify";

const router = Router();

/**
 * @swagger
 * /api/product-categories:
 *   get:
 *     summary: Get all product categories
 *     description: Retrieve all product categories for a school. SCHOOL_ADMIN can only access their own school's categories. SUPER_ADMIN can access any school by providing schoolId query parameter.
 *     tags: [Product Categories]
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
 *         description: Product categories retrieved successfully
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
 *                           name:
 *                             type: string
 *                             example: "Private Lessons"
 *                           slug:
 *                             type: string
 *                             example: "private-lessons"
 *                           color:
 *                             type: string
 *                             example: "#3B82F6"
 *                           default_max_participants:
 *                             type: integer
 *                             example: 1
 *                           is_active:
 *                             type: boolean
 *                             example: true
 *                           sort_order:
 *                             type: integer
 *                             example: 1
 *                           school_id:
 *                             type: string
 *                             format: uuid
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                           updated_at:
 *                             type: string
 *                             format: date-time
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
        .from("product_categories")
        .select("*")
        .eq("school_id", targetSchoolId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        throw new AppError(
          `Failed to fetch product categories: ${error.message}`,
          500,
        );
      }

      res.json({
        success: true,
        data: data || [],
        message: "Product categories retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/product-categories:
 *   post:
 *     summary: Create a new product category
 *     description: Create a new product category for a school. SCHOOL_ADMIN can create categories for their own school. SUPER_ADMIN can create categories for any school by providing school_id in the request body.
 *     tags: [Product Categories]
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
 *                 maxLength: 100
 *                 example: "Private Lessons"
 *               slug:
 *                 type: string
 *                 pattern: "^[a-z0-9-]+$"
 *                 minLength: 2
 *                 maxLength: 50
 *                 nullable: true
 *                 example: "private-lessons"
 *                 description: "Auto-generated from name if not provided"
 *               color:
 *                 type: string
 *                 pattern: "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
 *                 nullable: true
 *                 example: "#3B82F6"
 *                 default: "#3B82F6"
 *               default_max_participants:
 *                 type: integer
 *                 minimum: 1
 *                 example: 1
 *                 default: 1
 *               active:
 *                 type: boolean
 *                 example: true
 *                 default: true
 *               sort_order:
 *                 type: integer
 *                 minimum: 0
 *                 example: 1
 *               order_position:
 *                 type: integer
 *                 minimum: 0
 *                 example: 1
 *                 description: "Alias for sort_order (for backward compatibility)"
 *               school_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *                 description: "Required for SUPER_ADMIN, ignored for SCHOOL_ADMIN"
 *           example:
 *             name: "Private Lessons"
 *             color: "#3B82F6"
 *             default_max_participants: 1
 *             active: true
 *             sort_order: 1
 *     responses:
 *       201:
 *         description: Product category created successfully
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
  validate(createProductCategorySchema),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const {
        name,
        slug,
        color,
        default_max_participants,
        active,
        associable_to_lessons,
        sort_order,
        order_position,
        school_id,
      } = req.body;

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

      const { data: existingCategory } = await (supabaseAdmin as any)
        .from("product_categories")
        .select("id")
        .eq("school_id", targetSchoolId)
        .or(`name.eq.${name},slug.eq.${finalSlug}`)
        .limit(1);

      if (existingCategory && existingCategory.length > 0) {
        throw new AppError(
          "A product category with this name or slug already exists for this school",
          409,
        );
      }

      // Create the category
      const { data: newCategory, error } = await (supabaseAdmin as any)
        .from("product_categories")
        .insert({
          name,
          slug: finalSlug,
          color: color || "#3B82F6",
          default_max_participants: default_max_participants || 1,
          is_active: active !== undefined ? active : true,
          associable_to_lessons:
            associable_to_lessons !== undefined ? associable_to_lessons : true,
          sort_order:
            sort_order !== undefined
              ? sort_order
              : order_position !== undefined
                ? order_position
                : 0,
          school_id: targetSchoolId,
        })
        .select()
        .single();

      if (error) {
        throw new AppError(
          `Failed to create product category: ${error.message}`,
          500,
        );
      }

      res.status(201).json({
        success: true,
        data: newCategory,
        message: "Product category created successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/product-categories/{id}:
 *   put:
 *     summary: Update a product category
 *     description: Update an existing product category. SCHOOL_ADMIN can only update categories from their own school. SUPER_ADMIN can update any category.
 *     tags: [Product Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product category ID
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
 *                 maxLength: 100
 *                 example: "Private Lessons"
 *               slug:
 *                 type: string
 *                 pattern: "^[a-z0-9-]+$"
 *                 minLength: 2
 *                 maxLength: 50
 *                 nullable: true
 *                 example: "private-lessons"
 *               color:
 *                 type: string
 *                 pattern: "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
 *                 nullable: true
 *                 example: "#10B981"
 *               default_max_participants:
 *                 type: integer
 *                 minimum: 1
 *                 example: 2
 *               active:
 *                 type: boolean
 *                 example: true
 *               sort_order:
 *                 type: integer
 *                 minimum: 0
 *                 example: 2
 *               order_position:
 *                 type: integer
 *                 minimum: 0
 *                 example: 2
 *                 description: "Alias for sort_order (for backward compatibility)"
 *           example:
 *             name: "Private Lessons"
 *             color: "#10B981"
 *             default_max_participants: 2
 *     responses:
 *       200:
 *         description: Product category updated successfully
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
  validate(updateProductCategorySchema),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { id } = req.params;
      const {
        name,
        slug,
        color,
        default_max_participants,
        active,
        associable_to_lessons,
        sort_order,
        order_position,
      } = req.body;

      // Check if category exists
      const { data: category, error: fetchError } = await (supabaseAdmin as any)
        .from("product_categories")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !category) {
        throw new AppError("Product category not found", 404);
      }

      // Check if SCHOOL_ADMIN is trying to update a category from another school
      if (
        authReq.user.role === "SCHOOL_ADMIN" &&
        category.school_id !== authReq.user.schoolId
      ) {
        throw new AppError("Access denied to this school", 403);
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (name !== undefined) updateData.name = name;
      if (slug !== undefined) {
        if (slug === null || slug === "") {
          const nameToUse = name !== undefined ? name : category.name;
          updateData.slug = generateSlug(nameToUse);
        } else {
          updateData.slug = slug;
        }
      }
      if (color !== undefined) updateData.color = color;
      if (default_max_participants !== undefined)
        updateData.default_max_participants = default_max_participants;
      if (active !== undefined) updateData.is_active = active;
      if (associable_to_lessons !== undefined)
        updateData.associable_to_lessons = associable_to_lessons;
      if (sort_order !== undefined) {
        updateData.sort_order = sort_order;
      } else if (order_position !== undefined) {
        updateData.sort_order = order_position; // For backward compatibility
      }

      if (name || slug) {
        const { data: existingCategory } = await (supabaseAdmin as any)
          .from("product_categories")
          .select("id")
          .eq("school_id", category.school_id)
          .or(`name.eq.${name || ""},slug.eq.${slug || ""}`)
          .neq("id", id)
          .limit(1);

        if (existingCategory && existingCategory.length > 0) {
          throw new AppError(
            "A product category with this name or slug already exists for this school",
            409,
          );
        }
      }

      // Update category
      const { data: updatedCategory, error } = await (supabaseAdmin as any)
        .from("product_categories")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw new AppError(
          `Failed to update product category: ${error.message}`,
          500,
        );
      }

      res.json({
        success: true,
        data: updatedCategory,
        message: "Product category updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/product-categories/{id}/toggle-status:
 *   patch:
 *     summary: Toggle product category active status
 *     description: Toggle the active/inactive status of a product category. SCHOOL_ADMIN can only toggle categories from their own school. SUPER_ADMIN can toggle any category.
 *     tags: [Product Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product category ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Product category status toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
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

      const { data: category, error: fetchError } = await (supabaseAdmin as any)
        .from("product_categories")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !category) {
        throw new AppError("Product category not found", 404);
      }

      // Check if SCHOOL_ADMIN is trying to toggle a category from another school
      if (
        authReq.user.role === "SCHOOL_ADMIN" &&
        category.school_id !== authReq.user.schoolId
      ) {
        throw new AppError("Access denied to this school", 403);
      }

      const { data: updatedCategory, error: updateError } = await (
        supabaseAdmin as any
      )
        .from("product_categories")
        .update({
          is_active: !category.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        throw new AppError(
          `Failed to toggle product category status: ${updateError.message}`,
          500,
        );
      }

      const newStatus = updatedCategory.is_active;
      res.json({
        success: true,
        data: updatedCategory,
        message: `Product category ${newStatus ? "activated" : "deactivated"} successfully`,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/product-categories/{id}:
 *   delete:
 *     summary: Delete a product category
 *     description: Delete a product category. Cannot delete if the category is used by any products. SCHOOL_ADMIN can only delete categories from their own school. SUPER_ADMIN can delete any category.
 *     tags: [Product Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product category ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Product category deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Product category deleted successfully"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: Cannot delete product category that is used by products
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Cannot delete product category that is used by products"
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

      const { data: category, error: fetchError } = await (supabaseAdmin as any)
        .from("product_categories")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !category) {
        throw new AppError("Product category not found", 404);
      }

      // Check if SCHOOL_ADMIN is trying to delete a category from another school
      if (
        authReq.user.role === "SCHOOL_ADMIN" &&
        category.school_id !== authReq.user.schoolId
      ) {
        throw new AppError("Access denied to this school", 403);
      }

      // Check if category is used by products
      const { data: products, error: productsError } = await (
        supabaseAdmin as any
      )
        .from("products")
        .select("id")
        .eq("category_id", id)
        .limit(1);

      if (productsError) {
        throw new AppError(
          `Failed to check product category usage: ${productsError.message}`,
          500,
        );
      }

      if (products && products.length > 0) {
        throw new AppError(
          "Cannot delete product category that is used by products",
          409,
        );
      }

      // Delete the category
      const { error } = await (supabaseAdmin as any)
        .from("product_categories")
        .delete()
        .eq("id", id);

      if (error) {
        throw new AppError(
          `Failed to delete product category: ${error.message}`,
          500,
        );
      }

      res.json({
        success: true,
        message: "Product category deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
