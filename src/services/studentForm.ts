import { supabaseAdmin } from "../database/supabase";
import { AppError, NotFoundError, DbUser } from "../types";
import { Student, UpdateStudentRequest } from "./students";
import { getSchoolSettings } from "./schoolSettings";
import { mergeSchoolScopedStudentFields } from "./studentFields";

const transformUserToStudent = (user: DbUser, email: string): Student => {
  // Required fields - throw error if null/empty
  if (!user.first_name) {
    throw new AppError("Student first name is required", 500);
  }
  if (!user.last_name) {
    throw new AppError("Student last name is required", 500);
  }
  if (!email) {
    throw new AppError("Student email is required", 500);
  }
  if (!user.school_id) {
    throw new AppError("Student school ID is required", 500);
  }
  if (!user.preferred_disciplines || user.preferred_disciplines.length === 0) {
    throw new AppError(
      "Student must have at least one preferred discipline",
      500,
    );
  }

  const rawPreferredLanguage = user.preferred_language;
  const preferredLanguageArray = Array.isArray(rawPreferredLanguage)
    ? rawPreferredLanguage
    : rawPreferredLanguage
      ? [rawPreferredLanguage]
      : [];

  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: email,
    whatsappNumber: user.whatsapp_number || "",
    dateOfBirth: user.date_of_birth || "",
    emergencyContact: user.emergency_contact || "",
    emergencyPhone: user.emergency_phone || "",
    medicalConditions: user.medical_conditions || "",
    skillLevel: user.skill_level ?? null,
    preferredDisciplines: user.preferred_disciplines,
    nationality: user.nationality || "",
    ...(user.weight !== null &&
      user.weight !== undefined && { weight: user.weight }),
    ...(user.height !== null &&
      user.height !== undefined && { height: user.height }),
    ...(user.can_swim !== null &&
      user.can_swim !== undefined && { canSwim: user.can_swim }),
    ...(user.primary_sport &&
      ["surf", "kitesurf", "wingfoil", "foil"].includes(user.primary_sport) && {
        primarySport: user.primary_sport as
          | "surf"
          | "kitesurf"
          | "wingfoil"
          | "foil",
      }),
    ridingBackground: user.riding_background || "",
    preferredDays: user.preferred_days || [],
    preferredTimeSlots: user.preferred_time_slots || [],
    preferredLessonTypes: user.preferred_lesson_types || [],
    preferredLanguage: preferredLanguageArray,
    consentPhysicalCondition:
      user.consent_physical_condition !== undefined &&
      user.consent_physical_condition !== null
        ? user.consent_physical_condition
        : true,
    consentTermsConditions:
      user.consent_terms_conditions !== undefined &&
      user.consent_terms_conditions !== null
        ? user.consent_terms_conditions
        : true,
    consentGdpr:
      user.consent_gdpr !== undefined && user.consent_gdpr !== null
        ? user.consent_gdpr
        : true,
    consentPhotosVideos:
      user.consent_photos_videos !== undefined &&
      user.consent_photos_videos !== null
        ? user.consent_photos_videos
        : true,
    consentMarketing:
      user.consent_marketing !== undefined && user.consent_marketing !== null
        ? user.consent_marketing
        : true,
    consentCustom1: user.consent_custom_1 ?? null,
    consentCustom2: user.consent_custom_2 ?? null,
    arrivalDate: user.arrival_date || "",
    departureDate: user.departure_date || "",
    stayNotes: user.stay_notes || "",
    notes: user.notes || "",
    schoolId: user.school_id,
    isActive: user.is_active,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
};

