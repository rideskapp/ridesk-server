import { Router } from "express";
import { supabaseAdmin } from "../database/supabase";
import { AppError, NotFoundError } from "../types";
import { getSchoolById, getSchoolBySlug } from "../services/schools";

const router = Router();

const resolveSchoolId = async (
  identifier: string,
): Promise<{ schoolId: string; name: string | null; logo: string | null }> => {
  // Try as UUID first, then as slug
  try {
    const school = await getSchoolById(identifier);
    return {
      schoolId: school.id,
      name: school.name,
      logo: school.logo ?? null,
    };
  } catch {
    try {
      const school = await getSchoolBySlug(identifier);
      return {
        schoolId: school.id,
        name: school.name,
        logo: school.logo ?? null,
      };
    } catch {
      throw new NotFoundError("School not found");
    }
  }
};

/**
 * Public endpoint to fetch basic school info for instructor registration
 */
router.get(
  "/:schoolIdentifier",
  async (req, res, next) => {
    try {
      const { schoolIdentifier } = req.params as { schoolIdentifier: string };

      const { schoolId, name, logo } = await resolveSchoolId(schoolIdentifier);

      return res.json({
        success: true,
        data: {
          schoolId,
          name,
          logo,
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

interface InstructorRegistrationRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  whatsappNumber?: string;
  specialties?: string[];
  certifications?: string[];
  languages?: string[];
  isPrimary?: boolean;
}

/**
 * Public endpoint to register or link an instructor to a school
 *
 * Behaviour:
 * - If a Supabase auth user + instructor profile already exist for the email:
 *   - Link them to the school via instructor_schools (if not already linked).
 * - If no such user exists:
 *   - Create auth user with given password.
 *   - Create users row with role INSTRUCTOR.
 *   - Link to school via instructor_schools.
 */
router.post(
  "/:schoolIdentifier",
  async (req, res, next) => {
    try {
      const { schoolIdentifier } = req.params as { schoolIdentifier: string };
      const payload = req.body as InstructorRegistrationRequest;

      if (!payload.email || !payload.firstName || !payload.lastName || !payload.password) {
        return res.status(400).json({
          success: false,
          error: "firstName, lastName, email and password are required",
        });
      }

      const { schoolId } = await resolveSchoolId(schoolIdentifier);

      // 1. Check if auth user exists for this email
      const { data: usersData, error: listError } =
        await supabaseAdmin.auth.admin.listUsers();

      if (listError) {
        throw new AppError("Failed to check existing users", 500);
      }

      const existingAuthUser = usersData.users.find(
        (user) => user.email === payload.email,
      );

      let instructorUserId: string;

      if (existingAuthUser) {
        instructorUserId = existingAuthUser.id;

        // Ensure there is a users row with role INSTRUCTOR
        const { data: existingProfile } = await supabaseAdmin
          .from("users")
          .select("*")
          .eq("id", instructorUserId)
          .maybeSingle();

        if (existingProfile && existingProfile.role !== "INSTRUCTOR") {
          return res.status(400).json({
            success: false,
            error:
              "An account with this email already exists but is not an instructor. Please contact support.",
          });
        }

        if (!existingProfile) {
          const { error: profileError } = await supabaseAdmin
            .from("users")
            .insert({
              id: instructorUserId,
              role: "INSTRUCTOR",
              school_id: null,
              first_name: payload.firstName,
              last_name: payload.lastName,
              whatsapp_number: payload.whatsappNumber || null,
              specialties: payload.specialties || null,
              certifications: payload.certifications || null,
              languages: payload.languages || null,
              is_primary: payload.isPrimary ?? true,
              is_active: true,
            });

          if (profileError) {
            throw new AppError("Failed to create instructor profile", 500);
          }
        }
      } else {
        // Create new auth user
        const { data: authUser, error: authError } =
          await supabaseAdmin.auth.admin.createUser({
            email: payload.email,
            password: payload.password,
            email_confirm: true,
          });

        if (authError || !authUser?.user) {
          throw new AppError("Failed to create instructor account", 500);
        }

        instructorUserId = authUser.user.id;

        const { error: profileError } = await supabaseAdmin
          .from("users")
          .insert({
            id: instructorUserId,
            role: "INSTRUCTOR",
            school_id: null,
            first_name: payload.firstName,
            last_name: payload.lastName,
            whatsapp_number: payload.whatsappNumber || null,
            specialties: payload.specialties || null,
            certifications: payload.certifications || null,
            languages: payload.languages || null,
            is_primary: payload.isPrimary ?? true,
            is_active: true,
          });

        if (profileError) {
          // Best-effort cleanup
          await supabaseAdmin.auth.admin.deleteUser(instructorUserId);
          throw new AppError("Failed to create instructor profile", 500);
        }
      }

      // 2. Link instructor to school via instructor_schools
      const { data: existingLink } = await supabaseAdmin
        .from("instructor_schools")
        .select("*")
        .eq("instructor_id", instructorUserId)
        .eq("school_id", schoolId)
        .maybeSingle();

      if (existingLink) {
        if (existingLink.is_active) {
          return res.status(200).json({
            success: true,
            data: {
              alreadyLinked: true,
              message: "You are already linked to this school as an instructor.",
            },
          });
        }

        const { error: reactivateError } = await supabaseAdmin
          .from("instructor_schools")
          .update({
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingLink.id);

        if (reactivateError) {
          throw new AppError("Failed to reactivate instructor for this school", 500);
        }

        return res.status(200).json({
          success: true,
          data: {
            reactivated: true,
            message: "Your instructor access for this school has been reactivated.",
          },
        });
      }

      const { error: linkError } = await supabaseAdmin
        .from("instructor_schools")
        .insert({
          instructor_id: instructorUserId,
          school_id: schoolId,
          is_active: true,
        });

      if (linkError) {
        throw new AppError("Failed to link instructor to school", 500);
      }

      return res.status(201).json({
        success: true,
        data: {
          created: !existingAuthUser,
          message: existingAuthUser
            ? "You have been linked to this school as an instructor."
            : "Your instructor account has been created and linked to this school.",
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;

