/**
 * @fileoverview User invitation routes for Ridesk Server
 * @description Handles user invitation endpoints
 * @author Ridesk Team
 * @version 1.0.0
 */

import { Router, Request } from "express";
import Joi from "joi";
import { validate } from "../middleware/validation";
import { authenticate, authorizeRoles } from "../middleware/auth";
import { AppError, AuthenticatedRequest } from "../types";
import {
  getInvitationByToken,
  acceptInvitation,
  resendInvitation,
  getInvitationByUserId,
  getInvitations,
} from "../services/userInvitations";
import { emailService } from "../services/email";
import { isValidUuid } from "../utils/roleUtils";
import { paginationSchema } from "../middleware/validation";

const router = Router();

// Validation schemas
const acceptInvitationSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(6).required(),
});

/**
 * @swagger
 * /api/invitations:
 *   get:
 *     summary: Get paginated list of invitations
 *     description: Get paginated list of invitations with optional filtering by schoolId
 *     tags: [User Invitations]
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
 *           default: 20
 *         description: Number of invitations per page
 *       - in: query
 *         name: schoolId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by school ID (optional, required for SCHOOL_ADMIN)
 *       - in: query
 *         name: isUsed
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Filter by invitation status (false for pending invitations)
 *     responses:
 *       200:
 *         description: Invitations retrieved successfully
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
 *                         $ref: '#/components/schemas/UserInvitation'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                     message:
 *                       type: string
 *                       example: "Invitations retrieved successfully"
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
  async (req: Request, res, next) => {
    try {
      const { page, limit, schoolId: querySchoolId, isUsed } = req.query;
      const user = (req as unknown as AuthenticatedRequest).user;

      let targetSchoolId: string | undefined;
      if (user.role === "SUPER_ADMIN" && querySchoolId) {
        targetSchoolId = querySchoolId as string;
      } else if (user.role === "SCHOOL_ADMIN") {
        targetSchoolId = user.schoolId ?? undefined;
      }

      // SCHOOL_ADMIN must have a schoolId
      if (user.role === "SCHOOL_ADMIN" && !targetSchoolId) {
        return res.status(403).json({
          success: false,
          error: "School ID is required",
        });
      }

      // Parse isUsed query parameter - it can be string, boolean, or undefined
      const isUsedValue = typeof isUsed === "string" && isUsed === "true";

      const result = await getInvitations(
        targetSchoolId,
        Number(page) || 1,
        Number(limit) || 20,
        isUsedValue,
      );

      return res.json({
        success: true,
        data: result.invitations,
        pagination: result.pagination,
        message: "Invitations retrieved successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/invitations/accept:
 *   post:
 *     summary: Accept invitation
 *     description: Accept an invitation and create user account
 *     tags: [User Invitations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *                 example: "abc123def456"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Invitation accepted successfully
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
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     role:
 *                       type: string
 *                 message:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post(
  "/accept",
  validate(acceptInvitationSchema),
  async (req, res, next) => {
    try {
      const { token, password } = req.body;

      const user = await acceptInvitation(token, password);

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
        },
        message: "Invitation accepted successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/invitations/validate/{token}:
 *   get:
 *     summary: Validate invitation token
 *     description: Check if an invitation token is valid and not expired
 *     tags: [User Invitations]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Invitation token
 *     responses:
 *       200:
 *         description: Token is valid
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
 *                     valid:
 *                       type: boolean
 *                     email:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     role:
 *                       type: string
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get("/validate/:token", async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token) {
      throw new AppError("Token is required", 400);
    }

    const invitation = await getInvitationByToken(token);

    res.json({
      success: true,
      data: {
        valid: true,
        email: invitation.email,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/invitations/test-email:
 *   post:
 *     summary: Test email configuration
 *     description: Test if email service is properly configured
 *     tags: [User Invitations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Email configuration test result
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
 *                     configured:
 *                       type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/test-email", authenticate, async (_req, res, next) => {
  try {
    const isEmailConfigured = await emailService.testConnection();

    res.json({
      success: true,
      data: {
        configured: isEmailConfigured,
      },
      message: isEmailConfigured
        ? "Email service is properly configured"
        : "Email service is not configured",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/invitations/user/{userId}:
 *   get:
 *     summary: Get invitation by user ID
 *     description: Get the most recent pending invitation for a user
 *     tags: [User Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: Invitation found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserInvitation'
 *             example:
 *               success: true
 *               data:
 *                 id: "123e4567-e89b-12d3-a456-426614174000"
 *                 email: "user@example.com"
 *                 firstName: "John"
 *                 lastName: "Doe"
 *                 role: "INSTRUCTOR"
 *                 schoolId: "123e4567-e89b-12d3-a456-426614174001"
 *                 invitedBy: "123e4567-e89b-12d3-a456-426614174002"
 *                 invitedByName: "Jane Smith"
 *                 invitationToken: "abc123def456ghi789"
 *                 expiresAt: "2024-01-08T00:00:00.000Z"
 *                 isUsed: false
 *                 userId: "123e4567-e89b-12d3-a456-426614174003"
 *                 formSubmittedAt: null
 *                 createdAt: "2024-01-01T00:00:00.000Z"
 *                 updatedAt: "2024-01-01T00:00:00.000Z"
 *       404:
 *         description: No invitation found
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/user/:userId",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  async (req: Request, res, next) => {
    try {
      const { userId } = req.params;
      if (!userId || !isValidUuid(userId)) {
        throw new AppError("Invalid user ID", 400);
      }

      const user = (req as unknown as AuthenticatedRequest).user;
      const schoolId =
        user.role === "SCHOOL_ADMIN" ? user.schoolId ?? undefined : undefined;

      const invitation = await getInvitationByUserId(userId, schoolId);

      if (!invitation) {
        return res.status(404).json({
          success: false,
          message: "No pending invitation found",
        });
      }

      return res.json({
        success: true,
        data: invitation,
      });
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * @swagger
 * /api/invitations/{id}/resend:
 *   post:
 *     summary: Resend invitation
 *     description: Resend an invitation email to the user
 *     tags: [User Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Invitation ID (UUID format)
 *     responses:
 *       200:
 *         description: Invitation resent successfully
 *       400:
 *         description: Bad request (invalid UUID or invitation already accepted)
 *       403:
 *         description: Forbidden (no permission to resend this invitation)
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  "/:id/resend",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  async (req: Request, res, next) => {
    try {
      const { id } = req.params;
      if (!id) {
        throw new AppError("Invitation ID is required", 400);
      }

      // Validate UUID format
      if (!isValidUuid(id)) {
        throw new AppError("Invalid invitation ID format", 400);
      }

      // Get user for authorization
      const user = (req as unknown as AuthenticatedRequest).user;
      const schoolId =
        user.role === "SCHOOL_ADMIN" ? user.schoolId ?? undefined : undefined;

      await resendInvitation(id, schoolId);
      return res.json({
        success: true,
        message: "Invitation resent successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
