import { Router } from "express";
import Joi from "joi";
import { authenticate, authorizeRoles } from "../middleware/auth";
import { validate } from "../middleware/validation";
import { AuthenticatedRequest } from "../types";
import { supabaseAdmin } from "../database/supabase";
import {
  canInstructorEditLessonsInSchool,
  listInstructorLessonPermissionsBySchool,
  removeInstructorLessonEditPermission,
  setInstructorLessonEditPermission,
} from "../services/instructorLessonPermissions";

const router = Router();

const permissionPayloadSchema = Joi.object({
  instructorId: Joi.string().uuid().required(),
  schoolId: Joi.string().uuid().required(),
  canEditLessons: Joi.boolean().required(),
});

const permissionQuerySchema = Joi.object({
  schoolId: Joi.string().uuid().optional(),
});

const permissionDeleteSchema = Joi.object({
  instructorId: Joi.string().uuid().required(),
  schoolId: Joi.string().uuid().required(),
});

const resolveTargetSchoolId = (
  user: AuthenticatedRequest["user"],
  requestedSchoolId?: string,
): string | undefined => {
  if (user.role === "SUPER_ADMIN" && requestedSchoolId) {
    return requestedSchoolId;
  }
  if (user.role === "SCHOOL_ADMIN") {
    return user.schoolId || undefined;
  }
  return undefined;
};

router.get(
  "/",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  validate(permissionQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const user = (req as unknown as AuthenticatedRequest).user;
      const requestedSchoolId = req.query["schoolId"] as string | undefined;
      const targetSchoolId = resolveTargetSchoolId(user, requestedSchoolId);

      if (!targetSchoolId) {
        return res.status(403).json({
          success: false,
          error: "School ID is required",
        });
      }

      const permissions =
        await listInstructorLessonPermissionsBySchool(targetSchoolId);

      return res.json({ success: true, data: permissions });
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  "/me",
  authenticate,
  authorizeRoles(["INSTRUCTOR"]),
  validate(permissionQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const user = (req as unknown as AuthenticatedRequest).user;
      const requestedSchoolId = req.query["schoolId"] as string | undefined;
      let schoolId = requestedSchoolId;

      if (!schoolId) {
        const { data: assoc, error: assocError } = await (supabaseAdmin as any)
          .from("instructor_schools")
          .select("school_id")
          .eq("instructor_id", user.id)
          .eq("is_active", true)
          .eq("is_primary", true)
          .maybeSingle();
        if (assocError) {
          return res.status(500).json({
            success: false,
            error: "Failed to resolve school permission scope",
          });
        }
        schoolId = assoc?.school_id;
      }

      if (!schoolId) {
        return res.json({
          success: true,
          data: { schoolId: null, canEditLessons: false },
        });
      }

      const canEditLessons = await canInstructorEditLessonsInSchool(
        user.id,
        schoolId,
      );

      return res.json({
        success: true,
        data: { schoolId, canEditLessons },
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.put(
  "/",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  validate(permissionPayloadSchema),
  async (req, res, next) => {
    try {
      const user = (req as unknown as AuthenticatedRequest).user;
      const { instructorId, schoolId, canEditLessons } = req.body as {
        instructorId: string;
        schoolId: string;
        canEditLessons: boolean;
      };

      const targetSchoolId = resolveTargetSchoolId(user, schoolId);
      if (!targetSchoolId || targetSchoolId !== schoolId) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      const updated = await setInstructorLessonEditPermission(
        instructorId,
        schoolId,
        canEditLessons,
        user.id,
      );

      return res.json({ success: true, data: updated });
    } catch (error) {
      return next(error);
    }
  },
);

router.delete(
  "/",
  authenticate,
  authorizeRoles(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  validate(permissionDeleteSchema, "query"),
  async (req, res, next) => {
    try {
      const user = (req as unknown as AuthenticatedRequest).user;
      const instructorId = req.query["instructorId"] as string;
      const schoolId = req.query["schoolId"] as string;
      const targetSchoolId = resolveTargetSchoolId(user, schoolId);

      if (!targetSchoolId || targetSchoolId !== schoolId) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      await removeInstructorLessonEditPermission(instructorId, schoolId);
      return res.json({ success: true, data: { instructorId, schoolId } });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
