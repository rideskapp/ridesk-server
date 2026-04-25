import { Router } from "express";
import { authenticate, authorizeRoles } from "../middleware/auth";
import { supabaseAdmin } from "../database/supabase";
import { AppError, AuthenticatedRequest } from "../types";
import Joi from "joi";

const router = Router();

const createBookingSchema = Joi.object({
  product_id: Joi.string().uuid().required(),
  student_id: Joi.string().uuid().optional(),
  student_ids: Joi.array().items(Joi.string().uuid()).min(1).optional(),
  start_date: Joi.string().isoDate().required(),
  end_date: Joi.string().isoDate().optional().allow(null),
  notes: Joi.string().allow("").max(1000).optional(),
  total_price: Joi.number().min(0).optional(),
  discount_amount: Joi.number().min(0).optional(),
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

const updateBookingSchema = Joi.object({
  product_id: Joi.string().uuid().optional(),
  student_ids: Joi.array().items(Joi.string().uuid()).min(1).optional(),
  start_date: Joi.string().isoDate().optional(),
  end_date: Joi.string().isoDate().optional().allow(null),
  status: Joi.string().valid("active", "completed", "cancelled").optional(),
  notes: Joi.string().allow("").max(1000).optional(),
  total_price: Joi.number().min(0).optional(),
  discount_amount: Joi.number().min(0).optional(),
}).min(1);

const bookingPaymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  payment_date: Joi.string().isoDate().required(),
  payment_method: Joi.string().max(120).optional().allow("", null),
  notes: Joi.string().max(1000).optional().allow("", null),
});

const computeBookingFinancials = async (
  schoolId: string,
  bookings: any[],
): Promise<Map<string, { paidTotal: number; outstanding: number; paymentStatus: string }>> => {
  const bookingIds = bookings.map((b: any) => b.id).filter(Boolean);
  const financialMap = new Map<
    string,
    { paidTotal: number; outstanding: number; paymentStatus: string }
  >();
  if (bookingIds.length === 0) return financialMap;

  const { data: paymentRows, error: paymentRowsError } = await (supabaseAdmin as any)
    .from("booking_payments")
    .select("booking_id, amount")
    .eq("school_id", schoolId)
    .in("booking_id", bookingIds);
  if (paymentRowsError) {
    throw new AppError(
      `Failed to load booking payment history: ${paymentRowsError.message}`,
      500,
    );
  }

  const paidMap = new Map<string, number>();
  for (const row of paymentRows || []) {
    const current = paidMap.get(row.booking_id) || 0;
    paidMap.set(row.booking_id, current + Number(row.amount || 0));
  }

  for (const booking of bookings) {
    const paidTotal = paidMap.get(booking.id) || 0;
    const finalPrice = Number(booking.final_price || 0);
    const outstanding = Math.max(0, finalPrice - paidTotal);
    const paymentStatus =
      outstanding <= 0 ? "paid" : paidTotal > 0 ? "partially_paid" : "unpaid";
    financialMap.set(booking.id, { paidTotal, outstanding, paymentStatus });
  }
  return financialMap;
};

const applyComputedFinancials = (
  bookings: any[],
  financialMap: Map<string, { paidTotal: number; outstanding: number; paymentStatus: string }>,
) => {
  for (const booking of bookings) {
    const computed = financialMap.get(booking.id);
    if (!computed) continue;
    booking.outstanding_amount = computed.outstanding;
    booking.payment_status = computed.paymentStatus;
    if ("amount_paid" in booking) {
      delete booking.amount_paid;
    }
  }
};