export const getStudentFormByToken = async (
  token: string,
): Promise<{
  student: Student;
  formSubmitted: boolean;
  formSubmittedAt: string | null;
  disciplines: any[];
  studentLevels: any[];
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
}> => {
  const { data: invitation, error: invitationError } = await supabaseAdmin
    .from("user_invitations")
    .select(
      `
      id,
      email,
      first_name,
      last_name,
      role,
      school_id,
      invitation_token,
      expires_at,
      is_used,
      user_id,
      form_submitted_at
    `,
    )
    .eq("invitation_token", token)
    .single();

  if (invitationError) {
    if (invitationError.code === "PGRST116") {
      throw new NotFoundError("Form link not found");
    }
    throw new AppError(
      `Failed to get form data: ${invitationError.message}`,
      500,
    );
  }

  if (!invitation) {
    throw new NotFoundError("Form link not found");
  }

  // if invitation is expired
  const expiresAt = new Date(invitation.expires_at);
  const now = new Date();
  if (expiresAt < now) {
    throw new AppError("Form link has expired", 400);
  }

  if (invitation.role !== "USER") {
    throw new AppError("This form is only for students", 400);
  }

  if (!invitation.user_id) {
    throw new AppError("Student not found", 404);
  }

  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", invitation.user_id)
    .eq("role", "USER")
    .single();

  if (userError || !user) {
    throw new NotFoundError("Student not found");
  }

  const { data: membership, error: membershipError } = await (supabaseAdmin as any)
    .from("student_schools")
    .select("*")
    .eq("student_id", invitation.user_id)
    .eq("school_id", invitation.school_id)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError) {
    throw new AppError(
      `Failed to validate student school membership: ${membershipError.message}`,
      500,
    );
  }

  if (!membership) {
    throw new AppError("Student does not belong to this school", 403);
  }

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
    invitation.user_id,
  );
  const email = authUser?.user?.email || invitation.email;

  const mergedStudent = mergeSchoolScopedStudentFields(user, membership);
  const student: Student = transformUserToStudent(mergedStudent, email);

  const schoolId = invitation.school_id;
  let disciplines: any[] = [];
  let studentLevels: any[] = [];

  try {
    const { data: disciplinesData, error: disciplinesError } = await (
      supabaseAdmin as any
    ).rpc("get_active_disciplines", { p_school_id: schoolId });

    if (!disciplinesError && disciplinesData) {
      disciplines = disciplinesData;
    }
  } catch (error) {
    console.error("Error fetching disciplines:", error);
  }

  try {
    const { data: levelsData, error: levelsError } = await (
      supabaseAdmin as any
    )
      .from("student_levels")
      .select("*")
      .eq("school_id", schoolId)
      .order("name", { ascending: true });

    if (!levelsError && levelsData) {
      studentLevels = levelsData;
    }
  } catch (error) {
    console.error("Error fetching student levels:", error);
  }

  // Fetch consent settings for this school
  let consentSettings = {
    termsConditionsUrl: null as string | null,
    termsConditionsLabel: null as Record<string, string> | null,
    customCheckbox1Enabled: false,
    customCheckbox1Label: null as Record<string, string> | null,
    customCheckbox1Url: null as string | null,
    customCheckbox1Mandatory: true,
    customCheckbox2Enabled: false,
    customCheckbox2Label: null as Record<string, string> | null,
    customCheckbox2Url: null as string | null,
    customCheckbox2Mandatory: true,
  };

  try {
    const settings = await getSchoolSettings(schoolId);
    consentSettings = {
      termsConditionsUrl: settings.termsConditionsUrl ?? null,
      termsConditionsLabel: (settings.termsConditionsLabel as Record<string, string>) ?? null,
      customCheckbox1Enabled: settings.customCheckbox1Enabled,
      customCheckbox1Label: (settings.customCheckbox1Label as Record<string, string>) ?? null,
      customCheckbox1Url: settings.customCheckbox1Url ?? null,
      customCheckbox1Mandatory: settings.customCheckbox1Mandatory,
      customCheckbox2Enabled: settings.customCheckbox2Enabled,
      customCheckbox2Label: (settings.customCheckbox2Label as Record<string, string>) ?? null,
      customCheckbox2Url: settings.customCheckbox2Url ?? null,
      customCheckbox2Mandatory: settings.customCheckbox2Mandatory,
    };
  } catch (error) {
    console.error("Error fetching consent settings:", error);
  }

  return {
    student,
    formSubmitted: invitation.form_submitted_at !== null,
    formSubmittedAt: invitation.form_submitted_at,
    disciplines,
    studentLevels,
    consentSettings,
  };
};

