/**
 * @fileoverview Student Profile Routes
 * @description Routes for students to manage their own profile and view their data
 * @author Ridesk Team
 * @version 1.0.0
 */

import { Router } from "express";
import { supabaseAdmin } from "../database/supabase";
import { AppError } from "../types";
import { AuthenticatedRequest } from "../types";
import { authenticate, authorizeRoles } from "../middleware/auth";

const router = Router();

/**
 * @swagger
 * /api/student/profile:
 *   get:
 *     summary: Get student's own profile
 *     description: Get the authenticated student's profile information. Only accessible by users with USER role.
 *     tags: [Student Profile]
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
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         first_name:
 *                           type: string
 *                         last_name:
 *                           type: string
 *                         phone_number:
 *                           type: string
 *                           nullable: true
 *                         avatar:
 *                           type: string
 *                           nullable: true
 *                         skill_level:
 *                           type: string
 *                           nullable: true
 *                         preferred_disciplines:
 *                           type: array
 *                           items:
 *                             type: string
 *                           nullable: true
 *                         is_active:
 *                           type: boolean
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                         updated_at:
 *                           type: string
 *                           format: date-time
 *                     message:
 *                       type: string
 *                       example: "Profile retrieved successfully"
 *             example:
 *               success: true
 *               message: "Profile retrieved successfully"
 *               data:
 *                 id: "123e4567-e89b-12d3-a456-426614174000"
 *                 first_name: "John"
 *                 last_name: "Doe"
 *                 phone_number: "+1234567890"
 *                 avatar: null
 *                 skill_level: "beginner"
 *                 preferred_disciplines: ["kite", "surf"]
 *                 is_active: true
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
router.get(
  "/profile",
  authenticate,
  authorizeRoles(["USER"]),
  async (req, res, next) => {
    try {
      const user = (req as unknown as AuthenticatedRequest).user;

      const { data: student, error } = await supabaseAdmin
        .from("users")
        .select(
          `
          id,
          first_name,
          last_name,
          phone_number,
          avatar,
          is_active,
          created_at,
          updated_at
        `,
        )
        .eq("id", user.id)
        .eq("role", "USER")
        .single();

      if (error) {
        throw new AppError("Student not found", 404);
      }

      let membership: any = null;
      if (user.schoolId) {
        const { data: contextualMembership, error: contextualMembershipError } = await (
          supabaseAdmin as any
        )
          .from("student_schools")
          .select("skill_level, preferred_disciplines")
          .eq("student_id", user.id)
          .eq("school_id", user.schoolId)
          .eq("is_active", true)
          .maybeSingle();

        if (contextualMembershipError) {
          throw new AppError("Failed to fetch student school profile", 500);
        }
        membership = contextualMembership;
      }

      if (!membership) {
        const { data: fallbackMembership, error: fallbackMembershipError } = await (
          supabaseAdmin as any
        )
          .from("student_schools")
          .select("skill_level, preferred_disciplines")
          .eq("student_id", user.id)
          .eq("is_active", true)
          .order("is_primary", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fallbackMembershipError) {
          throw new AppError("Failed to fetch student school profile", 500);
        }
        membership = fallbackMembership;
      }

      const studentData = {
        ...student,
        skill_level: membership?.skill_level ?? null,
        preferred_disciplines: membership?.preferred_disciplines ?? [],
      };

      return res.json({
        success: true,
        data: studentData,
        message: "Profile retrieved successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/student/instructors:
 *   get:
 *     summary: Get student's instructors
 *     description: Get paginated list of unique instructors that the authenticated student has had lessons with. Only accessible by users with USER role.
 *     tags: [Student Profile]
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
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of instructors per page
 *         example: 10
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
 *                       type: object
 *                       properties:
 *                         instructors:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 format: uuid
 *                               first_name:
 *                                 type: string
 *                               last_name:
 *                                 type: string
 *                               phone_number:
 *                                 type: string
 *                                 nullable: true
 *                               avatar:
 *                                 type: string
 *                                 nullable: true
 *                               specialties:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               languages:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               is_primary:
 *                                 type: boolean
 *                               is_active:
 *                                 type: boolean
 *                               created_at:
 *                                 type: string
 *                                 format: date-time
 *                         pagination:
 *                           $ref: '#/components/schemas/PaginationMeta'
 *                     message:
 *                       type: string
 *                       example: "Instructors retrieved successfully"
 *             example:
 *               success: true
 *               message: "Instructors retrieved successfully"
 *               data:
 *                 instructors:
 *                   - id: "123e4567-e89b-12d3-a456-426614174000"
 *                     first_name: "Jane"
 *                     last_name: "Smith"
 *                     phone_number: "+1234567890"
 *                     avatar: null
 *                     specialties: ["kite", "surf"]
 *                     languages: ["English", "Italian"]
 *                     is_primary: true
 *                     is_active: true
 *                     created_at: "2024-01-01T00:00:00.000Z"
 *                 pagination:
 *                   page: 1
 *                   limit: 10
 *                   total: 1
 *                   totalPages: 1
 *                   hasNext: false
 *                   hasPrev: false
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/instructors",
  authenticate,
  authorizeRoles(["USER"]),
  async (req, res, next) => {
    try {
      const user = (req as unknown as AuthenticatedRequest).user;
      const { page = 1, limit = 10 } = req.query;

      const { data: memberships, error: membershipsError } = await (supabaseAdmin as any)
        .from("student_schools")
        .select("school_id")
        .eq("student_id", user.id)
        .eq("is_active", true);

      if (membershipsError) {
        throw new AppError("Failed to resolve student schools", 500);
      }

      const schoolIds = (memberships || [])
        .map((m: any) => m.school_id)
        .filter(Boolean);

      if (schoolIds.length === 0 && !user.schoolId) {
        return res.status(403).json({
          success: false,
          error: "User not associated with any school",
        });
      }

      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
      const offset = (pageNum - 1) * limitNum;
      const effectiveSchoolIds =
        schoolIds.length > 0 ? schoolIds : [user.schoolId as string];

      // Get instructors who have taught this student
      const { data: instructors, error } = await supabaseAdmin
        .from("lesson_participants")
        .select(
          `
          lesson!inner (
            school_id,
            instructor_id,
            instructors:instructor_id (
              id,
              first_name,
              last_name,
              phone_number,
              avatar,
              specialties,
              languages,
              is_primary,
              is_active,
              created_at
            )
          )
        `,
        )
        .eq("student_id", user.id)
        .in("lesson.school_id", effectiveSchoolIds);

      if (error) {
        throw new AppError("Failed to fetch instructors", 500);
      }

      // Extract unique instructors
      const uniqueInstructors = (instructors || []).reduce(
        (acc: any[], current: any) => {
          const instructor = current.lesson.instructors;
          if (!instructor?.id) {
            return acc;
          }
          const existing = acc.find((i) => i.id === instructor.id);
          if (!existing) {
            acc.push(instructor);
          }
          return acc;
        },
        [],
      );

      const total = uniqueInstructors.length;
      const paginatedInstructors = uniqueInstructors.slice(offset, offset + limitNum);

      return res.json({
        success: true,
        data: {
          instructors: paginatedInstructors,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
        message: "Instructors retrieved successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
