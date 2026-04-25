// Products Routes

import { Router } from "express";
import { supabaseAdmin } from "../database/supabase";
import { AppError, AuthenticatedRequest } from "../types";
import { authenticate, authorizeRoles } from "../middleware/auth";
import {
  validate,
  createProductSchema,
  updateProductSchema,
} from "../middleware/validation";
import { generateSlug } from "../utils/slugify";

const router = Router();

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products
 *     description: Retrieve all products for a school. Can be filtered by category_id and discipline_id. SCHOOL_ADMIN can only access their own school's products. SUPER_ADMIN can access any school by providing schoolId query parameter.
 *     tags: [Products]
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
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by product category ID
 *         required: false
 *       - in: query
 *         name: discipline_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by discipline ID
 *         required: false
 *     responses:
 *       200:
 *         description: Products retrieved successfully
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
 *                           title:
 *                             type: string
 *                           slug:
 *                             type: string
 *                           category_id:
 *                             type: string
 *                             format: uuid
 *                           discipline_id:
 *                             type: string
 *                             format: uuid
 *                             nullable: true
 *                           description_short:
 *                             type: string
 *                             nullable: true
 *                           price:
 *                             type: number
 *                           price_type:
 *                             type: string
 *                             enum: ["per_person", "per_couple", "fixed"]
 *                           duration_hours:
 *                             type: number
 *                             nullable: true
 *                           max_participants:
 *                             type: integer
 *                           equipment_flag_discount:
 *                             type: boolean
 *                           note:
 *                             type: string
 *                             nullable: true
 *                           active:
 *                             type: boolean
 *                           featured:
 *                             type: boolean
 *                           order_position:
 *                             type: integer
 *                           school_id:
 *                             type: string
 *                             format: uuid
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                           product_categories:
 *                             type: object
 *                             nullable: true
 *                           disciplines:
 *                             type: object
 *                             nullable: true
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
      const { category_id, discipline_id, schoolId } = req.query;

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

      let query = (supabaseAdmin as any)
        .from("products")
        .select(
          `
          *,
          product_categories:category_id(*),
          disciplines:discipline_id(*)
        `,
        )
        .eq("school_id", targetSchoolId)
        .order("created_at", { ascending: false });

      if (category_id) {
        query = query.eq("category_id", category_id);
      }

      if (discipline_id) {
        query = query.eq("discipline_id", discipline_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Products query error:", error);
        throw new AppError(`Failed to fetch products: ${error.message}`, 500);
      }

      res.json({
        success: true,
        data: data || [],
        message: "Products retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create a new product
 *     description: Create a new product for a school. SCHOOL_ADMIN can create products for their own school. SUPER_ADMIN can create products for any school by providing school_id in the request body, or it will use the first available school if not provided.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, category_id, price]
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 255
 *                 example: "Private Kitesurf Lesson"
 *               slug:
 *                 type: string
 *                 pattern: "^[a-z0-9-]+$"
 *                 minLength: 2
 *                 maxLength: 255
 *                 nullable: true
 *                 example: "private-kitesurf-lesson"
 *                 description: "Auto-generated from title if not provided"
 *               category_id:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               discipline_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 example: "123e4567-e89b-12d3-a456-426614174001"
 *               description_short:
 *                 type: string
 *                 maxLength: 500
 *                 nullable: true
 *                 example: "One-on-one kitesurf lesson"
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 example: 100.00
 *               price_type:
 *                 type: string
 *                 enum: ["per_person", "per_couple", "fixed"]
 *                 example: "per_person"
 *                 default: "per_person"
 *               duration_hours:
 *                 type: number
 *                 minimum: 0
 *                 nullable: true
 *                 example: 2.5
 *               max_participants:
 *                 type: integer
 *                 minimum: 1
 *                 example: 1
 *                 default: 1
 *               equipment_flag_discount:
 *                 type: boolean
 *                 example: false
 *                 default: false
 *               note:
 *                 type: string
 *                 maxLength: 1000
 *                 nullable: true
 *                 example: "Includes equipment rental"
 *               active:
 *                 type: boolean
 *                 example: true
 *                 default: true
 *               featured:
 *                 type: boolean
 *                 example: false
 *                 default: false
 *               order_position:
 *                 type: integer
 *                 minimum: 0
 *                 example: 0
 *                 default: 0
 *               school_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 example: "123e4567-e89b-12d3-a456-426614174002"
 *                 description: "Required for SUPER_ADMIN, ignored for SCHOOL_ADMIN"
 *           example:
 *             title: "Private Kitesurf Lesson"
 *             category_id: "123e4567-e89b-12d3-a456-426614174000"
 *             discipline_id: "123e4567-e89b-12d3-a456-426614174001"
 *             description_short: "One-on-one kitesurf lesson"
 *             price: 100.00
 *             price_type: "per_person"
 *             duration_hours: 2.5
 *             max_participants: 1
 *             equipment_flag_discount: false
 *             active: true
 *             featured: false
 *     responses:
 *       201:
 *         description: Product created successfully
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
 *                         title:
 *                           type: string
 *                         slug:
 *                           type: string
 *                         category_id:
 *                           type: string
 *                           format: uuid
 *                         discipline_id:
 *                           type: string
 *                           format: uuid
 *                           nullable: true
 *                         description_short:
 *                           type: string
 *                           nullable: true
 *                         price:
 *                           type: number
 *                         price_type:
 *                           type: string
 *                         duration_hours:
 *                           type: number
 *                           nullable: true
 *                         max_participants:
 *                           type: integer
 *                         equipment_flag_discount:
 *                           type: boolean
 *                         note:
 *                           type: string
 *                           nullable: true
 *                         active:
 *                           type: boolean
 *                         featured:
 *                           type: boolean
 *                         order_position:
 *                           type: integer
 *                         school_id:
 *                           type: string
 *                           format: uuid
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                         updated_at:
 *                           type: string
 *                           format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: No school found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         $ref: '#/components/responses/ConflictError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  authenticate,
  authorizeRoles(["SUPER_ADMIN", "SCHOOL_ADMIN"]),
  validate(createProductSchema),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const {
        title,
        slug,
        category_id,
        discipline_id,
        description_short,
        price,
        price_type,
        duration_hours,
        max_participants,
        equipment_flag_discount,
        note,
        active,
        featured,
        order_position,
        school_id,
      } = req.body;

      // Determine target school_id
      let targetSchoolId: string;
      if (authReq.user.role === "SUPER_ADMIN" && school_id) {
        targetSchoolId = school_id;
      } else if (
        authReq.user.role === "SCHOOL_ADMIN" &&
        authReq.user.schoolId
      ) {
        targetSchoolId = authReq.user.schoolId;
      } else if (authReq.user.role === "SUPER_ADMIN") {
        const { data: schoolsData, error: schoolsError } = await (
          supabaseAdmin as any
        )
          .from("schools")
          .select("id")
          .limit(1);

        if (schoolsError || !schoolsData || schoolsData.length === 0) {
          throw new AppError(
            "No school found. Please provide a school_id or create a school first.",
            404,
          );
        }

        targetSchoolId = schoolsData[0].id;
      } else {
        throw new AppError("School ID is required", 400);
      }

      const finalSlug = slug || generateSlug(title);

      const { data: existingProduct } = await (supabaseAdmin as any)
        .from("products")
        .select("id")
        .eq("school_id", targetSchoolId)
        .eq("slug", finalSlug)
        .limit(1);

      if (existingProduct && existingProduct.length > 0) {
        throw new AppError(
          "A product with this slug already exists for this school",
          409,
        );
      }

      // Create the product
      const { data: newProduct, error } = await (supabaseAdmin as any)
        .from("products")
        .insert({
          school_id: targetSchoolId,
          title,
          slug: finalSlug,
          category_id,
          category: "private", // Legacy field required by migration 58
          discipline_id: discipline_id || null,
          description_short: description_short || null,
          price,
          price_type: price_type || "per_person",
          duration_hours: duration_hours || null,
          max_participants: max_participants || 1,
          equipment_flag_discount: equipment_flag_discount || false,
          note: note || null,
          active: active !== undefined ? active : true,
          featured: featured !== undefined ? featured : false,
          order_position: order_position || 0,
        })
        .select()
        .single();

      if (error) {
        throw new AppError(`Failed to create product: ${error.message}`, 500);
      }

      res.status(201).json({
        success: true,
        data: newProduct,
        message: "Product created successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update a product
 *     description: Update an existing product. SCHOOL_ADMIN can only update products from their own school. SUPER_ADMIN can update any product.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 255
 *                 example: "Private Kitesurf Lesson"
 *               slug:
 *                 type: string
 *                 pattern: "^[a-z0-9-]+$"
 *                 minLength: 2
 *                 maxLength: 255
 *                 nullable: true
 *                 example: "private-kitesurf-lesson"
 *               category_id:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               discipline_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 example: "123e4567-e89b-12d3-a456-426614174001"
 *               description_short:
 *                 type: string
 *                 maxLength: 500
 *                 nullable: true
 *                 example: "One-on-one kitesurf lesson"
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 example: 120.00
 *               price_type:
 *                 type: string
 *                 enum: ["per_person", "per_couple", "fixed"]
 *                 example: "per_person"
 *               duration_hours:
 *                 type: number
 *                 minimum: 0
 *                 nullable: true
 *                 example: 3.0
 *               max_participants:
 *                 type: integer
 *                 minimum: 1
 *                 example: 1
 *               equipment_flag_discount:
 *                 type: boolean
 *                 example: true
 *               note:
 *                 type: string
 *                 maxLength: 1000
 *                 nullable: true
 *                 example: "Includes equipment rental"
 *               active:
 *                 type: boolean
 *                 example: true
 *               featured:
 *                 type: boolean
 *                 example: true
 *               order_position:
 *                 type: integer
 *                 minimum: 0
 *                 example: 1
 *           example:
 *             title: "Private Kitesurf Lesson"
 *             price: 120.00
 *             duration_hours: 3.0
 *             featured: true
 *     responses:
 *       200:
 *         description: Product updated successfully
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
  validate(updateProductSchema),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { id } = req.params;
      const {
        title,
        slug,
        category_id,
        discipline_id,
        description_short,
        price,
        price_type,
        duration_hours,
        max_participants,
        equipment_flag_discount,
        note,
        active,
        featured,
        order_position,
      } = req.body;

      // Check if product exists
      const { data: product, error: fetchError } = await (supabaseAdmin as any)
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !product) {
        throw new AppError("Product not found", 404);
      }

      // Check if SCHOOL_ADMIN is trying to update a product from another school
      if (
        authReq.user.role === "SCHOOL_ADMIN" &&
        product.school_id !== authReq.user.schoolId
      ) {
        throw new AppError("Access denied to this school", 403);
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (title !== undefined) updateData.title = title;
      if (slug !== undefined) updateData.slug = slug;
      if (category_id !== undefined) updateData.category_id = category_id;
      if (discipline_id !== undefined)
        updateData.discipline_id = discipline_id || null;
      if (description_short !== undefined)
        updateData.description_short = description_short || null;
      if (price !== undefined) updateData.price = price;
      if (price_type !== undefined) updateData.price_type = price_type;
      if (duration_hours !== undefined)
        updateData.duration_hours = duration_hours || null;
      if (max_participants !== undefined)
        updateData.max_participants = max_participants;
      if (equipment_flag_discount !== undefined)
        updateData.equipment_flag_discount = equipment_flag_discount;
      if (note !== undefined) updateData.note = note || null;
      if (active !== undefined) updateData.active = active;
      if (featured !== undefined) updateData.featured = featured;
      if (order_position !== undefined)
        updateData.order_position = order_position;

      if (slug) {
        const { data: existingProduct } = await (supabaseAdmin as any)
          .from("products")
          .select("id")
          .eq("school_id", product.school_id)
          .eq("slug", slug)
          .neq("id", id)
          .limit(1);

        if (existingProduct && existingProduct.length > 0) {
          throw new AppError(
            "A product with this slug already exists for this school",
            409,
          );
        }
      }

      // Update product
      const { data: updatedProduct, error } = await (supabaseAdmin as any)
        .from("products")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw new AppError(`Failed to update product: ${error.message}`, 500);
      }

      res.json({
        success: true,
        data: updatedProduct,
        message: "Product updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete a product
 *     description: Delete a product. Cannot delete if the product is used in any lessons. SCHOOL_ADMIN can only delete products from their own school. SUPER_ADMIN can delete any product.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Product deleted successfully"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: Cannot delete product that is used in lessons
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Cannot delete product that is used in lessons"
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

      const { data: product, error: fetchError } = await (supabaseAdmin as any)
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !product) {
        throw new AppError("Product not found", 404);
      }

      // Check if SCHOOL_ADMIN is trying to delete a product from another school
      if (
        authReq.user.role === "SCHOOL_ADMIN" &&
        product.school_id !== authReq.user.schoolId
      ) {
        throw new AppError("Access denied to this school", 403);
      }

      // Check if product is used in lessons
      const { data: lessons, error: lessonsError } = await (
        supabaseAdmin as any
      )
        .from("lessons")
        .select("id")
        .eq("product_id", id)
        .limit(1);

      if (lessonsError) {
        throw new AppError(
          `Failed to check product usage: ${lessonsError.message}`,
          500,
        );
      }

      if (lessons && lessons.length > 0) {
        throw new AppError(
          "Cannot delete product that is used in lessons",
          409,
        );
      }

      // Delete the product
      const { error } = await (supabaseAdmin as any)
        .from("products")
        .delete()
        .eq("id", id);

      if (error) {
        throw new AppError(`Failed to delete product: ${error.message}`, 500);
      }

      res.json({
        success: true,
        message: "Product deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/products/{id}/toggle-status:
 *   patch:
 *     summary: Toggle product active status
 *     description: Toggle the active/inactive status of a product. SCHOOL_ADMIN can only toggle products from their own school. SUPER_ADMIN can toggle any product.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Product status toggled successfully
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
 *                         active:
 *                           type: boolean
 *             example:
 *               success: true
 *               message: "Product activated successfully"
 *               data:
 *                 id: "123e4567-e89b-12d3-a456-426614174000"
 *                 active: true
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

      const { data: product, error: fetchError } = await (supabaseAdmin as any)
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !product) {
        throw new AppError("Product not found", 404);
      }

      if (
        authReq.user.role === "SCHOOL_ADMIN" &&
        product.school_id !== authReq.user.schoolId
      ) {
        throw new AppError("Access denied to this school", 403);
      }

      const { data: updatedProduct, error: updateError } = await (
        supabaseAdmin as any
      )
        .from("products")
        .update({
          active: !product.active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        throw new AppError(
          `Failed to toggle product status: ${updateError.message}`,
          500,
        );
      }

      res.json({
        success: true,
        data: updatedProduct,
        message: `Product ${updatedProduct.active ? "activated" : "deactivated"} successfully`,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
