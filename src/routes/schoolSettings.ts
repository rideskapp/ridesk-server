import { Router } from "express";
import {
  getSchoolSettings,
  updateSchoolSettings,
} from "../services/schoolSettings";
import { AppError } from "../types";
import { authenticate, authorizeSchoolAccess } from "../middleware/auth";
import { validate, updateSchoolSettingsSchema } from "../middleware/validation";

const router = Router();

/**
 * @swagger
 * /api/school-settings/{schoolId}:
 *   get:
 *     summary: Get school settings
 *     description: Get school settings by school ID. SUPER_ADMIN can access any school, SCHOOL_ADMIN can only access their own school.
 *     tags: [School Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schoolId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID
 *     responses:
 *       200:
 *         description: School settings retrieved successfully
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
 *                         schoolId:
 *                           type: string
 *                           format: uuid
 *                         lessonColorScheme:
 *                           type: string
 *                           enum: [discipline, student_level, category]
 *                         customColorOverrides:
 *                           type: object
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
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
router.get(
  "/:schoolId",
  authenticate,
  authorizeSchoolAccess,
  async (req, res, next) => {
    try {
      const schoolId = req.params["schoolId"];
      if (!schoolId) {
        throw new AppError("School ID is required", 400);
      }

      const settings = await getSchoolSettings(schoolId);

      res.json({
        success: true,
        data: settings,
        message: "School settings retrieved successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/school-settings/{schoolId}:
 *   put:
 *     summary: Update school settings
 *     description: Update school settings. SUPER_ADMIN can update any school, SCHOOL_ADMIN can only update their own school.
 *     tags: [School Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: schoolId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lessonColorScheme:
 *                 type: string
 *                 enum: [discipline, student_level, category]
 *               customColorOverrides:
 *                 type: object
 *     responses:
 *       200:
 *         description: School settings updated successfully
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
 *                         schoolId:
 *                           type: string
 *                           format: uuid
 *                         lessonColorScheme:
 *                           type: string
 *                           enum: [discipline, student_level, category]
 *                         customColorOverrides:
 *                           type: object
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
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
  "/:schoolId",
  authenticate,
  authorizeSchoolAccess,
  validate(updateSchoolSettingsSchema),
  async (req, res, next) => {
    try {
      const schoolId = req.params["schoolId"];
      if (!schoolId) {
        throw new AppError("School ID is required", 400);
      }

      const settingsData = req.body;
      const settings = await updateSchoolSettings(schoolId, settingsData);

      res.json({
        success: true,
        data: settings,
        message: "School settings updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;

