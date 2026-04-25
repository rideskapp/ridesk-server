/**
 * @fileoverview Authentication routes for Ridesk Server
 * @description Handles user registration, login, logout, and token management
 * @author Ridesk Team
 * @version 1.0.0
 */

import { Router } from "express";
import {
  createUser,
  authenticateUser,
  refreshAccessToken,
  getUserById,
  updateUser,
  updateUserPassword,
  updateUserSchool,
  deactivateUser,
  requestPasswordReset,
  resetPasswordWithOTP,
} from "../services/auth";
import { supabaseAdmin } from "../database/supabase";
import {
  initializeSuperAdmin,
  getSuperAdminCredentials,
} from "../services/superAdmin";
import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../middleware/validation";
import Joi from "joi";
import { validate } from "../middleware/validation";
import { authenticate, authorizeRoles } from "../middleware/auth";
import { AppError, AuthenticatedRequest } from "../types";
import { getInstructorSchools } from "../services/instructorSchools";

const router = Router();

/**
 * @swagger
 * /api/auth/init-super-admin:
 *   post:
 *     summary: Initialize SUPER_ADMIN user
 *     description: Creates the initial SUPER_ADMIN user for system administration
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: SUPER_ADMIN initialized successfully
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
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                     password:
 *                       type: string
 *                     message:
 *                       type: string
 *                 message:
 *                   type: string
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post("/init-super-admin", async (_req, res, next) => {
  try {
    const result = await initializeSuperAdmin();

    res.json({
      success: true,
      data: result,
      message: "SUPER_ADMIN initialization completed",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/super-admin-credentials:
 *   get:
 *     summary: Get SUPER_ADMIN credentials
 *     description: Get the default SUPER_ADMIN login credentials
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: SUPER_ADMIN credentials retrieved
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
 *                     email:
 *                       type: string
 *                     password:
 *                       type: string
 *                     message:
 *                       type: string
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/super-admin-credentials", async (_req, res, next) => {
  try {
    const credentials = getSuperAdminCredentials();

    res.json({
      success: true,
      data: credentials,
      message: "SUPER_ADMIN credentials retrieved",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: |
 *       Create a new user account with specified role and school assignment. 
 *       Only SUPER_ADMIN can create users. Password is optional - if omitted, 
 *       a temporary password will be generated.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           example:
 *             email: "admin@school.com"
 *             password: "password123"
 *             firstName: "John"
 *             lastName: "Doe"
 *             role: "SCHOOL_ADMIN"
 *             schoolId: "123e4567-e89b-12d3-a456-426614174001"
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *             example:
 *               success: true
 *               message: "User registered successfully"
 *               data:
 *                 id: "123e4567-e89b-12d3-a456-426614174000"
 *                 email: "admin@school.com"
 *                 role: "SCHOOL_ADMIN"
 *                 schoolId: "123e4567-e89b-12d3-a456-426614174001"
 *                 firstName: "John"
 *                 lastName: "Doe"
 *                 isActive: true
 *                 createdAt: "2024-01-01T00:00:00.000Z"
 *                 updatedAt: "2024-01-01T00:00:00.000Z"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
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
  "/register",
  authenticate,
  authorizeRoles(["SUPER_ADMIN", "SCHOOL_ADMIN"]),
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const userData = req.body;
      const authReq = req as unknown as AuthenticatedRequest;

      // Only SUPER_ADMIN can create other SUPER_ADMIN users
      if (userData.role === "SUPER_ADMIN") {
        if (authReq.user.role !== "SUPER_ADMIN") {
          throw new AppError(
            "SUPER_ADMIN registration requires special authorization",
            403,
          );
        }
      }

      // SCHOOL_ADMIN can only create INSTRUCTOR and USER roles
      if (authReq.user.role === "SCHOOL_ADMIN") {
        if (!["INSTRUCTOR", "USER"].includes(userData.role)) {
          throw new AppError(
            "School admins can only create instructors and users",
            403,
          );
        }

        // Force school_id to be the admin's school
        userData.schoolId = authReq.user.schoolId;
      }

      const user = await createUser(userData);

      res.status(201).json({
        success: true,
        data: user,
        message: "User registered successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticate user with email and password, returns JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           example:
 *             email: "admin@school.com"
 *             password: "password123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/LoginResponse'
 *             example:
 *               success: true
 *               message: "Login successful"
 *               data:
 *                 user:
 *                   id: "123e4567-e89b-12d3-a456-426614174000"
 *                   email: "admin@school.com"
 *                   role: "SCHOOL_ADMIN"
 *                   schoolId: "123e4567-e89b-12d3-a456-426614174001"
 *                   firstName: "John"
 *                   lastName: "Doe"
 *                   isActive: true
 *                   createdAt: "2024-01-01T00:00:00.000Z"
 *                   updatedAt: "2024-01-01T00:00:00.000Z"
 *                 token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 expiresIn: 604800
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Invalid email or password"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    console.log("=== LOGIN ROUTE CALLED ===");
    console.log("Request body:", req.body);

    const loginData = req.body;
    console.log("Calling authenticateUser with:", loginData);

    const result = await authenticateUser(loginData);
    console.log("authenticateUser returned:", result);

    res.json({
      success: true,
      data: result,
      message: "Login successful",
    });
  } catch (error) {
    console.error("=== LOGIN ROUTE ERROR ===");
    console.error("Error in login route:", error);
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Get a new access token using a valid refresh token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Token refreshed successfully
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
 *                         token:
 *                           type: string
 *                           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                         expiresIn:
 *                           type: number
 *                           example: 604800
 *             example:
 *               success: true
 *               message: "Token refreshed successfully"
 *               data:
 *                 token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 expiresIn: 604800
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Invalid or expired token"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/refresh",
  validate(refreshTokenSchema),
  async (req, res, next) => {
    try {
      const refreshData = req.body;
      const result = await refreshAccessToken(refreshData);

      res.json({
        success: true,
        data: result,
        message: "Token refreshed successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user information
 *     description: Retrieve the profile information of the currently authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *             example:
 *               success: true
 *               message: "User information retrieved successfully"
 *               data:
 *                 id: "123e4567-e89b-12d3-a456-426614174000"
 *                 email: "admin@school.com"
 *                 role: "SCHOOL_ADMIN"
 *                 schoolId: "123e4567-e89b-12d3-a456-426614174001"
 *                 firstName: "John"
 *                 lastName: "Doe"
 *                 isActive: true
 *                 createdAt: "2024-01-01T00:00:00.000Z"
 *                 updatedAt: "2024-01-01T00:00:00.000Z"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const authReq = req as any;
    const user = await getUserById(authReq.user.id);

    res.json({
      success: true,
      data: user,
      message: "User information retrieved successfully",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/password:
 *   put:
 *     summary: Change user password
 *     description: Update the password for the authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: "currentPassword123"
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: "newPassword123"
 *     responses:
 *       200:
 *         description: Password updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Password updated successfully"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/password",
  authenticate,
  validate(changePasswordSchema),
  async (req, res, next) => {
    try {
      const authReq = req as any;
      const { currentPassword, newPassword } = req.body;

      const result = await updateUserPassword(
        authReq.user.id,
        currentPassword,
        newPassword,
      );

      res.json({
        success: true,
        data: result,
        message: "Password updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/auth/school:
 *   put:
 *     summary: Update user's school assignment
 *     description: Update the school assignment for the authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [schoolId]
 *             properties:
 *               schoolId:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174001"
 *     responses:
 *       200:
 *         description: School assignment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *                     message:
 *                       type: string
 *                       example: "School assignment updated successfully"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/school",
  authenticate,
  validate(
    Joi.object({
      schoolId: Joi.string().uuid().required(),
    }),
    "body",
  ),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { schoolId } = req.body;

      const result = await updateUserSchool(authReq.user.id, schoolId);

      res.json({
        success: true,
        data: result,
        message: "School assignment updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Logout user (client-side token removal). This endpoint is mainly for documentation purposes as token removal is handled client-side.
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Logout successful"
 */
