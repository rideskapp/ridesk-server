/**
 * @fileoverview Instructor-School management routes
 * @description Handles many-to-many relationships between instructors and schools
 * @author Ridesk Team
 * @version 1.0.0
 */

import { Router } from "express";
import {
  assignInstructorToSchool,
  removeInstructorFromSchool,
  getInstructorSchools,
  getSchoolInstructors,
  updateInstructorSchoolAssignment,
} from "../services/instructorSchools";
import { validate } from "../middleware/validation";
import { authenticate, authorizeRoles } from "../middleware/auth";
import { AppError, AuthenticatedRequest } from "../types";
import Joi from "joi";

const router = Router();

/**
 * @swagger
 * /api/instructor-schools/assign:
 *   post:
 *     summary: Assign instructor to school
 *     description: Assign an instructor to work at a school with optional rates and primary status
 *     tags: [Instructor Schools]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - instructorId
 *               - schoolId
 *             properties:
 *               instructorId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the instructor
 *               schoolId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the school
 *               isPrimary:
 *                 type: boolean
 *                 description: Whether this is the instructor's primary school
 *               hourlyRate:
 *                 type: number
 *                 format: decimal
 *                 description: School-specific hourly rate
 *               commissionRate:
 *                 type: number
 *                 format: decimal
 *                 description: School-specific commission rate (percentage)
 *     responses:
 *       200:
 *         description: Instructor successfully assigned to school
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/InstructorSchoolAssignment'
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
router.post(
  "/assign",
  authenticate,
  authorizeRoles(["SUPER_ADMIN", "SCHOOL_ADMIN"]),
  validate(
    Joi.object({
      instructorId: Joi.string().uuid().required(),
      schoolId: Joi.string().uuid().required(),
      isPrimary: Joi.boolean().optional(),
      hourlyRate: Joi.number().positive().optional(),
      commissionRate: Joi.number().min(0).max(100).optional(),
    }),
    "body",
  ),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const assignmentData = req.body;

      // SCHOOL_ADMIN can only assign instructors to their own school
      if (authReq.user.role === "SCHOOL_ADMIN") {
        if (assignmentData.schoolId !== authReq.user.schoolId) {
          throw new AppError(
            "You can only assign instructors to your own school",
            403,
          );
        }
      }

      const result = await assignInstructorToSchool(assignmentData);

      res.json({
        success: true,
        data: result,
        message: "Instructor assigned to school successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/instructor-schools/remove:
 *   delete:
 *     summary: Remove instructor from school
 *     description: Remove an instructor from a school
 *     tags: [Instructor Schools]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instructorId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the instructor
 *       - in: query
 *         name: schoolId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the school
 *     responses:
 *       200:
 *         description: Instructor successfully removed from school
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
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  "/remove",
  authenticate,
  authorizeRoles(["SUPER_ADMIN", "SCHOOL_ADMIN"]),
  validate(
    Joi.object({
      instructorId: Joi.string().uuid().required(),
      schoolId: Joi.string().uuid().required(),
    }),
    "query",
  ),
  async (req, res, next) => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { instructorId, schoolId } = req.query;

      // SCHOOL_ADMIN can only remove instructors from their own school
      if (authReq.user.role === "SCHOOL_ADMIN") {
        if (schoolId !== authReq.user.schoolId) {
          throw new AppError(
            "You can only remove instructors from your own school",
            403,
          );
        }
      }

      const result = await removeInstructorFromSchool(
        instructorId as string,
        schoolId as string,
      );

      res.json({
        success: true,
        data: result,
        message: "Instructor removed from school successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/instructor-schools/instructor/{instructorId}:
 *   get:
 *     summary: Get instructor's school assignments
 *     description: Get all schools where an instructor works
 *     tags: [Instructor Schools]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instructorId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the instructor
 *     responses:
 *       200:
 *         description: List of instructor's school assignments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/InstructorSchoolAssignment'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/instructor/:instructorId",
  authenticate,
  async (req, res, next) => {
    try {
      const { instructorId } = req.params;

      if (!instructorId) {
        throw new AppError("Instructor ID is required", 400);
      }

      const result = await getInstructorSchools(instructorId);

      res.json({
        success: true,
        data: result,
        message: "Instructor schools retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/instructor-schools/school/{schoolId}:
 *   get:
 *     summary: Get school's instructors
 *     description: Get all instructors working at a school
 *     tags: [Instructor Schools]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schoolId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the school
 *     responses:
 *       200:
 *         description: List of school's instructors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/InstructorSchoolAssignment'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/school/:schoolId", authenticate, async (req, res, next) => {
  try {
    const { schoolId } = req.params;

    if (!schoolId) {
      throw new AppError("School ID is required", 400);
    }

    const result = await getSchoolInstructors(schoolId);

    res.json({
      success: true,
      data: result,
      message: "School instructors retrieved successfully",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/instructor-schools/{assignmentId}:
 *   put:
 *     summary: Update instructor school assignment
 *     description: Update an instructor's school assignment (rates, primary status, etc.)
 *     tags: [Instructor Schools]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the assignment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isPrimary:
 *                 type: boolean
 *                 description: Whether this is the instructor's primary school
 *               hourlyRate:
 *                 type: number
 *                 format: decimal
 *                 description: School-specific hourly rate
 *               commissionRate:
 *                 type: number
 *                 format: decimal
 *                 description: School-specific commission rate (percentage)
 *               isActive:
 *                 type: boolean
 *                 description: Whether the assignment is active
 *     responses:
 *       200:
 *         description: Assignment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/InstructorSchoolAssignment'
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
router.put(
  "/:assignmentId",
  authenticate,
  authorizeRoles(["SUPER_ADMIN", "SCHOOL_ADMIN"]),
  validate(
    Joi.object({
      isPrimary: Joi.boolean().optional(),
      hourlyRate: Joi.number().positive().optional(),
      commissionRate: Joi.number().min(0).max(100).optional(),
      isActive: Joi.boolean().optional(),
    }),
    "body",
  ),
  async (req, res, next) => {
    try {
      const { assignmentId } = req.params;

      if (!assignmentId) {
        throw new AppError("Assignment ID is required", 400);
      }

      const result = await updateInstructorSchoolAssignment(
        assignmentId,
        req.body,
      );

      res.json({
        success: true,
        data: result,
        message: "Assignment updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
