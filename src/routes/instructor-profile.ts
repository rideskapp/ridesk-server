/**
 * @fileoverview Instructor Profile Routes
 * @description Routes for instructors to manage their own profile and view their data
 * @author Ridesk Team
 * @version 1.0.0
 */

import { Router } from "express";
import { supabaseAdmin } from "../database/supabase";
import { AppError } from "../types";
import { AuthenticatedRequest } from "../types";
import { authenticate, authorizeRoles } from "../middleware/auth";
import {
  validate,
  updateInstructorProfileSchema,
} from "../middleware/validation";
import { getInstructorRates, InstructorRate } from "../services/compensation";
import {
  resolveInstructorSchoolId,
  isInstructorInSchool,
} from "../utils/instructorUtils";
import { getSchoolSettings } from "../services/schoolSettings";
import { SupabaseClient } from "@supabase/supabase-js";

const router = Router();

/**
 * Verify that an instructor belongs to a specific school
 * @param supabaseClient - Supabase admin client
 * @param instructorId - Instructor user ID
 * @param schoolId - School ID to verify
 * @returns true if instructor belongs to school, false otherwise
 */
async function verifyInstructorInSchool(
  supabaseClient: SupabaseClient<any>,
  instructorId: string,
  schoolId: string,
): Promise<boolean> {
  const { error } = await supabaseClient
    .from("instructor_schools")
    .select("school_id")
    .eq("instructor_id", instructorId)
    .eq("school_id", schoolId)
    .single();

  return !error;
}

interface UpdateInstructorProfileData {
  updated_at: string;
  first_name?: string;
  last_name?: string;
  whatsapp_number?: string | null;
  avatar?: string | null;
  specialties?: string[] | null;
  certifications?: string[] | null;
  languages?: string[] | null;
  notes?: string | null;
  is_active?: boolean;
}

