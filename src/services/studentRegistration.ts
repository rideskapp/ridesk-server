import { supabaseAdmin } from "../database/supabase";
import { AppError, NotFoundError } from "../types";
import { getSchoolById, getSchoolBySlug } from "./schools";
import { getSchoolSettings } from "./schoolSettings";
import { requestPasswordReset } from "./auth";
import { buildSchoolScopedStudentFields as buildSharedSchoolScopedStudentFields } from "./studentFields";

export interface StudentRegistrationContext {
  schoolId: string;
  name: string | null;
  logo: string | null;
  disciplines: Array<{
    id: string;
    name: string;
    slug: string;
    display_name: string;
    color?: string;
  }>;
  studentLevels: Array<{
    id: string;
    name: string;
    slug: string;
    color?: string;
    is_active?: boolean;
    active?: boolean;
  }>;
  consentSettings: {
    termsConditionsUrl: string | null;
    termsConditionsLabel: Record<string, string> | null;
    customCheckbox1Enabled: boolean;
    customCheckbox1Label: Record<string, string> | null;
    customCheckbox1Url: string | null;
    customCheckbox1Mandatory: boolean;
    customCheckbox2Enabled: boolean;
    customCheckbox2Label: Record<string, string> | null;
    customCheckbox2Url: string | null;
    customCheckbox2Mandatory: boolean;
  };
}

export interface PublicStudentRegistrationRequest {
  email: string;
  firstName: string;
  lastName: string;
  whatsappNumber: string;
  dateOfBirth?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  medicalConditions?: string;
  skillLevel: string;
  preferredDisciplines: string[];
  nationality?: string;
  weight?: number;
  height?: number;
  canSwim?: boolean;
  primarySport?: "surf" | "kitesurf" | "wingfoil" | "foil";
  ridingBackground?: string;
  preferredDays?: string[];
  preferredTimeSlots?: string[];
  preferredLessonTypes?: string[];
  preferredLanguage?: string[];
  consentPhysicalCondition?: boolean;
  consentTermsConditions?: boolean;
  consentGdpr?: boolean;
  consentPhotosVideos?: boolean;
  consentMarketing?: boolean;
  consentCustom1?: boolean | null;
  consentCustom2?: boolean | null;
  arrivalDate?: string;
  departureDate?: string;
  stayNotes?: string;
  notes?: string;
}

const toNull = (value?: string | null): string | null => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const buildRegistrationSchoolScopedStudentFields = (
  payload: PublicStudentRegistrationRequest,
): Record<string, any> => ({
  ...buildSharedSchoolScopedStudentFields({
    ...payload,
    skillLevel: payload.skillLevel?.trim(),
    preferredDisciplines: [...(payload.preferredDisciplines ?? [])],
    preferredDays: [...(payload.preferredDays ?? [])],
    preferredTimeSlots: [...(payload.preferredTimeSlots ?? [])],
    preferredLessonTypes: [...(payload.preferredLessonTypes ?? [])],
    preferredLanguage: [...(payload.preferredLanguage ?? [])],
    consentPhysicalCondition: payload.consentPhysicalCondition ?? true,
    consentTermsConditions: payload.consentTermsConditions ?? true,
    consentGdpr: payload.consentGdpr ?? true,
    consentPhotosVideos: payload.consentPhotosVideos ?? true,
    consentMarketing: payload.consentMarketing ?? true,
  }),
  riding_background: toNull(payload.ridingBackground),
  arrival_date: toNull(payload.arrivalDate),
  departure_date: toNull(payload.departureDate),
  stay_notes: toNull(payload.stayNotes),
  notes: toNull(payload.notes),
  updated_at: new Date().toISOString(),
});

const resolveSchoolId = async (
  identifier: string,
): Promise<{ schoolId: string; name: string | null; logo: string | null }> => {
  try {
    const school = await getSchoolById(identifier);
    return { schoolId: school.id, name: school.name, logo: school.logo ?? null };
  } catch {
    try {
      const school = await getSchoolBySlug(identifier);
      return { schoolId: school.id, name: school.name, logo: school.logo ?? null };
    } catch {
      throw new NotFoundError("School not found");
    }
  }
};

export const getStudentRegistrationContext = async (
  schoolIdentifier: string,
): Promise<StudentRegistrationContext> => {
  const { schoolId, name, logo } = await resolveSchoolId(schoolIdentifier);

  const { data: disciplinesData, error: disciplinesError } = await (supabaseAdmin as any)
    .rpc("get_active_disciplines", { p_school_id: schoolId });
  if (disciplinesError) {
    throw new AppError("Failed to fetch disciplines", 500);
  }

  const { data: levelsData, error: levelsError } = await (supabaseAdmin as any)
    .from("student_levels")
    .select("*")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });
  if (levelsError) {
    throw new AppError("Failed to fetch student levels", 500);
  }

  const settings = await getSchoolSettings(schoolId);

  return {
    schoolId,
    name,
    logo,
    disciplines: disciplinesData || [],
    studentLevels: levelsData || [],
    consentSettings: {
      termsConditionsUrl: settings.termsConditionsUrl ?? null,
      termsConditionsLabel:
        (settings.termsConditionsLabel as Record<string, string>) ?? null,
      customCheckbox1Enabled: settings.customCheckbox1Enabled,
      customCheckbox1Label:
        (settings.customCheckbox1Label as Record<string, string>) ?? null,
      customCheckbox1Url: settings.customCheckbox1Url ?? null,
      customCheckbox1Mandatory: settings.customCheckbox1Mandatory,
      customCheckbox2Enabled: settings.customCheckbox2Enabled,
      customCheckbox2Label:
        (settings.customCheckbox2Label as Record<string, string>) ?? null,
      customCheckbox2Url: settings.customCheckbox2Url ?? null,
      customCheckbox2Mandatory: settings.customCheckbox2Mandatory,
    },
  };
};