/**
 * @swagger
 * /api/bookings:
 *   post:
 *     summary: Create a new booking
 *     description: |
 *       Create a new booking for one or more students with a product.
 *       Either student_id (single student) or student_ids (multiple students) must be provided.
 *       SUPER_ADMIN can create bookings for any school by providing schoolId query parameter.
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: schoolId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID (required for SUPER_ADMIN, optional for SCHOOL_ADMIN)
 *         required: false
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBookingRequest'
 *           example:
 *             product_id: "123e4567-e89b-12d3-a456-426614174000"
 *             student_ids: ["123e4567-e89b-12d3-a456-426614174001", "123e4567-e89b-12d3-a456-426614174002"]
 *             start_date: "2024-01-15"
 *             end_date: "2024-01-20"
 *             notes: "Special instructions for this booking"
 *     responses:
 *       201:
 *         description: Booking created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Booking'
 *             example:
 *               success: true
 *               message: "Booking created successfully"
 *               data:
 *                 id: "123e4567-e89b-12d3-a456-426614174000"
 *                 school_id: "123e4567-e89b-12d3-a456-426614174001"
 *                 product_id: "123e4567-e89b-12d3-a456-426614174002"
 *                 total_minutes: 1800
 *                 remaining_minutes: 1800
 *                 start_date: "2024-01-15"
 *                 end_date: "2024-01-20"
 *                 status: "active"
 *                 notes: "Special instructions for this booking"
 *                 created_by: "123e4567-e89b-12d3-a456-426614174003"
 *                 created_at: "2024-01-01T00:00:00.000Z"
 *                 updated_at: "2024-01-01T00:00:00.000Z"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Product not found for this school
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Product not found for this school"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { error: validationError, value: body } =
        createBookingSchema.validate(req.body, {
          abortEarly: false,
          convert: true,
        });
      if (validationError) {
        throw new AppError(validationError.message, 400);
      }

      const schoolId =
        authReq.user["role"] === "SUPER_ADMIN" &&
        (req.query["schoolId"] as string)
          ? (req.query["schoolId"] as string)
          : authReq.user["schoolId"];

      if (!schoolId) {
        throw new AppError("School ID is required", 400);
      }

      const studentIds: string[] = body.student_ids
        ? Array.isArray(body.student_ids)
          ? body.student_ids
          : [body.student_ids]
        : body.student_id
          ? [body.student_id]
          : [];

      const { data: memberships, error: membershipsErr } = await (
        supabaseAdmin as any
      )
        .from("student_schools")
        .select("student_id, skill_level")
        .in("student_id", studentIds)
        .eq("school_id", schoolId)
        .eq("is_active", true);
      if (membershipsErr) {
        throw new AppError(
          `Failed to validate student memberships: ${membershipsErr.message}`,
          500,
        );
      }
      if (!memberships || memberships.length !== studentIds.length) {
        throw new AppError(
          "One or more students are invalid for this school",
          400,
        );
      }

      const { data: students, error: studentsErr } = await (supabaseAdmin as any)
        .from("users")
        .select("id, first_name, last_name")
        .in("id", studentIds)
        .eq("role", "USER");
      if (studentsErr) {
        throw new AppError(
          `Failed to load students: ${studentsErr.message}`,
          500,
        );
      }

      const membershipByStudentId = new Map<string, any>(
        (memberships || []).map((m: any) => [m.student_id, m]),
      );

      // Validate all students have skill level set
      const studentsWithoutLevel = students.filter(
        (s: any) => {
          const skillLevel = membershipByStudentId.get(s.id)?.skill_level;
          return !skillLevel || String(skillLevel).trim() === "";
        },
      );
      if (studentsWithoutLevel.length > 0) {
        const studentNames = studentsWithoutLevel
          .map(
            (s: any) =>
              `${s.first_name || ""} ${s.last_name || ""}`.trim() || "Unknown",
          )
          .join(", ");
        throw new AppError(
          `Cannot create booking: The following student(s) must have a skill level set: ${studentNames}. Please update their profile first.`,
          400,
        );
      }

      // Load products
      const { data: product, error: productErr } = await (supabaseAdmin as any)
        .from("products")
        .select("id, school_id, duration_hours, price")
        .eq("id", body.product_id)
        .maybeSingle();
      if (productErr) {
        throw new AppError(
          `Failed to fetch product: ${productErr.message}`,
          500,
        );
      }
      if (!product || product.school_id !== schoolId) {
        throw new AppError("Product not found for this school", 404);
      }

      const totalMinutes = Math.max(
        0,
        Math.round((product.duration_hours || 0) * 60),
      );
      const totalPrice = Math.max(0, Number(body.total_price ?? product.price ?? 0));
      const discountAmount = Math.max(0, Number(body.discount_amount ?? 0));
      const finalPrice = Math.max(0, totalPrice - discountAmount);

      let endDate = body.end_date;
      if (!endDate) {
        // Default to December 31st of current year
        const currentYear = new Date().getFullYear();
        endDate = `${currentYear}-12-31`;
      }

      const insertData = {
        school_id: schoolId,
        product_id: body.product_id,
        total_minutes: totalMinutes,
        remaining_minutes: totalMinutes,
        start_date: body.start_date,
        end_date: endDate,
        status: "active",
        notes: body.notes || "",
        total_price: totalPrice,
        discount_amount: discountAmount,
        final_price: finalPrice,
        outstanding_amount: finalPrice,
        payment_status: finalPrice <= 0 ? "paid" : "unpaid",
        created_by: authReq.user["id"],
      };

      const { data: booking, error: bookingErr } = await (supabaseAdmin as any)
        .from("bookings")
        .insert(insertData)
        .select("*")
        .single();
      if (bookingErr) {
        throw new AppError(
          `Failed to create booking: ${bookingErr.message}`,
          500,
        );
      }

      // Insert participants
      const participants = studentIds.map((sid) => ({
        booking_id: booking.id,
        student_id: sid,
      }));
      if (participants.length > 0) {
        const { error: partErr } = await (supabaseAdmin as any)
          .from("booking_participants")
          .insert(participants);
        if (partErr) {
          console.warn("Failed to create booking participants", partErr);
        }
      }

      const financialMap = await computeBookingFinancials(schoolId, [booking]);
      applyComputedFinancials([booking], financialMap);
      return res.status(201).json({
        success: true,
        data: booking,
        message: "Booking created successfully",
      });
    } catch (err) {
      return next(err);
    }
  },
);

/**
 * @swagger
 * /api/bookings:
 *   get:
 *     summary: Get all bookings
 *     description: |
 *       Retrieve all bookings for the school with optional filtering.
 *       SUPER_ADMIN can view bookings for any school by providing schoolId query parameter.
 *       Supports filtering by status, productId, date range, studentId, and search by student name or product title.
 *       When studentId is provided, only returns active bookings with remaining_minutes > 0.
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: schoolId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID (required for SUPER_ADMIN, optional for SCHOOL_ADMIN)
 *         required: false
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, cancelled]
 *         description: Filter by booking status
 *         required: false
 *       - in: query
 *         name: productId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by product ID
 *         required: false
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by student ID (returns only active bookings with remaining hours for this student)
 *         required: false
 *       - in: query
 *         name: activeOnly
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: When studentId is provided; if 'false', return all bookings for the student (including completed/used); otherwise only active with remaining_minutes > 0. Default true.
 *         required: false
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by student name or product title
 *         required: false
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date (requires endDate)
 *         required: false
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date (requires startDate)
 *         required: false
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *         required: false
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 10
 *         description: Number of bookings per page
 *         required: false
 *     responses:
 *       200:
 *         description: Bookings retrieved successfully
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
 *                         bookings:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Booking'
 *                         pagination:
 *                           type: object
 *                           properties:
 *                             page:
 *                               type: integer
 *                             limit:
 *                               type: integer
 *                             total:
 *                               type: integer
 *                             totalPages:
 *                               type: integer
 *             example:
 *               success: true
 *               message: "Bookings retrieved successfully"
 *               data:
 *                 bookings:
 *                   - id: "123e4567-e89b-12d3-a456-426614174000"
 *                     school_id: "123e4567-e89b-12d3-a456-426614174001"
 *                     product_id: "123e4567-e89b-12d3-a456-426614174002"
 *                     total_minutes: 1800
 *                     remaining_minutes: 1800
 *                     start_date: "2024-01-15"
 *                     end_date: "2024-01-20"
 *                     status: "active"
 *                     notes: "Special instructions"
 *                     created_by: "123e4567-e89b-12d3-a456-426614174003"
 *                     created_at: "2024-01-01T00:00:00.000Z"
 *                     updated_at: "2024-01-01T00:00:00.000Z"
 *                     products:
 *                       id: "123e4567-e89b-12d3-a456-426614174002"
 *                       title: "10-Hour Package"
 *                       duration_hours: 30
 *                     participants:
 *                       - id: "123e4567-e89b-12d3-a456-426614174004"
 *                         student_id: "123e4567-e89b-12d3-a456-426614174005"
 *                         users:
 *                           first_name: "John"
 *                           last_name: "Doe"
 *                 pagination:
 *                   page: 1
 *                   limit: 10
 *                   total: 25
 *                   totalPages: 3
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
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const {
        status,
        productId,
        search,
        startDate,
        endDate,
        studentId,
        page,
        limit,
      } = req.query as Record<string, string>;

      const schoolId =
        authReq.user["role"] === "SUPER_ADMIN" &&
        (req.query["schoolId"] as string)
          ? (req.query["schoolId"] as string)
          : authReq.user["schoolId"];
      if (!schoolId) {
        throw new AppError("School ID is required", 400);
      }

      // Parse pagination parameters
      const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;
      const limitNum = limit
        ? Math.min(1000, Math.max(1, parseInt(limit, 10)))
        : 10;

      let query = (supabaseAdmin as any)
        .from("bookings")
        .select(
          `
          *,
          products:product_id(id, title, duration_hours, product_categories:category_id(associable_to_lessons), disciplines:discipline_id(id, slug, display_name, color))
        `,
        )
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });

      if (status) query = query.eq("status", status);
      if (productId) query = query.eq("product_id", productId);
      if (startDate && endDate) {
        query = query.lte("start_date", endDate).gte("end_date", startDate);
      }

      // Filter by studentId if provided
      if (studentId) {
        const { data: studentMembership, error: studentError } = await (
          supabaseAdmin as any
        )
          .from("student_schools")
          .select("id")
          .eq("student_id", studentId)
          .eq("school_id", schoolId)
          .eq("is_active", true)
          .maybeSingle();

        if (studentError || !studentMembership) {
          throw new AppError("Student not found in this school", 404);
        }

        const { data: participantBookings, error: participantError } = await (
          supabaseAdmin as any
        )
          .from("booking_participants")
          .select("booking_id")
          .eq("student_id", studentId);

        if (participantError) {
          throw new AppError(
            `Failed to filter by student: ${participantError.message}`,
            500,
          );
        }

        const bookingIds = (participantBookings || []).map(
          (p: any) => p.booking_id,
        );
        if (bookingIds.length > 0) {
          query = query.in("id", bookingIds);
        } else {
          return res.json({
            success: true,
            data: {
              bookings: [],
              pagination: {
                page: pageNum,
                limit: limitNum,
                total: 0,
                totalPages: 0,
              },
            },
            message: "Bookings retrieved successfully",
          });
        }
      }

      const { data, error } = await query;
      if (error) {
        throw new AppError(`Failed to list bookings: ${error.message}`, 500);
      }

      // Filter by remaining_minutes > 0 and status = 'active' when studentId is provided (unless activeOnly=false)
      let filtered = data || [];
      const activeOnly =
        studentId && (req.query["activeOnly"] as string) !== "false";
      if (studentId && activeOnly) {
        filtered = filtered.filter(
          (b: any) => b.status === "active" && b.remaining_minutes > 0,
        );
      }

      // Two-query merge: fetch booking_participants for filtered bookings and attach
      const bookingIds = filtered.map((b: any) => b.id).filter(Boolean);
      const partMap = new Map<string, any[]>();
      if (bookingIds.length > 0) {
        const { data: participantsRows } = await (supabaseAdmin as any)
          .from("booking_participants")
          .select(
            "booking_id, id, student_id, users:users!fk_booking_participants_student(first_name, last_name)",
          )
          .in("booking_id", bookingIds);
        for (const p of participantsRows || []) {
          const arr = partMap.get(p.booking_id) || [];
          arr.push({ id: p.id, student_id: p.student_id, users: p.users });
          partMap.set(p.booking_id, arr);
        }
      }
      for (const b of filtered) {
        b.participants = partMap.get(b.id) || [];
      }

      // Apply search filter
      filtered = filtered.filter((b: any) => {
        if (!search) return true;
        const studentNames =
          b.participants
            ?.map(
              (p: any) =>
                `${p.users?.first_name || ""} ${p.users?.last_name || ""}`,
            )
            ?.join(" ") || "";
        const productTitle = b.products?.title || "";
        const hay = `${studentNames} ${productTitle}`.toLowerCase();
        return hay.includes(search.toLowerCase());
      });

      // Apply pagination
      const total = filtered.length;
      const offset = (pageNum - 1) * limitNum;
      const paginated = filtered.slice(offset, offset + limitNum);
      const totalPages = Math.ceil(total / limitNum);

      // Attach lessons_count per booking
      const paginatedIds = paginated.map((b: any) => b.id).filter(Boolean);
      const lessonsCountMap = new Map<string, number>();
      if (paginatedIds.length > 0) {
        const { data: lessonsRows } = await (supabaseAdmin as any)
          .from("lessons")
          .select("booking_id")
          .in("booking_id", paginatedIds);
        for (const r of lessonsRows || []) {
          if (r.booking_id) {
            lessonsCountMap.set(
              r.booking_id,
              (lessonsCountMap.get(r.booking_id) || 0) + 1,
            );
          }
        }
        for (const b of paginated) {
          b.lessons_count = lessonsCountMap.get(b.id) || 0;
        }
      }

      const financialMap = await computeBookingFinancials(schoolId, paginated);
      applyComputedFinancials(paginated, financialMap);

      return res.json({
        success: true,
        data: {
          bookings: paginated,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
          },
        },
        message: "Bookings retrieved successfully",
      });
    } catch (err) {
      return next(err);
    }
  },
);

/**
 * @swagger
 * /api/bookings/{id}:
 *   get:
 *     summary: Get booking by ID
 *     description: |
 *       Retrieve a specific booking by its ID.
 *       SUPER_ADMIN can view bookings for any school by providing schoolId query parameter.
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Booking ID
 *       - in: query
 *         name: schoolId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID (required for SUPER_ADMIN, optional for SCHOOL_ADMIN)
 *         required: false
 *     responses:
 *       200:
 *         description: Booking retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Booking'
 *             example:
 *               success: true
 *               message: "Booking retrieved successfully"
 *               data:
 *                 id: "123e4567-e89b-12d3-a456-426614174000"
 *                 school_id: "123e4567-e89b-12d3-a456-426614174001"
 *                 product_id: "123e4567-e89b-12d3-a456-426614174002"
 *                 total_minutes: 1800
 *                 remaining_minutes: 1800
 *                 start_date: "2024-01-15"
 *                 end_date: "2024-01-20"
 *                 status: "active"
 *                 notes: "Special instructions"
 *                 created_by: "123e4567-e89b-12d3-a456-426614174003"
 *                 created_at: "2024-01-01T00:00:00.000Z"
 *                 updated_at: "2024-01-01T00:00:00.000Z"
 *                 products:
 *                   id: "123e4567-e89b-12d3-a456-426614174002"
 *                   title: "10-Hour Package"
 *                   duration_hours: 30
 *                 participants:
 *                   - id: "123e4567-e89b-12d3-a456-426614174004"
 *                     student_id: "123e4567-e89b-12d3-a456-426614174005"
 *                     users:
 *                       first_name: "John"
 *                       last_name: "Doe"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Booking not found"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/:id",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const schoolId =
        authReq.user["role"] === "SUPER_ADMIN" &&
        (req.query["schoolId"] as string)
          ? (req.query["schoolId"] as string)
          : authReq.user["schoolId"];
      if (!schoolId) {
        throw new AppError("School ID is required", 400);
      }

      const { data, error } = await (supabaseAdmin as any)
        .from("bookings")
        .select(
          `
          *,
          products:product_id(id, title, duration_hours, product_categories:category_id(associable_to_lessons), disciplines:discipline_id(id, slug, display_name, color))
        `,
        )
        .eq("school_id", schoolId)
        .eq("id", req.params["id"])
        .maybeSingle();

      if (error) {
        throw new AppError(`Failed to get booking: ${error.message}`, 500);
      }
      if (!data) {
        return res
          .status(404)
          .json({ success: false, error: "Booking not found" });
      }

      // Two-query merge: fetch booking_participants for this booking and attach
      const { data: participantsRows } = await (supabaseAdmin as any)
        .from("booking_participants")
        .select(
          "booking_id, id, student_id, users:users!fk_booking_participants_student(first_name, last_name)",
        )
        .eq("booking_id", data.id);
      data.participants = (participantsRows || []).map((p: any) => ({
        id: p.id,
        student_id: p.student_id,
        users: p.users,
      }));

      // Attach lessons_count
      const { count: lessonsCount } = await (supabaseAdmin as any)
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("booking_id", data.id);
      data.lessons_count = lessonsCount ?? 0;

      const financialMap = await computeBookingFinancials(schoolId, [data]);
      applyComputedFinancials([data], financialMap);

      return res.json({
        success: true,
        data,
        message: "Booking retrieved successfully",
      });
    } catch (err) {
      return next(err);
    }
  },
);

/**
 * @swagger
 * /api/bookings/{id}:
 *   patch:
 *     summary: Update a booking
 *     description: |
 *       Update a booking. Only allowed when no lessons have been scheduled for this booking.
 *       SCHOOL_ADMIN can only update bookings from their own school. SUPER_ADMIN can update any booking by providing schoolId query parameter.
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Booking ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *       - in: query
 *         name: schoolId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID (required for SUPER_ADMIN, optional for SCHOOL_ADMIN. SCHOOL_ADMIN cannot query other schools)
 *         required: false
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               product_id:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174002"
 *               student_ids:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 example: ["123e4567-e89b-12d3-a456-426614174001", "123e4567-e89b-12d3-a456-426614174002"]
 *               start_date:
 *                 type: string
 *                 format: date
 *                 example: "2024-01-15"
 *               end_date:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 example: "2024-01-20"
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 nullable: true
 *                 example: "Updated notes"
 *           example:
 *             product_id: "123e4567-e89b-12d3-a456-426614174002"
 *             student_ids: ["123e4567-e89b-12d3-a456-426614174001"]
 *             start_date: "2024-01-15"
 *             end_date: "2024-01-20"
 *             notes: "Updated notes"
 *     responses:
 *       200:
 *         description: Booking updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Cannot edit when lessons exist or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Cannot update booking: lessons have already been scheduled"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Booking not found"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch(
  "/:id",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { error: validationError, value: body } =
        updateBookingSchema.validate(req.body, {
          abortEarly: false,
          convert: true,
        });
      if (validationError) {
        throw new AppError(validationError.message, 400);
      }

      const schoolId =
        authReq.user["role"] === "SUPER_ADMIN" &&
        (req.query["schoolId"] as string)
          ? (req.query["schoolId"] as string)
          : authReq.user["schoolId"];
      if (!schoolId) {
        throw new AppError("School ID is required", 400);
      }

      const bookingId = req.params["id"];

      // Load booking and verify school
      const { data: booking, error: bookingErr } = await (supabaseAdmin as any)
        .from("bookings")
        .select(
          "id, school_id, product_id, total_minutes, total_price, discount_amount",
        )
        .eq("school_id", schoolId)
        .eq("id", bookingId)
        .maybeSingle();
      if (bookingErr) {
        throw new AppError(`Failed to get booking: ${bookingErr.message}`, 500);
      }
      if (!booking) {
        return res
          .status(404)
          .json({ success: false, error: "Booking not found" });
      }

      const { data: lessonRows, error: lessonRowsError } = await (
        supabaseAdmin as any
      )
        .from("lessons")
        .select("duration")
        .eq("booking_id", bookingId);
      if (lessonRowsError) {
        throw new AppError(
          `Failed to load booking lessons: ${lessonRowsError.message}`,
          500,
        );
      }
      const consumedMinutes = (lessonRows || []).reduce(
        (sum: number, row: any) => sum + Number(row.duration || 0),
        0,
      );

      const updateObj: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (body["start_date"] !== undefined)
        updateObj["start_date"] = body["start_date"];
      if (body["end_date"] !== undefined)
        updateObj["end_date"] = body["end_date"];
      if (body["notes"] !== undefined) updateObj["notes"] = body["notes"] || "";
      if (body["status"] !== undefined) updateObj["status"] = body["status"];
      if (body["total_price"] !== undefined)
        updateObj["total_price"] = Math.max(0, Number(body["total_price"]));
      if (body["discount_amount"] !== undefined)
        updateObj["discount_amount"] = Math.max(0, Number(body["discount_amount"]));

      if (body["product_id"] !== undefined) {
        const { data: product, error: productErr } = await (
          supabaseAdmin as any
        )
          .from("products")
          .select("id, school_id, duration_hours, price")
          .eq("id", body["product_id"])
          .maybeSingle();
        if (productErr) {
          throw new AppError(
            `Failed to fetch product: ${productErr.message}`,
            500,
          );
        }
        if (!product || product.school_id !== schoolId) {
          throw new AppError("Product not found for this school", 404);
        }
        const totalMinutes = Math.max(
          0,
          Math.round((product.duration_hours || 0) * 60),
        );
        updateObj["product_id"] = body["product_id"];
        updateObj["total_minutes"] = totalMinutes;
        if (body["total_price"] === undefined) {
          updateObj["total_price"] = Math.max(0, Number(product.price || 0));
        }
      }

      const effectiveTotalMinutes = Number(
        updateObj["total_minutes"] ?? (booking as any).total_minutes ?? 0,
      );
      if (effectiveTotalMinutes < consumedMinutes) {
        throw new AppError(
          `Cannot reduce booking duration below consumed lesson time. Consumed: ${Math.round((consumedMinutes / 60) * 100) / 100}h, New total: ${Math.round((effectiveTotalMinutes / 60) * 100) / 100}h.`,
          400,
        );
      }
      updateObj["remaining_minutes"] = Math.max(
        0,
        effectiveTotalMinutes - consumedMinutes,
      );

      const { data: paymentRows, error: paymentRowsError } = await (supabaseAdmin as any)
        .from("booking_payments")
        .select("amount")
        .eq("booking_id", bookingId)
        .eq("school_id", schoolId);
      if (paymentRowsError) {
        throw new AppError(
          `Failed to recalculate booking payments: ${paymentRowsError.message}`,
          500,
        );
      }
      const recomputedAmountPaid = (paymentRows || []).reduce(
        (sum: number, row: any) => sum + Number(row.amount || 0),
        0,
      );

      const effectiveTotalPrice = Number(
        updateObj["total_price"] ?? (booking as any).total_price ?? 0,
      );
      const effectiveDiscountAmount = Number(
        updateObj["discount_amount"] ?? (booking as any).discount_amount ?? 0,
      );
      const finalPrice = Math.max(0, effectiveTotalPrice - effectiveDiscountAmount);
      const outstanding = Math.max(0, finalPrice - recomputedAmountPaid);
      updateObj["final_price"] = finalPrice;
      updateObj["outstanding_amount"] = outstanding;
      updateObj["payment_status"] =
        outstanding <= 0
          ? "paid"
          : recomputedAmountPaid > 0
            ? "partially_paid"
            : "unpaid";

      const { error: updateErr } = await (supabaseAdmin as any)
        .from("bookings")
        .update(updateObj)
        .eq("id", bookingId)
        .eq("school_id", schoolId);
      if (updateErr) {
        throw new AppError(
          `Failed to update booking: ${updateErr.message}`,
          500,
        );
      }

      if (body.student_ids !== undefined) {
        const studentIds: string[] = body.student_ids;
        const { data: memberships, error: studentsErr } = await (
          supabaseAdmin as any
        )
          .from("student_schools")
          .select("student_id")
          .in("student_id", studentIds)
          .eq("school_id", schoolId)
          .eq("is_active", true);
        if (studentsErr) {
          throw new AppError(
            `Failed to validate student memberships: ${studentsErr.message}`,
            500,
          );
        }
        if (!memberships || memberships.length !== studentIds.length) {
          throw new AppError(
            "One or more students are invalid for this school",
            400,
          );
        }

        const { error: delErr } = await (supabaseAdmin as any)
          .from("booking_participants")
          .delete()
          .eq("booking_id", bookingId);
        if (delErr) {
          throw new AppError(
            `Failed to update participants: ${delErr.message}`,
            500,
          );
        }

        const participants = studentIds.map((sid: string) => ({
          booking_id: bookingId,
          student_id: sid,
        }));
        if (participants.length > 0) {
          const { error: insErr } = await (supabaseAdmin as any)
            .from("booking_participants")
            .insert(participants);
          if (insErr) {
            throw new AppError(
              `Failed to create participants: ${insErr.message}`,
              500,
            );
          }
        }
      }

      // Return updated booking in same shape as GET :id
      const { data: updated, error: fetchErr } = await (supabaseAdmin as any)
        .from("bookings")
        .select(
          `
          *,
          products:product_id(id, title, duration_hours, product_categories:category_id(associable_to_lessons), disciplines:discipline_id(id, slug, display_name, color))
        `,
        )
        .eq("school_id", schoolId)
        .eq("id", bookingId)
        .single();
      if (fetchErr || !updated) {
        throw new AppError(
          `Failed to fetch updated booking: ${fetchErr?.message || "unknown"}`,
          500,
        );
      }

      const { data: participantsRows } = await (supabaseAdmin as any)
        .from("booking_participants")
        .select(
          "booking_id, id, student_id, users:users!fk_booking_participants_student(first_name, last_name)",
        )
        .eq("booking_id", bookingId);
      updated.participants = (participantsRows || []).map((p: any) => ({
        id: p.id,
        student_id: p.student_id,
        users: p.users,
      }));

      const { count: lessonsCount } = await (supabaseAdmin as any)
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("booking_id", bookingId);
      updated.lessons_count = lessonsCount ?? 0;

      const financialMap = await computeBookingFinancials(schoolId, [updated]);
      applyComputedFinancials([updated], financialMap);

      return res.json({
        success: true,
        data: updated,
        message: "Booking updated successfully",
      });
    } catch (err) {
      return next(err);
    }
  },
);

/**
 * @swagger
 * /api/bookings/{id}/payments:
 *   get:
 *     summary: Get payment history for a booking
 *     description: |
 *       Returns payment ledger entries for a booking ordered by payment date (newest first).
 *       SCHOOL_ADMIN can access bookings from their own school. SUPER_ADMIN can access any school by providing schoolId query parameter.
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Booking ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *       - in: query
 *         name: schoolId
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID (used by SUPER_ADMIN to target a specific school)
 *         example: "123e4567-e89b-12d3-a456-426614174001"
 *     responses:
 *       200:
 *         description: Payment history retrieved successfully
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
 *                           booking_id:
 *                             type: string
 *                             format: uuid
 *                           school_id:
 *                             type: string
 *                             format: uuid
 *                           amount:
 *                             type: number
 *                             example: 150
 *                           payment_date:
 *                             type: string
 *                             format: date-time
 *                           payment_method:
 *                             type: string
 *                             nullable: true
 *                             example: "card"
 *                           notes:
 *                             type: string
 *                             nullable: true
 *                             example: "Second installment"
 *                           created_by:
 *                             type: string
 *                             format: uuid
 *                             nullable: true
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Booking not found"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/:id/payments",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const schoolId =
        authReq.user["role"] === "SUPER_ADMIN" &&
        (req.query["schoolId"] as string)
          ? (req.query["schoolId"] as string)
          : authReq.user["schoolId"];
      if (!schoolId) throw new AppError("School ID is required", 400);

      const { data: booking, error: bookingError } = await (supabaseAdmin as any)
        .from("bookings")
        .select("id")
        .eq("id", req.params["id"])
        .eq("school_id", schoolId)
        .maybeSingle();
      if (bookingError) throw new AppError(bookingError.message, 500);
      if (!booking) throw new AppError("Booking not found", 404);

      const { data, error } = await (supabaseAdmin as any)
        .from("booking_payments")
        .select("*")
        .eq("booking_id", req.params["id"])
        .eq("school_id", schoolId)
        .order("payment_date", { ascending: false });
      if (error) throw new AppError(`Failed to load payments: ${error.message}`, 500);

      return res.json({ success: true, data: data || [] });
    } catch (err) {
      return next(err);
    }
  },
);

/**
 * @swagger
 * /api/bookings/{id}/payments:
 *   post:
 *     summary: Record a payment for a booking
 *     description: |
 *       Creates a booking payment and recalculates booking balances.
 *       SCHOOL_ADMIN can record payments for bookings in their own school.
 *       SUPER_ADMIN can target a school by providing schoolId query parameter.
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Booking ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *       - in: query
 *         name: schoolId
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID (used by SUPER_ADMIN to target a specific school)
 *         example: "123e4567-e89b-12d3-a456-426614174001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, payment_date]
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 description: Positive payment amount
 *                 example: 150
 *               payment_date:
 *                 type: string
 *                 format: date-time
 *                 description: Payment timestamp in ISO format
 *                 example: "2026-03-27T10:30:00.000Z"
 *               payment_method:
 *                 type: string
 *                 maxLength: 120
 *                 nullable: true
 *                 description: Optional payment method label
 *                 example: "bank_transfer"
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 nullable: true
 *                 description: Optional free-text notes
 *                 example: "Advance payment"
 *           example:
 *             amount: 150
 *             payment_date: "2026-03-27T10:30:00.000Z"
 *             payment_method: "card"
 *             notes: "Paid at reception"
 *     responses:
 *       201:
 *         description: Payment recorded successfully
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
 *                         booking_id:
 *                           type: string
 *                           format: uuid
 *                         school_id:
 *                           type: string
 *                           format: uuid
 *                         amount:
 *                           type: number
 *                           example: 150
 *                         payment_date:
 *                           type: string
 *                           format: date-time
 *                         payment_method:
 *                           type: string
 *                           nullable: true
 *                         notes:
 *                           type: string
 *                           nullable: true
 *                         created_by:
 *                           type: string
 *                           format: uuid
 *                           nullable: true
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *             example:
 *               success: true
 *               message: "Booking payment recorded successfully"
 *               data:
 *                 id: "123e4567-e89b-12d3-a456-426614174010"
 *                 booking_id: "123e4567-e89b-12d3-a456-426614174000"
 *                 school_id: "123e4567-e89b-12d3-a456-426614174001"
 *                 amount: 150
 *                 payment_date: "2026-03-27T10:30:00.000Z"
 *                 payment_method: "card"
 *                 notes: "Paid at reception"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Booking not found"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/:id/payments",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { error: validationError, value: body } = bookingPaymentSchema.validate(
        req.body,
        { abortEarly: false, convert: true },
      );
      if (validationError) throw new AppError(validationError.message, 400);

      const schoolId =
        authReq.user["role"] === "SUPER_ADMIN" &&
        (req.query["schoolId"] as string)
          ? (req.query["schoolId"] as string)
          : authReq.user["schoolId"];
      if (!schoolId) throw new AppError("School ID is required", 400);

      const bookingId = req.params["id"];
      const { data: booking, error: bookingError } = await (supabaseAdmin as any)
        .from("bookings")
        .select("id, school_id, final_price")
        .eq("id", bookingId)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (bookingError) throw new AppError(bookingError.message, 500);
      if (!booking) throw new AppError("Booking not found", 404);

      const { data: payment, error: paymentError } = await (supabaseAdmin as any)
        .from("booking_payments")
        .insert({
          booking_id: bookingId,
          school_id: schoolId,
          amount: body.amount,
          payment_date: body.payment_date,
          payment_method: body.payment_method || null,
          notes: body.notes || null,
          created_by: authReq.user["id"],
        })
        .select("*")
        .single();
      if (paymentError) {
        throw new AppError(`Failed to create payment: ${paymentError.message}`, 500);
      }

      const { data: paymentRows, error: paymentRowsError } = await (supabaseAdmin as any)
        .from("booking_payments")
        .select("amount")
        .eq("booking_id", bookingId)
        .eq("school_id", schoolId);
      if (paymentRowsError) {
        throw new AppError(
          `Failed to recalculate booking payments: ${paymentRowsError.message}`,
          500,
        );
      }
      const amountPaid = (paymentRows || []).reduce(
        (sum: number, row: any) => sum + Number(row.amount || 0),
        0,
      );
      const finalPrice = Number(booking.final_price || 0);
      const outstandingAmount = Math.max(0, finalPrice - amountPaid);
      const paymentStatus =
        outstandingAmount <= 0 ? "paid" : amountPaid > 0 ? "partially_paid" : "unpaid";

      const { error: updateError } = await (supabaseAdmin as any)
        .from("bookings")
        .update({
          outstanding_amount: outstandingAmount,
          payment_status: paymentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId)
        .eq("school_id", schoolId);
      if (updateError) {
        throw new AppError(`Failed to update booking balances: ${updateError.message}`, 500);
      }

      return res.status(201).json({
        success: true,
        data: payment,
        message: "Booking payment recorded successfully",
      });
    } catch (err) {
      return next(err);
    }
  },
);

/**
 * @swagger
 * /api/bookings/{id}:
 *   delete:
 *     summary: Delete a booking and all related records
 *     description: |
 *       Permanently deletes a booking and all data linked to it, including related lessons.
 *       SCHOOL_ADMIN can delete bookings from their own school.
 *       SUPER_ADMIN can delete bookings for any school by providing schoolId query parameter.
 *       This operation is destructive and cannot be undone.
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Booking ID
 *       - in: query
 *         name: schoolId
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID (required for SUPER_ADMIN, optional for SCHOOL_ADMIN)
 *     responses:
 *       200:
 *         description: Booking and related records deleted successfully
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
 *             example:
 *               success: true
 *               message: "Booking deleted successfully"
 *               data:
 *                 id: "123e4567-e89b-12d3-a456-426614174000"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Booking not found"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  "/:id",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const schoolId =
        authReq.user["role"] === "SUPER_ADMIN" &&
        (req.query["schoolId"] as string)
          ? (req.query["schoolId"] as string)
          : authReq.user["schoolId"];
      if (!schoolId) {
        throw new AppError("School ID is required", 400);
      }

      const bookingId = req.params["id"];
      const { data: booking, error: bookingErr } = await (supabaseAdmin as any)
        .from("bookings")
        .select("id")
        .eq("id", bookingId)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (bookingErr) {
        throw new AppError(`Failed to get booking: ${bookingErr.message}`, 500);
      }
      if (!booking) {
        return res
          .status(404)
          .json({ success: false, error: "Booking not found" });
      }

      const { data: lessonsRows, error: lessonsErr } = await (supabaseAdmin as any)
        .from("lessons")
        .select("id")
        .eq("booking_id", bookingId)
        .eq("school_id", schoolId);
      if (lessonsErr) {
        throw new AppError(
          `Failed to check booking lessons: ${lessonsErr.message}`,
          500,
        );
      }
      const lessonIds = (lessonsRows || []).map((lesson: any) => lesson.id).filter(Boolean);
      if (lessonIds.length > 0) {
        const { error: deleteLessonsErr } = await (supabaseAdmin as any)
          .from("lessons")
          .delete()
          .in("id", lessonIds)
          .eq("school_id", schoolId);
        if (deleteLessonsErr) {
          throw new AppError(
            `Failed to delete booking lessons: ${deleteLessonsErr.message}`,
            500,
          );
        }
      }

      const { error: deleteParticipantsErr } = await (supabaseAdmin as any)
        .from("booking_participants")
        .delete()
        .eq("booking_id", bookingId);
      if (deleteParticipantsErr) {
        throw new AppError(
          `Failed to delete booking participants: ${deleteParticipantsErr.message}`,
          500,
        );
      }

      const { error: deletePaymentsErr } = await (supabaseAdmin as any)
        .from("booking_payments")
        .delete()
        .eq("booking_id", bookingId);
      if (deletePaymentsErr) {
        throw new AppError(
          `Failed to delete booking payments: ${deletePaymentsErr.message}`,
          500,
        );
      }

      const { error: deleteBookingErr } = await (supabaseAdmin as any)
        .from("bookings")
        .delete()
        .eq("id", bookingId)
        .eq("school_id", schoolId);
      if (deleteBookingErr) {
        throw new AppError(
          `Failed to delete booking: ${deleteBookingErr.message}`,
          500,
        );
      }

      return res.json({
        success: true,
        data: { id: bookingId },
        message: "Booking deleted successfully",
      });
    } catch (err) {
      return next(err);
    }
  },
);

export default router;
