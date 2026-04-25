/**
 * @fileoverview Student management routes for Ridesk Server
 * @description Handles student CRUD operations for school admins
 * @author Ridesk Team
 * @version 1.0.0
 */

import { Router } from "express";
import {
  createStudent,
  getStudentById,
  getAllStudents,
  updateStudent,
  deleteStudent,
  searchStudents,
  createStudentBySchoolAdmin,
} from "../services/students";
import { supabaseAdmin } from "../database/supabase";
import {
  createStudentSchema,
  createStudentBySchoolAdminSchema,
  updateStudentSchema,
  paginationSchema,
  searchSchema,
} from "../middleware/validation";
import { AuthenticatedRequest } from "../types";
import { validate } from "../middleware/validation";
import { authenticate, authorizeRoles } from "../middleware/auth";

const router = Router();

/**
 * @swagger
 * /api/students:
 *   post:
 *     summary: Create a new student
 *     description: Create a new student for the authenticated school admin's school
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateStudentRequest'
 *     responses:
 *       201:
 *         description: Student created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Student'
 *                     message:
 *                       type: string
 *                       example: "Student created successfully"
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
  authorizeRoles(["SUPER_ADMIN"]),
  validate(createStudentSchema),
  async (req, res, next) => {
    try {
      const studentData = req.body;
      const { schoolId: querySchoolId } = req.query as { schoolId?: string };
      const user = (req as unknown as AuthenticatedRequest).user;

      let targetSchoolId: string | undefined;
      if (user.role === "SUPER_ADMIN" && querySchoolId) {
        targetSchoolId = querySchoolId;
      } else if (user.role === "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          error: "School ID is required",
        });
      } else if (user.schoolId) {
        targetSchoolId = user.schoolId;
      }

      if (!targetSchoolId) {
        return res.status(403).json({
          success: false,
          error: "User not associated with any school",
        });
      }

      // Ensure the student is created for the school admin's school
      const student = await createStudent(studentData, targetSchoolId);

      return res.status(201).json({
        success: true,
        data: student,
        message: "Student created successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/students:
 *   get:
 *     summary: Get all students for a school
 *     description: Get paginated list of students for the authenticated school admin's school
 *     tags: [Students]
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
 *         description: Number of students per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering students
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
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Student'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
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

      const result = await getAllStudents(
        targetSchoolId,
        Number(page),
        Number(limit),
        search as string,
      );

      return res.json({
        success: true,
        data: {
          students: result.students,
          pagination: result.pagination,
          failures: result.failures, // Include failure metadata
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
 * /api/students/search:
 *   get:
 *     summary: Search students
 *     description: Search students within the authenticated school admin's school
 *     tags: [Students]
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
 *                       type: object
 *                       properties:
 *                         students:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Student'
 *                         failures:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               error:
 *                                 type: object
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

      const result = await searchStudents(user.schoolId, q as string);

      return res.json({
        success: true,
        data: result, // result now contains { students, failures }
        message: "Search results retrieved successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/students/{id}:
 *   get:
 *     summary: Get student by ID
 *     description: Get a specific student by ID (must belong to the authenticated school admin's school)
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Student ID
 *     responses:
 *       200:
 *         description: Student retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Student'
 *                     message:
 *                       type: string
 *                       example: "Student retrieved successfully"
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
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN", "INSTRUCTOR"]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { schoolId: querySchoolId } = req.query as { schoolId?: string };
      const user = (req as unknown as AuthenticatedRequest).user;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: "Student ID is required",
        });
      }

      let targetSchoolId: string | undefined;

      if (user.role === "INSTRUCTOR") {
        // For instructors, verify they have a lesson with this student
        // Check both lesson_participants (direct lesson participants) and booking_participants (booking-based participants)
        let hasAccess = false;

        // Check 1: lesson_participants (direct lesson participants)
        const { data: lessonParticipants, error: lessonError } = await (
          supabaseAdmin as any
        )
          .from("lesson_participants")
          .select("lesson_id")
          .eq("student_id", id)
          .limit(100);

        if (
          !lessonError &&
          lessonParticipants &&
          lessonParticipants.length > 0
        ) {
          const lessonIds = lessonParticipants.map((lp: any) => lp.lesson_id);
          const { data: lesson, error: lessonsError } = await (
            supabaseAdmin as any
          )
            .from("lessons")
            .select("id, school_id")
            .in("id", lessonIds)
            .eq("instructor_id", user.id)
            .limit(1)
            .maybeSingle();

          if (!lessonsError && lesson) {
            hasAccess = true;
          }
        }

        // Check 2: booking_participants (booking-based participants)
        if (!hasAccess) {
          const { data: bookingParticipants, error: bookingError } = await (
            supabaseAdmin as any
          )
            .from("booking_participants")
            .select("booking_id")
            .eq("student_id", id)
            .limit(100);

          if (
            !bookingError &&
            bookingParticipants &&
            bookingParticipants.length > 0
          ) {
            const bookingIds = bookingParticipants.map(
              (bp: any) => bp.booking_id,
            );
            const { data: lesson, error: lessonsError } = await (
              supabaseAdmin as any
            )
              .from("lessons")
              .select("id, school_id")
              .in("booking_id", bookingIds)
              .eq("instructor_id", user.id)
              .limit(1)
              .maybeSingle();

            if (!lessonsError && lesson) {
              hasAccess = true;
            }
          }
        }

        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            error: "Instructor does not have access to this student",
          });
        }

        // Resolve one active school membership for this student
        const { data: studentUser, error: studentError } = await (
          supabaseAdmin as any
        )
          .from("student_schools")
          .select("school_id")
          .eq("student_id", id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (studentError || !studentUser || !studentUser.school_id) {
          return res.status(403).json({
            success: false,
            error: "Student school ID not found",
          });
        }

        targetSchoolId = studentUser.school_id;
      } else if (user.role === "SUPER_ADMIN" && querySchoolId) {
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
      const student = await getStudentById(id, targetSchoolId);

      return res.json({
        success: true,
        data: student,
        message: "Student retrieved successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/students/{id}:
 *   put:
 *     summary: Update student
 *     description: Update a student (must belong to the authenticated school admin's school)
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Student ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateStudentRequest'
 *     responses:
 *       200:
 *         description: Student updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Student'
 *                     message:
 *                       type: string
 *                       example: "Student updated successfully"
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
  validate(updateStudentSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const { schoolId: querySchoolId } = req.query as { schoolId?: string };
      const user = (req as unknown as AuthenticatedRequest).user;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: "Student ID is required",
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
      const student = await updateStudent(id, updateData, targetSchoolId);

      return res.json({
        success: true,
        data: student,
        message: "Student updated successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/students/{id}:
 *   delete:
 *     summary: Delete student
 *     description: Permanently delete a student from the database (hard delete). This removes the student from both the users table and auth.users. The student must belong to the authenticated school admin's school.
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Student ID
 *     responses:
 *       200:
 *         description: Student deleted successfully
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
 *                       example: "Student deleted successfully"
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
          error: "Student ID is required",
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
      const result = await deleteStudent(id, targetSchoolId);

      return res.json({
        success: true,
        data: result,
        message: "Student deleted successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/students/school-admin:
 *   post:
 *     summary: Create student by school admin
 *     description: School admin creates a student and sends invitation
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, email, skillLevel, preferredDisciplines]
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
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: "1990-01-01"
 *               emergencyContact:
 *                 type: string
 *                 example: "Jane Doe"
 *               emergencyPhone:
 *                 type: string
 *                 example: "+1234567891"
 *               medicalConditions:
 *                 type: string
 *                 example: "None"
 *               skillLevel:
 *                 type: string
 *                 enum: [beginner, intermediate, advanced]
 *                 example: "beginner"
 *               preferredDisciplines:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [kite, surf, wing]
 *                 example: ["kite", "surf"]
 *     responses:
 *       201:
 *         description: Student created and invitation sent successfully
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
 *                     student:
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
  validate(createStudentBySchoolAdminSchema),
  async (req, res, next) => {
    try {
      const studentData = req.body;
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
        (user) => user.email === studentData.email,
      );

      if (existingUser) {
        // User exists, link membership via student_schools
        const { data: hasPrimary, error: hasPrimaryError } = await (supabaseAdmin as any)
          .from("student_schools")
          .select("id")
          .eq("student_id", existingUser.id)
          .eq("is_primary", true)
          .maybeSingle();
        if (hasPrimaryError) {
          console.error("Failed to check existing primary membership:", hasPrimaryError);
          return res.status(500).json({
            success: false,
            error: "Failed to validate existing school memberships",
          });
        }
        const isPrimary = !Boolean(hasPrimary?.id);

        const { error: linkError } = await (supabaseAdmin as any)
          .from("student_schools")
          .upsert(
            {
              student_id: existingUser.id,
              school_id: targetSchoolId,
              is_active: true,
              is_primary: isPrimary,
              skill_level: studentData.skillLevel || null,
              preferred_disciplines: [...(studentData.preferredDisciplines ?? [])],
              primary_sport: studentData.primarySport || null,
              riding_background: studentData.ridingBackground || null,
              preferred_days: [...(studentData.preferredDays ?? [])],
              preferred_time_slots: [...(studentData.preferredTimeSlots ?? [])],
              preferred_lesson_types: [...(studentData.preferredLessonTypes ?? [])],
              preferred_language: [...(studentData.preferredLanguage ?? [])],
              consent_physical_condition:
                studentData.consentPhysicalCondition !== undefined
                  ? studentData.consentPhysicalCondition
                  : true,
              consent_terms_conditions:
                studentData.consentTermsConditions !== undefined
                  ? studentData.consentTermsConditions
                  : true,
              consent_gdpr:
                studentData.consentGdpr !== undefined
                  ? studentData.consentGdpr
                  : true,
              consent_photos_videos:
                studentData.consentPhotosVideos !== undefined
                  ? studentData.consentPhotosVideos
                  : true,
              consent_marketing:
                studentData.consentMarketing !== undefined
                  ? studentData.consentMarketing
                  : true,
              consent_custom_1:
                studentData.consentCustom1 !== undefined
                  ? studentData.consentCustom1
                  : null,
              consent_custom_2:
                studentData.consentCustom2 !== undefined
                  ? studentData.consentCustom2
                  : null,
              arrival_date: studentData.arrivalDate || null,
              departure_date: studentData.departureDate || null,
              stay_notes: studentData.stayNotes || null,
              notes: studentData.notes || null,
            },
            { onConflict: "student_id,school_id" },
          );

        if (linkError) {
          console.error("Failed to link user to school:", linkError);
          return res.status(500).json({
            success: false,
            error: "Failed to link user to school",
          });
        }

        const { data: existingProfile } = await supabaseAdmin
          .from("users")
          .select("school_id")
          .eq("id", existingUser.id)
          .maybeSingle();

        if (!existingProfile?.school_id) {
          await supabaseAdmin
            .from("users")
            .update({ school_id: targetSchoolId })
            .eq("id", existingUser.id);
        }

        return res.status(201).json({
          success: true,
          data: {
            message: "User already exists and has been linked to the school",
          },
        });
      } else {
        // User doesn't exist, create user immediately with is_active: false
        const student = await createStudentBySchoolAdmin(
          studentData,
          targetSchoolId,
          user.id,
          `${user.firstName} ${user.lastName}`,
        );

        return res.status(201).json({
          success: true,
          data: {
            student,
            message:
              "Student created successfully. Invitation sent to activate account.",
          },
          message: "Student created successfully",
        });
      }
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