export const registerOrLinkStudentPublic = async (
  schoolIdentifier: string,
  payload: PublicStudentRegistrationRequest,
): Promise<{ created?: boolean; alreadyLinked?: boolean; reactivated?: boolean; message: string }> => {
  const { schoolId } = await resolveSchoolId(schoolIdentifier);

  const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    throw new AppError("Failed to check existing users", 500);
  }

  let created = false;
  const existingAuthUser = usersData.users.find((u) => u.email === payload.email);
  let studentId = existingAuthUser?.id;

  if (!studentId) {
    const randomPassword = `Temp-${Math.random().toString(36).slice(2, 10)}!9`;
    const { data: createdAuth, error: createAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email: payload.email,
        password: randomPassword,
        email_confirm: true,
      });
    if (createAuthError || !createdAuth?.user) {
      throw new AppError("Failed to create student account", 500);
    }
    created = true;
    studentId = createdAuth.user.id;
  }

  if (!studentId) {
    throw new AppError("Failed to resolve student account", 500);
  }

  const { data: existingProfile, error: profileError } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", studentId)
    .maybeSingle();
  if (profileError) {
    throw new AppError("Failed to check student profile", 500);
  }

  if (existingProfile && existingProfile.role !== "USER") {
    throw new AppError(
      "An account with this email exists but is not a student account",
      400,
    );
  }

  const profileUpdate: Record<string, any> = {
    first_name: payload.firstName.trim(),
    last_name: payload.lastName.trim(),
    whatsapp_number: payload.whatsappNumber.trim(),
    date_of_birth: toNull(payload.dateOfBirth),
    emergency_contact: toNull(payload.emergencyContact),
    emergency_phone: toNull(payload.emergencyPhone),
    medical_conditions: toNull(payload.medicalConditions),
    nationality: toNull(payload.nationality),
    weight: payload.weight ?? null,
    height: payload.height ?? null,
    can_swim: payload.canSwim ?? null,
    role: "USER",
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  // Keep users.school_id as primary-school metadata for compatibility.
  if (!existingProfile?.["school_id"]) {
    profileUpdate["school_id"] = schoolId;
  }

  if (!existingProfile) {
    const { data: inserted, error: insertProfileError } = await (supabaseAdmin as any)
      .from("users")
      .insert({
        id: studentId,
        ...profileUpdate,
        school_id: schoolId,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (insertProfileError || !inserted) {
      throw new AppError("Failed to create student profile", 500);
    }
  } else {
    const { data: updated, error: updateProfileError } = await (supabaseAdmin as any)
      .from("users")
      .update(profileUpdate)
      .eq("id", studentId)
      .select("*")
      .single();
    if (updateProfileError || !updated) {
      throw new AppError("Failed to update student profile", 500);
    }
  }

  const { data: existingLink, error: existingLinkError } = await (supabaseAdmin as any)
    .from("student_schools")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (existingLinkError) {
    throw new AppError("Failed to check student-school relationship", 500);
  }

  let alreadyLinked = false;
  let reactivated = false;

  if (existingLink) {
    alreadyLinked = existingLink.is_active;
    if (!existingLink.is_active) {
      const { error: reactivateError } = await (supabaseAdmin as any)
        .from("student_schools")
        .update({
          is_active: true,
          ...buildRegistrationSchoolScopedStudentFields(payload),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingLink.id);
      if (reactivateError) {
        throw new AppError("Failed to reactivate school membership", 500);
      }
      reactivated = true;
      alreadyLinked = false;
    }
  } else {
    const {
      data: primaryMembership,
      error: primaryMembershipError,
    } = await (supabaseAdmin as any)
      .from("student_schools")
      .select("id")
      .eq("student_id", studentId)
      .eq("is_primary", true)
      .maybeSingle();

    if (primaryMembershipError) {
      throw new AppError(
        `Failed to determine primary school membership: ${primaryMembershipError.message}`,
        500,
      );
    }

    const shouldBePrimary = !Boolean(primaryMembership?.id);

    const { error: createMembershipError } = await (supabaseAdmin as any)
      .from("student_schools")
      .insert({
        student_id: studentId,
        school_id: schoolId,
        is_primary: shouldBePrimary,
        is_active: true,
        consented_at: new Date().toISOString(),
        ...buildRegistrationSchoolScopedStudentFields(payload),
      });
    if (createMembershipError) {
      throw new AppError("Failed to link student to school", 500);
    }
  }

  if (existingLink && alreadyLinked) {
    const { error: updateMembershipError } = await (supabaseAdmin as any)
      .from("student_schools")
      .update(buildRegistrationSchoolScopedStudentFields(payload))
      .eq("id", existingLink.id);
    if (updateMembershipError) {
      throw new AppError("Failed to update student school profile", 500);
    }
  }

  // Trigger OTP setup so users can create/reset their password.
  await requestPasswordReset(payload.email);

  if (alreadyLinked) {
    return {
      alreadyLinked: true,
      message:
        "Student profile updated. Account was already linked to this school. OTP sent for password setup.",
    };
  }

  if (reactivated) {
    return {
      reactivated: true,
      message:
        "Student profile updated. School access reactivated successfully. OTP sent for password setup.",
    };
  }

  return {
    created,
    message: created
      ? "Student account created and linked to this school. OTP sent for password setup."
      : "Student linked to this school successfully. OTP sent for password setup.",
  };
};