/**
 * @swagger
 * /api/instructor/profile:
 *   get:
 *     summary: Get instructor's own profile
 *     description: Get the authenticated instructor's profile information
 *     tags: [Instructor Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
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
 *                       example: "Profile retrieved successfully"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/profile",
  authenticate,
  authorizeRoles(["INSTRUCTOR"]),
  async (req, res, next) => {
    try {
      const user = (req as unknown as AuthenticatedRequest).user;

      const { data: instructor, error } = await supabaseAdmin
        .from("users")
        .select(
          `
          id,
          first_name,
          last_name,
          whatsapp_number,
          avatar,
          specialties,
          certifications,
          languages,
          hourly_rate,
          commission_rate,
          is_primary,
          is_active,
          created_at,
          updated_at
        `,
        )
        .eq("id", user.id)
        .eq("role", "INSTRUCTOR")
        .single();

      if (error) {
        throw new AppError("Instructor not found", 404);
      }

      // Get instructor's school_id from instructor_schools table
      let schoolId: string | undefined;
      try {
        schoolId = (await resolveInstructorSchoolId(user.id)) || undefined;
      } catch (schoolQueryError: any) {
        console.error(
          "Exception while fetching instructor school:",
          schoolQueryError,
        );
      }

      // Fetch compensation rates
      let rates: InstructorRate[] = [];
      let ratesWarning: string | null = null;
      try {
        if (schoolId) {
          rates = await getInstructorRates(user.id, schoolId);
        }
      } catch (ratesError: any) {
        console.error("Failed to fetch instructor rates:", {
          instructorId: user.id,
          schoolId: schoolId || "undefined",
          error: ratesError.message || ratesError,
          stack: ratesError.stack,
        });
        rates = [];
        ratesWarning = "Failed to load compensation rates";
      }

      const responseData = {
        ...instructor,
        rates: Array.isArray(rates) ? rates : [],
        ...(ratesWarning && { ratesWarning }),
      };

      return res.json({
        success: true,
        data: responseData,
        message: "Profile retrieved successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/instructor/profile:
 *   put:
 *     summary: Update instructor's own profile
 *     description: Update the authenticated instructor's basic profile information (first name, last name, phone number)
 *     tags: [Instructor Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *             properties:
 *               firstName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *               lastName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *               phone:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 20
 *               avatar:
 *                 type: string
 *                 format: uri
 *               specialties:
 *                 type: array
 *                 items:
 *                   type: string
 *               certifications:
 *                 type: array
 *                 items:
 *                   type: string
 *               languages:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *                       example: "Profile updated successfully"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/profile",
  authenticate,
  authorizeRoles(["INSTRUCTOR"]),
  validate(updateInstructorProfileSchema),
  async (req, res, next) => {
    try {
      const user = (req as unknown as AuthenticatedRequest).user;
      const {
        firstName,
        lastName,
        whatsappNumber,
        avatar,
        specialties,
        certifications,
        languages,
        notes,
        isActive,
      } = req.body;

      const updateData: UpdateInstructorProfileData = {
        updated_at: new Date().toISOString(),
      };

      if (firstName !== undefined) {
        updateData.first_name = firstName;
      }
      if (lastName !== undefined) {
        updateData.last_name = lastName;
      }
      // Always update whatsapp number if it's in the request body (even if null to clear it)
      if (whatsappNumber !== undefined) {
        updateData.whatsapp_number =
          whatsappNumber && whatsappNumber.trim()
            ? whatsappNumber.trim()
            : null;
      }
      if (avatar !== undefined) {
        updateData.avatar = avatar || null;
      }
      if (specialties !== undefined) {
        updateData.specialties = specialties || null;
      }
      if (certifications !== undefined) {
        updateData.certifications = certifications || null;
      }
      if (languages !== undefined) {
        updateData.languages = languages || null;
      }
      if (notes !== undefined) {
        // Instructor profile notes remain on users.notes (separate from student_scoped notes).
        updateData.notes = notes;
      }
      if (isActive !== undefined) {
        updateData.is_active = isActive;
      }

      // Update instructor profile
      const { data: updatedInstructor, error } = await supabaseAdmin
        .from("users")
        .update(updateData)
        .eq("id", user.id)
        .eq("role", "INSTRUCTOR")
        .select(
          `
          id,
          first_name,
          last_name,
          whatsapp_number,
          avatar,
          specialties,
          certifications,
          languages,
          hourly_rate,
          commission_rate,
          is_primary,
          is_active,
          created_at,
          updated_at
        `,
        )
        .single();

      if (error) {
        console.error("Failed to update instructor profile in Supabase", {
          userId: user.id,
          error,
        });
        throw new AppError("Failed to update profile", 500);
      }

      if (!updatedInstructor) {
        throw new AppError("Instructor not found", 404);
      }

      return res.json({
        success: true,
        data: updatedInstructor,
        message: "Profile updated successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/instructor/colleagues:
 *   get:
 *     summary: Get instructor's colleagues
 *     description: Get list of other instructors in the same school
 *     tags: [Instructor Profile]
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
 *           maximum: 100
 *           default: 10
 *         description: Number of instructors per page
 *     responses:
 *       200:
 *         description: Colleagues retrieved successfully
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
 *                         instructors:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Instructor'
 *                         pagination:
 *                           $ref: '#/components/schemas/Pagination'
 *                     message:
 *                       type: string
 *                       example: "Colleagues retrieved successfully"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/colleagues",
  authenticate,
  authorizeRoles(["INSTRUCTOR"]),
  async (req, res, next) => {
    try {
      const user = (req as unknown as AuthenticatedRequest).user;
      const { page = 1, limit = 10 } = req.query;

      const schoolId = await resolveInstructorSchoolId(user.id);
      if (!schoolId) {
        return res.status(403).json({
          success: false,
          error: "User not associated with any school",
        });
      }
      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
      const offset = (pageNum - 1) * limitNum;

      // Get colleagues by joining users with instructor_schools
      const { data: colleagues, error } = await supabaseAdmin
        .from("instructor_schools")
        .select(
          `
          instructor_id,
          is_primary,
          users:instructor_id (
            id,
            first_name,
            last_name,
            whatsapp_number,
            avatar,
            specialties,
            languages,
            is_active,
            created_at
          )
        `,
        )
        .eq("school_id", schoolId)
        .neq("instructor_id", user.id) // Exclude self
        .order("users(first_name)")
        .range(offset, offset + limitNum - 1);

      if (error) {
        throw new AppError("Failed to fetch colleagues", 500);
      }

      // Get total count
      const { count, error: countError } = await supabaseAdmin
        .from("instructor_schools")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .neq("instructor_id", user.id); // Exclude self

      if (countError) {
        throw new AppError("Failed to count colleagues", 500);
      }

      // Extract user data from the joined result
      const colleaguesData =
        colleagues?.map((item) => {
          const userData = item.users as any;
          if (!userData) {
            return {
              is_primary: item.is_primary,
            };
          }
          return {
            ...userData,
            is_primary: item.is_primary,
          };
        }) || [];

      const totalPages = Math.ceil((count || 0) / limitNum);

      return res.json({
        success: true,
        data: {
          instructors: colleaguesData,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: count || 0,
            totalPages,
          },
        },
        message: "Colleagues retrieved successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/instructor/students:
 *   get:
 *     summary: Get instructor's students
 *     description: Get list of students that the instructor has taught or is teaching
 *     tags: [Instructor Profile]
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
 *           maximum: 100
 *           default: 10
 *         description: Number of students per page
 *       - in: query
 *         name: instructorId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Instructor ID (required for SCHOOL_ADMIN when viewing another instructor's students)
 *     responses:
 *       200:
 *         description: Students retrieved successfully
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
 *                         students:
 *                           type: array
 *                           items:
 *                             allOf:
 *                               - $ref: '#/components/schemas/Student'
 *                               - type: object
 *                                 properties:
 *                                   lessonCount:
 *                                     type: integer
 *                         pagination:
 *                           $ref: '#/components/schemas/Pagination'
 *                     message:
 *                       type: string
 *                       example: "Students retrieved successfully"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/students",
  authenticate,
  authorizeRoles(["INSTRUCTOR", "SCHOOL_ADMIN", "SUPER_ADMIN"]),
  async (req, res, next) => {
    try {
      const user = (req as unknown as AuthenticatedRequest).user;
      const {
        page = 1,
        limit = 10,
        instructorId: queryInstructorId,
      } = req.query as {
        page?: string;
        limit?: string;
        instructorId?: string;
      };

      let instructorId: string;
      let schoolId: string | null;

      if (user.role === "INSTRUCTOR") {
        if (queryInstructorId) {
          return res.status(400).json({
            success: false,
            error: "Instructors cannot request another instructor's students",
          });
        }
        instructorId = user.id;
        schoolId = await resolveInstructorSchoolId(user.id);
      } else if (user.role === "SCHOOL_ADMIN") {
        if (!queryInstructorId) {
          return res.status(400).json({
            success: false,
            error: "instructorId is required when viewing as school admin",
          });
        }
        const inSchool = await isInstructorInSchool(
          queryInstructorId,
          user.schoolId || "",
        );
        if (!inSchool) {
          return res.status(403).json({
            success: false,
            error: "Instructor not in your school",
          });
        }
        instructorId = queryInstructorId;
        schoolId = await resolveInstructorSchoolId(instructorId);
      } else if (user.role === "SUPER_ADMIN") {
        if (!queryInstructorId) {
          return res.status(400).json({
            success: false,
            error: "instructorId is required when viewing as super admin",
          });
        }
        instructorId = queryInstructorId;
        schoolId = await resolveInstructorSchoolId(instructorId);
      } else {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      if (!schoolId) {
        return res.status(403).json({
          success: false,
          error: "User not associated with any school",
        });
      }

      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
      const offset = (pageNum - 1) * limitNum;

      // 1. Get all lessons for this instructor in this school (booking_id not in generated types; use any)
      const { data: lessons, error: lessonsError } = await (
        supabaseAdmin as any
      )
        .from("lessons")
        .select("id, booking_id")
        .eq("instructor_id", instructorId)
        .eq("school_id", schoolId);

      if (lessonsError) {
        throw new AppError("Failed to fetch lessons", 500);
      }

      const lessonList = (lessons || []) as Array<{
        id: string;
        booking_id?: string | null;
      }>;
      const lessonIds = lessonList.map((l) => l.id);
      const lessonsWithBooking = lessonList.filter((l) => l.booking_id);
      const bookingIds = [
        ...new Set(lessonsWithBooking.map((l) => l.booking_id!)),
      ];

      // 2. Build (lesson_id, student_id) pairs and count per student
      const countByStudent = new Map<string, number>();
      const pairKey = (lid: string, sid: string) => `${lid}:${sid}`;
      const seenPairs = new Set<string>();

      if (lessonIds.length > 0) {
        const { data: lpRows, error: lpError } = await supabaseAdmin
          .from("lesson_participants")
          .select("lesson_id, student_id")
          .in("lesson_id", lessonIds);

        if (lpError) {
          throw new AppError("Failed to fetch lesson participants", 500);
        }

        for (const row of lpRows || []) {
          if (row.lesson_id && row.student_id) {
            const key = pairKey(row.lesson_id, row.student_id);
            if (!seenPairs.has(key)) {
              seenPairs.add(key);
              countByStudent.set(
                row.student_id,
                (countByStudent.get(row.student_id) || 0) + 1,
              );
            }
          }
        }
      }

      if (bookingIds.length > 0) {
        const { data: bpRows, error: bpError } = await (supabaseAdmin as any)
          .from("booking_participants")
          .select("booking_id, student_id")
          .in("booking_id", bookingIds);

        if (bpError) {
          throw new AppError("Failed to fetch booking participants", 500);
        }

        const bookingToLessons = new Map<string, string[]>();
        for (const l of lessonsWithBooking) {
          const bid = l.booking_id!;
          const arr = bookingToLessons.get(bid) || [];
          arr.push(l.id);
          bookingToLessons.set(bid, arr);
        }

        const bpList = (bpRows || []) as Array<{
          booking_id: string;
          student_id: string;
        }>;
        for (const row of bpList) {
          if (row.booking_id && row.student_id) {
            const lessonIdsForBooking =
              bookingToLessons.get(row.booking_id) || [];
            for (const lid of lessonIdsForBooking) {
              const key = pairKey(lid, row.student_id);
              if (!seenPairs.has(key)) {
                seenPairs.add(key);
                countByStudent.set(
                  row.student_id,
                  (countByStudent.get(row.student_id) || 0) + 1,
                );
              }
            }
          }
        }
      }

      const studentIds = Array.from(countByStudent.keys());
      if (studentIds.length === 0) {
        return res.json({
          success: true,
          data: {
            students: [],
            pagination: {
              page: pageNum,
              limit: limitNum,
              total: 0,
              totalPages: 0,
            },
          },
          message: "Students retrieved successfully",
        });
      }

      // 3. Fetch users for student ids
      const { data: users, error: usersError } = await supabaseAdmin
        .from("users")
        .select("id, first_name, last_name, avatar, whatsapp_number")
        .in("id", studentIds);

      if (usersError) {
        throw new AppError("Failed to fetch student details", 500);
      }

      const userMap = new Map<
        string,
        {
          first_name?: string | null;
          last_name?: string | null;
          avatar?: string | null;
          whatsapp_number?: string | null;
        }
      >();
      for (const u of users || []) {
        userMap.set(u.id, u);
      }

      // 4. Build list sorted by lessonCount desc, then paginate
      const sortedStudentIds = studentIds.sort(
        (a, b) => (countByStudent.get(b) || 0) - (countByStudent.get(a) || 0),
      );
      const total = sortedStudentIds.length;
      const paginatedIds = sortedStudentIds.slice(offset, offset + limitNum);

      const students = paginatedIds.map((id) => {
        const u = userMap.get(id) || {};
        const lessonCount = countByStudent.get(id) || 0;
        return {
          id,
          firstName: u.first_name || "",
          lastName: u.last_name || "",
          avatar: u.avatar ?? null,
          whatsappNumber: u.whatsapp_number ?? null,
          lessonCount,
        };
      });

      return res.json({
        success: true,
        data: {
          students,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
        message: "Students retrieved successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/instructor/school-students:
 *   get:
 *     summary: Get all students in instructor's school
 *     description: Get list of all students in the instructor's school for lesson creation
 *     tags: [Instructor Profile]
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
 *           maximum: 100
 *           default: 10
 *         description: Number of students per page
 *     responses:
 *       200:
 *         description: School students retrieved successfully
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
 *                         students:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Student'
 *                         pagination:
 *                           $ref: '#/components/schemas/Pagination'
 *                     message:
 *                       type: string
 *                       example: "School students retrieved successfully"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/school-students",
  authenticate,
  authorizeRoles(["INSTRUCTOR"]),
  async (req, res, next) => {
    try {
      const user = (req as unknown as AuthenticatedRequest).user;
      const { page = 1, limit = 10 } = req.query;

      const schoolId = await resolveInstructorSchoolId(user.id);
      if (!schoolId) {
        return res.status(403).json({
          success: false,
          error: "User not associated with any school",
        });
      }
      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
      const offset = (pageNum - 1) * limitNum;

      const { data: memberships, error: membershipError } = await (supabaseAdmin as any)
        .from("student_schools")
        .select("*")
        .eq("school_id", schoolId)
        .eq("is_active", true);

      if (membershipError) {
        throw new AppError("Failed to fetch school students", 500);
      }

      const studentIds = (memberships || [])
        .map((m: any) => m.student_id)
        .filter(Boolean);
      const membershipByStudentId = new Map<string, any>(
        (memberships || []).map((m: any) => [m.student_id, m]),
      );
      if (studentIds.length === 0) {
        return res.json({
          success: true,
          data: {
            students: [],
            pagination: {
              page: pageNum,
              limit: limitNum,
              total: 0,
              totalPages: 0,
            },
          },
          message: "School students retrieved successfully",
        });
      }

      const { count: total, error: countError } = await supabaseAdmin
        .from("users")
        .select("*", { count: "exact", head: true })
        .in("id", studentIds)
        .eq("role", "USER");

      if (countError) {
        throw new AppError("Failed to count school students", 500);
      }

      const { data: students, error } = await supabaseAdmin
        .from("users")
        .select("*")
        .in("id", studentIds)
        .eq("role", "USER")
        .order("first_name")
        .range(offset, offset + limitNum - 1);

      if (error) {
        throw new AppError("Failed to fetch school students", 500);
      }

      const totalPages = Math.ceil((total || 0) / limitNum);

      // Map students to expected format
      const studentsData = (students || []).map((student) => ({
        ...(membershipByStudentId.get(student.id) || {}),
        id: student.id,
        firstName: student.first_name || "",
        lastName: student.last_name || "",
        email: student.email || "",
        whatsappNumber: student.whatsapp_number,
        avatar: student.avatar,
        skillLevel:
          (membershipByStudentId.get(student.id) as any)?.skill_level ||
          "beginner",
        preferredDisciplines:
          (membershipByStudentId.get(student.id) as any)?.preferred_disciplines ||
          [],
        isActive: student.is_active,
        createdAt: student.created_at,
      }));

      return res.json({
        success: true,
        data: {
          students: studentsData,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: total || 0,
            totalPages,
          },
        },
        message: "School students retrieved successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/instructor/school-instructors:
 *   get:
 *     summary: Get all instructors in instructor's school
 *     description: Get list of all instructors in the instructor's school for lesson creation
 *     tags: [Instructor Profile]
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
 *           maximum: 100
 *           default: 10
 *         description: Number of instructors per page
 *     responses:
 *       200:
 *         description: School instructors retrieved successfully
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
 *                         instructors:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Instructor'
 *                         pagination:
 *                           $ref: '#/components/schemas/Pagination'
 *                     message:
 *                       type: string
 *                       example: "School instructors retrieved successfully"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/school-instructors",
  authenticate,
  authorizeRoles(["INSTRUCTOR"]),
  async (req, res, next) => {
    try {
      const user = (req as unknown as AuthenticatedRequest).user;
      const { page = 1, limit = 10 } = req.query;

      const schoolId = await resolveInstructorSchoolId(user.id);
      if (!schoolId) {
        return res.status(403).json({
          success: false,
          error: "User not associated with any school",
        });
      }
      const offset = (Number(page) - 1) * Number(limit);

      // Get all instructors in the school (including self)
      const {
        data: instructors,
        error,
        count,
      } = await supabaseAdmin
        .from("instructor_schools")
        .select(
          `
          instructor_id,
          is_primary,
          users:instructor_id (
            id,
            first_name,
            last_name,
            whatsapp_number,
            avatar,
            specialties,
            languages,
            is_active,
            created_at
          )
        `,
        )
        .eq("school_id", schoolId)
        .order("users(first_name)")
        .range(offset, offset + Number(limit) - 1);

      if (error) {
        throw new AppError("Failed to fetch school instructors", 500);
      }

      // Extract user data from the joined result and map to expected format
      const instructorsData =
        instructors
          ?.map((item) => {
            const userData = item.users as any;
            if (!userData) {
              return null;
            }
            return {
              id: userData.id,
              firstName: userData.first_name || "",
              lastName: userData.last_name || "",
              whatsappNumber: userData.whatsapp_number,
              avatar: userData.avatar,
              specialties: userData.specialties || [],
              languages: userData.languages || [],
              isActive: userData.is_active,
              isPrimary: item.is_primary,
              createdAt: userData.created_at,
            };
          })
          .filter(Boolean) || [];

      const total = count || 0;
      const totalPages = Math.ceil(total / Number(limit));

      return res.json({
        success: true,
        data: {
          instructors: instructorsData,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages,
          },
        },
        message: "School instructors retrieved successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/instructor/{instructorId}/rates-data:
 *   get:
 *     summary: Get instructor rates data
 *     description: "Get all data needed for the Rates tab: rates, school settings (compensation mode), and product categories. Works for all roles (instructor, school admin, super admin)."
 *     tags: [Instructor Profile]
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
 *         description: School ID (required for SUPER_ADMIN, optional for others)
 *     responses:
 *       200:
 *         description: Rates data retrieved successfully
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
 *                         rates:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/InstructorRate'
 *                         schoolSettings:
 *                           type: object
 *                           properties:
 *                             compensationMode:
 *                               type: string
 *                               enum: [fixed, variable]
 *                         categories:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               color:
 *                                 type: string
 *                               slug:
 *                                 type: string
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
  "/:instructorId/rates-data",
  authenticate,
  async (req, res, next) => {
    try {
      const { instructorId: instructorIdParam } = req.params;
      const { schoolId } = req.query as { schoolId?: string };
      const user = (req as unknown as AuthenticatedRequest).user;

      // Validate instructorId is provided
      if (!instructorIdParam) {
        return res.status(400).json({
          success: false,
          error: "Instructor ID is required",
        });
      }

      // TypeScript type narrowing: after the guard, instructorIdParam is definitely a string
      const instructorId: string = instructorIdParam;

      // Permission checks
      if (user.role === "INSTRUCTOR") {
        // Instructors can only view their own rates
        if (user.id !== instructorId) {
          return res.status(403).json({
            success: false,
            error: "You can only view your own rates",
          });
        }
      }

      // Resolve school ID based on role
      let effectiveSchoolId: string | null = null;

      if (user.role === "INSTRUCTOR") {
        // Get instructor's school from instructor_schools
        const resolvedSchoolId = await resolveInstructorSchoolId(user.id);
        if (!resolvedSchoolId) {
          return res.status(403).json({
            success: false,
            error: "Instructor not associated with any school",
          });
        }
        effectiveSchoolId = schoolId || resolvedSchoolId;

        // Verify instructor belongs to this school
        if (!effectiveSchoolId) {
          return res.status(400).json({
            success: false,
            error: "School ID is required",
          });
        }

        // TypeScript type narrowing: after the guard, effectiveSchoolId is definitely a string
        const verifiedSchoolId: string = effectiveSchoolId;
        const isVerified = await verifyInstructorInSchool(
          supabaseAdmin,
          instructorId,
          verifiedSchoolId,
        );

        if (!isVerified) {
          return res.status(403).json({
            success: false,
            error: "Instructor does not belong to this school",
          });
        }
      } else if (user.role === "SCHOOL_ADMIN") {
        // School admin can only access their school
        const userSchoolId = user.schoolId;
        if (!userSchoolId) {
          return res.status(403).json({
            success: false,
            error: "School admin not associated with a school",
          });
        }
        effectiveSchoolId = schoolId || userSchoolId;

        if (effectiveSchoolId !== userSchoolId) {
          return res.status(403).json({
            success: false,
            error: "Access denied to this school",
          });
        }

        // Verify instructor belongs to this school
        if (!effectiveSchoolId) {
          return res.status(400).json({
            success: false,
            error: "School ID is required",
          });
        }

        // TypeScript type narrowing: after the guard, effectiveSchoolId is definitely a string
        const verifiedSchoolId: string = effectiveSchoolId;
        const isVerified = await verifyInstructorInSchool(
          supabaseAdmin,
          instructorId,
          verifiedSchoolId,
        );

        if (!isVerified) {
          return res.status(403).json({
            success: false,
            error: "Instructor does not belong to this school",
          });
        }
      } else if (user.role === "SUPER_ADMIN") {
        // Super admin must provide schoolId
        if (!schoolId) {
          return res.status(400).json({
            success: false,
            error: "schoolId query parameter is required",
          });
        }
        effectiveSchoolId = schoolId;

        // Verify instructor belongs to this school
        if (!effectiveSchoolId) {
          return res.status(400).json({
            success: false,
            error: "School ID is required",
          });
        }

        // TypeScript type narrowing: after the guard, effectiveSchoolId is definitely a string
        const verifiedSchoolId: string = effectiveSchoolId;
        const isVerified = await verifyInstructorInSchool(
          supabaseAdmin,
          instructorId,
          verifiedSchoolId,
        );

        if (!isVerified) {
          return res.status(403).json({
            success: false,
            error: "Instructor does not belong to this school",
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      // Type guard: ensure effectiveSchoolId is defined
      if (!effectiveSchoolId) {
        return res.status(400).json({
          success: false,
          error: "School ID is required",
        });
      }

      // TypeScript type narrowing: after the guard, effectiveSchoolId is definitely a string
      const finalSchoolId: string = effectiveSchoolId;

      // Fetch all data
      const rates = await getInstructorRates(instructorId, finalSchoolId);
      const schoolSettings = await getSchoolSettings(finalSchoolId);

      const { data: categories, error: categoriesError } = await (
        supabaseAdmin as any
      )
        .from("product_categories")
        .select("id, name, color, slug")
        .eq("school_id", finalSchoolId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (categoriesError) {
        console.error("Failed to fetch product categories:", categoriesError);
        // Continue without categories rather than failing completely
      }

      return res.json({
        success: true,
        data: {
          rates: rates || [],
          schoolSettings: {
            compensationMode: schoolSettings.compensationMode,
          },
          categories: categories || [],
        },
        message: "Rates data retrieved successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