export const submitStudentForm = async (
  token: string,
  formData: UpdateStudentRequest,
): Promise<Student> => {
  const { data: invitation, error: invitationError } = await supabaseAdmin
    .from("user_invitations")
    .select(
      `
      id,
      email,
      role,
      school_id,
      user_id,
      expires_at,
      form_submitted_at
    `,
    )
    .eq("invitation_token", token)
    .single();

  if (invitationError) {
    if (invitationError.code === "PGRST116") {
      throw new NotFoundError("Form link not found");
    }
    throw new AppError("Failed to get form data", 500);
  }

  // Check if invitation is expired
  if (new Date(invitation.expires_at) < new Date()) {
    throw new AppError("Form link has expired", 400);
  }

  const now = new Date().toISOString();
  const { data: submissionLock, error: submissionLockError } =
    await supabaseAdmin
      .from("user_invitations")
      .update({ form_submitted_at: now })
      .eq("id", invitation.id)
      .is("form_submitted_at", null)
      .select("id, form_submitted_at")
      .single();

  if (submissionLockError) {
    throw new AppError("Failed to lock form submission", 500);
  }

  if (!submissionLock) {
    throw new AppError("Form has already been submitted", 400);
  }

  if (invitation.role !== "USER") {
    throw new AppError("This form is only for students", 400);
  }

  if (!invitation.user_id) {
    throw new AppError("Student not found", 404);
  }

  const { data: studentCheck, error: studentCheckError } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("id", invitation.user_id)
    .single();

  if (studentCheckError || !studentCheck) {
    throw new NotFoundError("Student not found");
  }

  const { data: membership, error: membershipError } = await (supabaseAdmin as any)
    .from("student_schools")
    .select("id")
    .eq("student_id", invitation.user_id)
    .eq("school_id", invitation.school_id)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError) {
    throw new AppError(
      `Failed to validate student school membership: ${membershipError.message}`,
      500,
    );
  }

  if (!membership) {
    throw new AppError("Student does not belong to this school", 403);
  }

  if (studentCheck.role !== "USER") {
    throw new AppError("User is not a student", 400);
  }

  const updatedAtNow = new Date().toISOString();
  const userUpdateData: any = {
    updated_at: updatedAtNow,
  };
  const membershipUpdateData: any = {
    updated_at: updatedAtNow,
  };

  if (formData.firstName !== undefined)
    userUpdateData.first_name = formData.firstName || null;
  if (formData.lastName !== undefined)
    userUpdateData.last_name = formData.lastName || null;
  if (formData.dateOfBirth !== undefined)
    userUpdateData.date_of_birth = formData.dateOfBirth || null;
  if (formData.emergencyContact !== undefined)
    userUpdateData.emergency_contact = formData.emergencyContact || null;
  if (formData.emergencyPhone !== undefined)
    userUpdateData.emergency_phone = formData.emergencyPhone || null;
  if (formData.medicalConditions !== undefined)
    userUpdateData.medical_conditions = formData.medicalConditions || null;
  if (formData.skillLevel !== undefined) {
    membershipUpdateData.skill_level = formData.skillLevel || null;
  }
  if (formData.preferredDisciplines !== undefined) {
    if (
      !formData.preferredDisciplines ||
      formData.preferredDisciplines.length === 0
    ) {
      throw new AppError(
        "At least one preferred discipline must be selected",
        400,
      );
    }
    membershipUpdateData.preferred_disciplines = formData.preferredDisciplines;
  }
  if (formData.whatsappNumber !== undefined)
    userUpdateData.whatsapp_number = formData.whatsappNumber || null;
  if (formData.nationality !== undefined)
    userUpdateData.nationality = formData.nationality || null;
  if (formData.weight !== undefined)
    userUpdateData.weight = formData.weight !== null ? formData.weight : null;
  if (formData.height !== undefined)
    userUpdateData.height = formData.height !== null ? formData.height : null;
  if (formData.canSwim !== undefined) userUpdateData.can_swim = formData.canSwim;
  if (formData.primarySport !== undefined)
    membershipUpdateData.primary_sport = formData.primarySport || null;
  if (formData.ridingBackground !== undefined)
    membershipUpdateData.riding_background = formData.ridingBackground || null;
  if (formData.preferredDays !== undefined)
    membershipUpdateData.preferred_days = [...(formData.preferredDays ?? [])];
  if (formData.preferredTimeSlots !== undefined)
    membershipUpdateData.preferred_time_slots = [...(formData.preferredTimeSlots ?? [])];
  if (formData.preferredLessonTypes !== undefined)
    membershipUpdateData.preferred_lesson_types = [
      ...(formData.preferredLessonTypes ?? []),
    ];
  if (formData.preferredLanguage !== undefined)
    membershipUpdateData.preferred_language = formData.preferredLanguage ?? [];
  if (formData.consentPhysicalCondition !== undefined)
    membershipUpdateData.consent_physical_condition = formData.consentPhysicalCondition;
  if (formData.consentTermsConditions !== undefined)
    membershipUpdateData.consent_terms_conditions = formData.consentTermsConditions;
  if (formData.consentGdpr !== undefined)
    membershipUpdateData.consent_gdpr = formData.consentGdpr;
  if (formData.consentPhotosVideos !== undefined)
    membershipUpdateData.consent_photos_videos = formData.consentPhotosVideos;
  if (formData.consentMarketing !== undefined)
    membershipUpdateData.consent_marketing = formData.consentMarketing;
  if (formData.consentCustom1 !== undefined)
    membershipUpdateData.consent_custom_1 = formData.consentCustom1;
  if (formData.consentCustom2 !== undefined)
    membershipUpdateData.consent_custom_2 = formData.consentCustom2;
  if (formData.arrivalDate !== undefined)
    membershipUpdateData.arrival_date = formData.arrivalDate || null;
  if (formData.departureDate !== undefined)
    membershipUpdateData.departure_date = formData.departureDate || null;
  if (formData.stayNotes !== undefined)
    membershipUpdateData.stay_notes = formData.stayNotes || null;
  if (formData.notes !== undefined) membershipUpdateData.notes = formData.notes || null;

  const { data: updatedUser, error: updateError } = await supabaseAdmin
    .from("users")
    .update(userUpdateData)
    .eq("id", invitation.user_id)
    .eq("role", "USER")
    .select("*")
    .single();

  if (updateError || !updatedUser) {
    await supabaseAdmin
      .from("user_invitations")
      .update({ form_submitted_at: null })
      .eq("id", invitation.id);
    throw new AppError("Failed to update student information", 500);
  }

  const { data: updatedMembership, error: updateMembershipError } = await (
    supabaseAdmin as any
  )
    .from("student_schools")
    .update(membershipUpdateData)
    .eq("student_id", invitation.user_id)
    .eq("school_id", invitation.school_id)
    .eq("is_active", true)
    .select("*")
    .maybeSingle();

  if (updateMembershipError || !updatedMembership) {
    await supabaseAdmin
      .from("user_invitations")
      .update({ form_submitted_at: null })
      .eq("id", invitation.id);
    throw new AppError("Failed to update student school information", 500);
  }

  if (!submissionLock?.form_submitted_at) {
    throw new AppError("Failed to mark form as submitted", 500);
  }

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
    invitation.user_id,
  );
  const email = authUser?.user?.email || invitation.email;

  const mergedUpdatedStudent = mergeSchoolScopedStudentFields(
    updatedUser,
    updatedMembership,
  );
  return transformUserToStudent(mergedUpdatedStudent, email);
};