router.post("/logout", async (_req, res, _next) => {
  try {
    // In a stateless JWT system, logout is handled client-side
    // by removing the token from storage
    // For enhanced security, you could implement a token blacklist

    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    _next(error);
  }
});

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     description: Sends an OTP code to the user's email for password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *     responses:
 *       200:
 *         description: Password reset email sent (always returns success for security)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  async (req, res, next) => {
    try {
      const { email } = req.body;
      await requestPasswordReset(email);

      res.json({
        success: true,
        message: "Password reset code has been sent to your email",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with OTP
 *     description: Reset user password using the OTP code sent to their email
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, newPassword, confirmPassword]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 pattern: "^[0-9]{6}$"
 *                 description: 6-digit OTP code
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *               confirmPassword:
 *                 type: string
 *                 description: Must match newPassword
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid or expired OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  async (req, res, next) => {
    try {
      const { email, otp, newPassword } = req.body;

      await resetPasswordWithOTP(email, otp, newPassword);

      res.json({
        success: true,
        message: "Password reset successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: Get all users with pagination
 *     description: Retrieve a paginated list of all users. Only SUPER_ADMIN can access this.
 *     tags: [Authentication]
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
 *         description: Number of users per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering users
 *     responses:
 *       200:
 *         description: Users retrieved successfully
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
 *                         $ref: '#/components/schemas/User'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get(
  "/users",
  authenticate,
  authorizeRoles(["SUPER_ADMIN"]),
  async (req, res, next) => {
    try {
      const page = parseInt(req.query["page"] as string) || 1;
      const limit = Math.min(parseInt(req.query["limit"] as string) || 10, 100);
      const search = (req.query["search"] as string) || "";
      const offset = (page - 1) * limit;

      // Get users with pagination and search
      let query = supabaseAdmin
        .from("users")
        .select(
          `
          id,
          first_name,
          last_name,
          role,
          school_id,
          is_active,
          created_at,
          updated_at,
          schools!school_id (
            id,
            name
          )
        `,
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      // Add search filter if provided
      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,role.ilike.%${search}%`,
        );
      }

      const { data: users, error, count } = await query;

      if (error) {
        throw new AppError("Failed to fetch users", 500);
      }

      // Get user emails from auth.users
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const emailMap = new Map(
        authUsers.users.map((user) => [user.id, user.email]),
      );

      // Identify instructors and fetch their schools
      const instructors = users?.filter((user) => user.role === "INSTRUCTOR") || [];
      const instructorSchoolsMap = new Map<string, string[]>();
      
      await Promise.all(
        instructors.map(async (instructor) => {
          try {
            const schools = await getInstructorSchools(instructor.id);
            const schoolNames = schools
              .filter((s) => s.isActive)
              .sort((a, b) => {
                if (a.isPrimary !== b.isPrimary) {
                  return a.isPrimary ? -1 : 1;
                }
                return a.schoolName.localeCompare(b.schoolName);
              })
              .map((s) => s.schoolName);
            instructorSchoolsMap.set(instructor.id, schoolNames);
          } catch (error) {
            console.error(`Failed to fetch schools for instructor ${instructor.id}:`, error);
            instructorSchoolsMap.set(instructor.id, []);
          }
        }),
      );

      const formatSchoolNames = (schoolNames: string[]): string | null => {
        if (!schoolNames || schoolNames.length === 0) {
          return null;
        }
        if (schoolNames.length === 1) {
          return schoolNames[0] ?? null;
        }
        // Format as "first school name +1" or "+2" etc.
        const additionalCount = schoolNames.length - 1;
        return `${schoolNames[0]} +${additionalCount}`;
      };

      const usersWithEmails =
        users?.map((user) => {
          if (user.role === "INSTRUCTOR") {
            // For instructors, get schools from instructor_schools table
            const schoolNames = instructorSchoolsMap.get(user.id) || [];
            return {
              id: user.id,
              firstName: user.first_name || "",
              lastName: user.last_name || "",
              email: emailMap.get(user.id) || "",
              role: user.role,
              schoolId: user.school_id,
              schoolName: formatSchoolNames(schoolNames),
              isActive: user.is_active,
              createdAt: user.created_at,
              updatedAt: user.updated_at,
            };
          } else {
            // For other users, get school from school_id relationship
            return {
              id: user.id,
              firstName: user.first_name || "",
              lastName: user.last_name || "",
              email: emailMap.get(user.id) || "",
              role: user.role,
              schoolId: user.school_id,
              schoolName: user.schools?.name || null,
              isActive: user.is_active,
              createdAt: user.created_at,
              updatedAt: user.updated_at,
            };
          }
        }) || [];

      const totalPages = Math.ceil((count || 0) / limit);

      res.json({
        success: true,
        data: usersWithEmails,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
        },
        message: "Users retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/auth/deactivate/{userId}:
 *   delete:
 *     summary: Deactivate user account
 *     description: Deactivate a user account. Users can deactivate their own account, SUPER_ADMIN can deactivate any account.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the user to deactivate
 *     responses:
 *       200:
 *         description: User deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *                     message:
 *                       type: string
 *                       example: "Account deactivated successfully"
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
/**
 * @swagger
 * /api/auth/users/{userId}:
 *   put:
 *     summary: Update user information
 *     description: Update user information. SUPER_ADMIN can update any user, users can update their own information (except role).
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               schoolId:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *                 description: Active/inactive status of the user
 *           example:
 *             firstName: "John"
 *             lastName: "Doe"
 *             email: "john.doe@example.com"
 *             schoolId: "school-uuid"
 *             isActive: true
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *                 message:
 *                   type: string
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
router.put("/users/:userId", authenticate, async (req, res, next) => {
  try {
    const userId = req.params["userId"];
    const authReq = req as any;
    const updateData = req.body;

    // Users can only update their own account, SUPER_ADMIN can update any
    if (authReq.user.role !== "SUPER_ADMIN" && authReq.user.id !== userId) {
      throw new AppError("You can only update your own account", 403);
    }

    if (!userId) {
      throw new AppError("User ID is required", 400);
    }

    // Remove role from update data if user is not SUPER_ADMIN
    if (authReq.user.role !== "SUPER_ADMIN") {
      delete updateData.role;
      delete updateData.isActive;
    }

    const updatedUser = await updateUser(userId, updateData);

    res.json({
      success: true,
      data: updatedUser,
      message: "User updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/deactivate/{userId}:
 *   delete:
 *     summary: Deactivate user account
 *     description: |
 *       Deactivate a user account. SUPER_ADMIN can deactivate any user account.
 *       Regular users can only deactivate their own account.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID to deactivate
 *     responses:
 *       200:
 *         description: Account deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *                     message:
 *                       type: string
 *                       example: "Account deactivated successfully"
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
router.delete(
  "/deactivate/:userId",
  authenticate,
  authorizeRoles(["SUPER_ADMIN"]),
  async (req, res, next) => {
    try {
      const userId = req.params["userId"];
      const authReq = req as any;

      // Users can deactivate their own account, SUPER_ADMIN can deactivate any
      if (authReq.user.role !== "SUPER_ADMIN" && authReq.user.id !== userId) {
        throw new AppError("You can only deactivate your own account", 403);
      }

      if (!userId) {
        throw new AppError("User ID is required", 400);
      }
      const result = await deactivateUser(userId);

      res.json({
        success: true,
        data: result,
        message: "Account deactivated successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
