/**
 * @fileoverview Student management service for Ridesk Server
 * @description Handles student CRUD operations using the users table with role filtering
 * @author Ridesk Team
 * @version 1.0.1
 */

import { supabaseAdmin } from "../database/supabase";
import { AppError, NotFoundError, DbUser } from "../types";
import { Database } from "../database/types";
import { getSchoolById } from "./schools";
import {
  buildSchoolScopedStudentFields,
  mergeSchoolScopedStudentFields,
} from "./studentFields";

// Helper function to transform database user to Student interface
const transformUserToStudent = (
  user: DbUser,
  email: string | null,
): Student => {
  // Required fields - throw error if null/empty
  if (!user.first_name) {
    throw new AppError("Student first name is required", 500);
  }
  if (!user.last_name) {
    throw new AppError("Student last name is required", 500);
  }
  if (email === null) {
    console.error(`Student record ${user.id} is missing email in auth system.`);
    throw new AppError(`Student email not found for user ${user.id}`, 500);
  }
  if (!user.school_id) {
    throw new AppError("Student school ID is required", 500);
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
    preferredDisciplines: user.preferred_disciplines || [],
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

// Helper to reliably fetch emails for a list of users
// Note: Ideally this would be a bulk query, but the 'auth' schema is not exposed to PostgREST
// and listUsers() does not support filtering by ID. We must use parallel getUserById calls.
const fetchEmailsForUsers = async (
  userIds: string[],
): Promise<Map<string, string | null>> => {
  const emailMap = new Map<string, string | null>();
  const CHUNK_SIZE = 10;

  if (userIds.length === 0) return emailMap;

  // Process in chunks to limit concurrency
  for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
    const chunk = userIds.slice(i, i + CHUNK_SIZE);

    await Promise.all(
      chunk.map(async (id) => {
        try {
          const { data: authUser, error } =
            await supabaseAdmin.auth.admin.getUserById(id);
          if (error || !authUser?.user?.email) {
            console.warn(
              `Could not fetch email for user ${id}:`,
              error || "Email missing",
            );
            emailMap.set(id, null);
          } else {
            emailMap.set(id, authUser.user.email);
          }
        } catch (err) {
          console.error(`Exception fetching email for user ${id}:`, err);
          emailMap.set(id, null);
        }
      }),
    );
  }

  return emailMap;
};

/** Sanitized failure type safe for client responses */
type StudentTransformFailure = { id: string; message: string };

/** Convert raw errors to sanitized public failure objects */
const toPublicFailure = (id: string, err: unknown): StudentTransformFailure => {
  if (err instanceof AppError) return { id, message: err.message };
  if (err instanceof Error) return { id, message: err.message };
  return { id, message: "Unknown error" };
};

const hasActiveStudentSchoolMembership = async (
  studentId: string,
  schoolId: string,
): Promise<boolean> => {
  const { data, error } = await (supabaseAdmin as any)
    .from("student_schools")
    .select("id")
    .eq("student_id", studentId)
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new AppError("Failed to validate student school membership", 500);
  }

  return !!data;
};

const getActiveStudentIdsBySchool = async (schoolId: string): Promise<string[]> => {
  const { data, error } = await (supabaseAdmin as any)
    .from("student_schools")
    .select("student_id")
    .eq("school_id", schoolId)
    .eq("is_active", true);

  if (error) {
    throw new AppError("Failed to load school students", 500);
  }

  return (data || []).map((row: any) => row.student_id).filter(Boolean);
};

// Helper: Resolve emails and transform to Student objects, collecting failures
const transformUsersToStudents = async (
  users: DbUser[],
  membershipByStudentId?: Map<string, any>,
): Promise<{ students: Student[]; failures: StudentTransformFailure[] }> => {
  const userIds = users.map((u) => u.id);
  const emailMap = await fetchEmailsForUsers(userIds);
  const failures: StudentTransformFailure[] = [];

  const students = users.reduce<Student[]>((acc, user) => {
    const email = emailMap.get(user.id);
    try {
      const merged = mergeSchoolScopedStudentFields(
        user,
        membershipByStudentId?.get(user.id),
      );
      const mapped = transformUserToStudent(merged, email || null);
      acc.push(mapped);
    } catch (err) {
      console.warn(
        `Skipping student ${user.id} due to transformation error:`,
        err,
      );
      failures.push(toPublicFailure(user.id, err));
    }
    return acc;
  }, []);

  return { students, failures };
};

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  whatsappNumber?: string;
  dateOfBirth?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  medicalConditions?: string;
  skillLevel: string | null;
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
  schoolId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudentRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  whatsappNumber?: string;
  dateOfBirth?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  medicalConditions?: string;
  skillLevel?: string;
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

export interface UpdateStudentRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  whatsappNumber?: string;
  dateOfBirth?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  medicalConditions?: string;
  skillLevel?: string;
  preferredDisciplines?: string[];
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
  isActive?: boolean;
}

export interface StudentsResponse {
  students: Student[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    /** Count of records that failed transformation (e.g., missing email in auth) */
    failureCount: number;
    /** Original DB count before transformation failures */
    rawTotal: number;
  };
  failures: Array<{ id: string; message: string }>;
}

export interface StudentSearchResponse {
  students: Student[];
  failures: Array<{ id: string; message: string }>;
}

/**
 * Create a new student (user with role USER)
 * @param studentData - Student data
 * @param schoolId - School ID for the student
 * @returns Created student
 */
export const createStudent = async (
  studentData: CreateStudentRequest,
  schoolId: string,
): Promise<Student> => {
  try {
    // First create the user in auth.users
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: studentData.email,
        password: "TempPassword123!", // Temporary password, user will need to reset
        email_confirm: true,
      });

    if (authError || !authUser.user) {
      throw new AppError("Failed to create user account", 500);
    }

    // Then create the user record in users table
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .insert(
        {
          id: authUser.user.id,
          first_name: studentData.firstName,
          last_name: studentData.lastName,
          school_id: schoolId,
          role: "USER" as const,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // Add student-specific fields
          ...(studentData.dateOfBirth && {
            date_of_birth: studentData.dateOfBirth,
          }),
          ...(studentData.emergencyContact && {
            emergency_contact: studentData.emergencyContact,
          }),
          ...(studentData.emergencyPhone && {
            emergency_phone: studentData.emergencyPhone,
          }),
          ...(studentData.medicalConditions && {
            medical_conditions: studentData.medicalConditions,
          }),
          ...(studentData.whatsappNumber && {
            whatsapp_number: studentData.whatsappNumber,
          }),
          ...(studentData.nationality && {
            nationality: studentData.nationality,
          }),
          ...(studentData.weight !== undefined && { weight: studentData.weight }),
          ...(studentData.height !== undefined && { height: studentData.height }),
          ...(studentData.canSwim !== undefined && {
            can_swim: studentData.canSwim,
          }),
        } as any,
      )
      .select()
      .single();

    if (error || !user) {
      // If user creation failed, clean up the auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw new AppError("Failed to create student", 500);
    }

    const { error: studentSchoolError } = await (supabaseAdmin as any)
      .from("student_schools")
      .insert({
        student_id: authUser.user.id,
        school_id: schoolId,
        is_primary: true,
        is_active: true,
        ...buildSchoolScopedStudentFields(studentData),
      });

    if (studentSchoolError) {
      await supabaseAdmin.from("users").delete().eq("id", authUser.user.id);
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw new AppError("Failed to create student-school relationship", 500);
    }

    const mergedUser = mergeSchoolScopedStudentFields(
      user,
      buildSchoolScopedStudentFields(studentData),
    );
    return transformUserToStudent(mergedUser, studentData.email);
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to create student", 500);
  }
};

/**
 * Get all students for a school with pagination
 *
 * @remarks
 * **Pagination semantics:**
 * - `pagination.total` and `pagination.totalPages` reflect **post-transformation** counts
 *   (i.e., original DB count minus transformation failures).
 * - `pagination.rawTotal` contains the original database record count before failures.
 * - `pagination.failureCount` indicates how many records failed transformation.
 *
 * The returned `students` array length may be smaller than `limit` if transformations fail.
 * Query offsets are calculated from pre-transformation counts, so page boundaries may shift
 * slightly when failures occur. Clients should use `rawTotal` if they need the true DB count.
 *
 * Consumers should:
 * - Use `pagination.total` and `pagination.totalPages` for UI pagination controls.
 * - Check `failures` array for details on any records that could not be mapped.
 * - Use `pagination.rawTotal` if accurate DB-level counts are needed.
 *
 * @param schoolId - School ID
 * @param page - Page number
 * @param limit - Items per page
 * @param search - Search term
 * @returns Paginated students with potential failures and adjusted counts
 */
export const getAllStudents = async (
  schoolId: string,
  page: number = 1,
  limit: number = 10,
  search: string = "",
): Promise<StudentsResponse> => {
  try {
    const offset = (page - 1) * limit;
    const studentIds = await getActiveStudentIdsBySchool(schoolId);

    if (studentIds.length === 0) {
      return {
        students: [],
        failures: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          failureCount: 0,
          rawTotal: 0,
        },
      };
    }

    let usersQuery = supabaseAdmin
      .from("users")
      .select("*")
      .in("id", studentIds)
      .eq("role", "USER")
      .order("created_at", { ascending: false });

    if (search) {
      usersQuery = usersQuery.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%`,
      );
    }

    const { data: matchedStudents, error } = await usersQuery;
    if (error) {
      throw new AppError("Failed to fetch students", 500);
    }

    const filteredStudents = matchedStudents || [];
    const total = filteredStudents.length;
    const paginatedStudents = filteredStudents.slice(offset, offset + limit);

    const { data: memberships, error: membershipsError } = await (supabaseAdmin as any)
      .from("student_schools")
      .select("*")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .in(
        "student_id",
        paginatedStudents.map((s) => s.id),
      );
    if (membershipsError) {
      throw new AppError("Failed to fetch school-scoped student fields", 500);
    }
    const membershipByStudentId = new Map<string, any>(
      (memberships || []).map((m: any) => [m.student_id, m]),
    );

    const { students: mappedStudents, failures } =
      await transformUsersToStudents(paginatedStudents || [], membershipByStudentId);

    return {
      students: mappedStudents,
      failures,
      pagination: {
        page,
        limit,
        // Adjusted total reflects only successfully transformed students
        total: total - failures.length,
        totalPages: Math.ceil((total - failures.length) / limit),
        failureCount: failures.length,
        rawTotal: total,
      },
    };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to fetch students", 500);
  }
};

/**
 * Search students
 * @param schoolId - School ID
 * @param query - Search query
 * @returns Matching students
 */
export const searchStudents = async (
  schoolId: string,
  query: string,
): Promise<StudentSearchResponse> => {
  try {
    const studentIds = await getActiveStudentIdsBySchool(schoolId);

    if (studentIds.length === 0) {
      return { students: [], failures: [] };
    }

    const { data: students, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .in("id", studentIds)
      .eq("role", "USER")
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      throw new AppError("Failed to search students", 500);
    }

    const { data: memberships, error: membershipsError } = await (supabaseAdmin as any)
      .from("student_schools")
      .select("*")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .in(
        "student_id",
        (students || []).map((s) => s.id),
      );
    if (membershipsError) {
      throw new AppError("Failed to fetch school-scoped student fields", 500);
    }
    const membershipByStudentId = new Map<string, any>(
      (memberships || []).map((m: any) => [m.student_id, m]),
    );

    const { students: mappedStudents, failures } =
      await transformUsersToStudents(students || [], membershipByStudentId);

    return {
      students: mappedStudents,
      failures,
    };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to search students", 500);
  }
};

/**
 * Get student by ID
 * @param id - Student ID
 * @param schoolId - School ID for authorization
 * @returns Student data
 */
export const getStudentById = async (
  id: string,
  schoolId: string,
): Promise<Student> => {
  try {
    const { data: student, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", id)
      .eq("role", "USER")
      .single();

    if (error || !student) {
      throw new NotFoundError("Student");
    }

    const { data: membership, error: membershipError } = await (supabaseAdmin as any)
      .from("student_schools")
      .select("*")
      .eq("student_id", id)
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .maybeSingle();
    if (membershipError) {
      throw new AppError("Failed to resolve student school profile", 500);
    }
    if (!membership) {
      throw new NotFoundError("Active student membership for specified school");
    }

    const { students: mappedStudents, failures } =
      await transformUsersToStudents([student], new Map([[id, membership]]));

    // We expect exactly one student here, or it should fail if transformation failed
    if (mappedStudents.length === 0) {
      const failureDetails =
        failures.length > 0
          ? failures.map((f) => `${f.id}: ${f.message}`).join("; ")
          : "Unknown transformation error";
      throw new AppError(
        `Failed to resolve student data: ${failureDetails}`,
        500,
      );
    }

    return mappedStudents[0]!;
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to fetch student", 500);
  }
};

/**
 * Update student
 * @param id - Student ID
 * @param studentData - Updated student data
 * @param schoolId - School ID for authorization
 * @returns Updated student
 */
export const updateStudent = async (
  id: string,
  studentData: UpdateStudentRequest,
  schoolId: string,
): Promise<Student> => {
  try {
    const hasMembership = await hasActiveStudentSchoolMembership(id, schoolId);
    if (!hasMembership) {
      throw new NotFoundError("Student");
    }

    const { data: studentCheck, error: studentCheckError } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("id", id)
      .single();

    if (studentCheckError || !studentCheck) {
      console.error("Student ID not found:", { id, studentCheckError });
      throw new NotFoundError("Student");
    }

    if (studentCheck.role !== "USER") {
      console.error("User is not a student:", {
        studentId: id,
        role: studentCheck.role,
      });
      throw new NotFoundError("Student");
    }

    const updateData: Database["public"]["Tables"]["users"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    const membershipUpdateData: Record<string, any> = {
      ...buildSchoolScopedStudentFields(studentData),
      updated_at: new Date().toISOString(),
    };

    if (studentData.firstName !== undefined)
      updateData.first_name = studentData.firstName.trim();
    if (studentData.lastName !== undefined)
      updateData.last_name = studentData.lastName.trim();
    if (studentData.dateOfBirth !== undefined)
      updateData.date_of_birth = studentData.dateOfBirth || null;
    if (studentData.emergencyContact !== undefined)
      updateData.emergency_contact = studentData.emergencyContact || null;
    if (studentData.emergencyPhone !== undefined)
      updateData.emergency_phone = studentData.emergencyPhone || null;
    if (studentData.medicalConditions !== undefined)
      updateData.medical_conditions = studentData.medicalConditions || null;
    if (studentData.preferredDisciplines !== undefined) {
      if (
        !studentData.preferredDisciplines ||
        studentData.preferredDisciplines.length === 0
      ) {
        throw new AppError(
          "At least one preferred discipline must be selected",
          400,
        );
      }
      // stored on student_schools
    }
    if (studentData.whatsappNumber !== undefined)
      updateData.whatsapp_number = studentData.whatsappNumber.trim() || null;
    if (studentData.nationality !== undefined)
      updateData.nationality = studentData.nationality || null;
    if (studentData.weight !== undefined)
      updateData.weight =
        studentData.weight !== null ? studentData.weight : null;
    if (studentData.height !== undefined)
      updateData.height =
        studentData.height !== null ? studentData.height : null;
    if (studentData.canSwim !== undefined)
      updateData.can_swim = studentData.canSwim;
    // remaining school-scoped fields are persisted on student_schools
    if (studentData.isActive !== undefined)
      updateData.is_active = studentData.isActive;

    if (studentData.email !== undefined) {
      const { error: authUpdateError } =
        await supabaseAdmin.auth.admin.updateUserById(id, {
          email: studentData.email.trim(),
        });

      if (authUpdateError) {
        console.error("Failed to update student email in auth:", {
          id,
          authUpdateError,
        });
        throw new AppError("Failed to update student email", 500);
      }
    }

    const { data: student, error } = await supabaseAdmin
      .from("users")
      .update(updateData)
      .eq("id", id)
      .eq("role", "USER")
      .select("*")
      .single();

    if (error || !student) {
      console.error("Failed to update student:", { id, schoolId, error });
      throw new NotFoundError("Student");
    }

    const { data: updatedMembership, error: membershipUpdateError } = await (
      supabaseAdmin as any
    )
      .from("student_schools")
      .update(membershipUpdateData)
      .eq("student_id", id)
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .select("*")
      .maybeSingle();
    if (membershipUpdateError || !updatedMembership) {
      throw new AppError("Failed to update school-scoped student fields", 500);
    }

    const { students: mappedStudents, failures } =
      await transformUsersToStudents([student], new Map([[id, updatedMembership]]));

    if (mappedStudents.length === 0) {
      const failureDetails =
        failures.length > 0
          ? failures.map((f) => `${f.id}: ${f.message}`).join("; ")
          : "Unknown transformation error";
      throw new AppError(
        `Failed to resolve updated student data: ${failureDetails}`,
        500,
      );
    }

    return mappedStudents[0]!;
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to update student", 500);
  }
};

/**
 * Delete student (hard delete - removes from database)
 * @param id - Student ID
 * @param schoolId - School ID for authorization
 * @returns Success status
 */
export const deleteStudent = async (
  id: string,
  schoolId: string,
): Promise<{ success: boolean }> => {
  try {
    const hasMembership = await hasActiveStudentSchoolMembership(id, schoolId);
    if (!hasMembership) {
      throw new NotFoundError("Student not found");
    }

    const { data: student, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", id)
      .eq("role", "USER")
      .single();

    if (fetchError || !student) {
      throw new NotFoundError("Student not found");
    }

    // Delete from users table (hard delete)
    const { error: deleteError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", id)
      .eq("role", "USER");

    if (deleteError) {
      console.error("Failed to delete student from users table:", deleteError);
      throw new AppError(
        `Failed to delete student: ${deleteError.message}`,
        500,
      );
    }

    const { error: authDeleteError } =
      await supabaseAdmin.auth.admin.deleteUser(id);

    if (authDeleteError) {
      console.error(
        "Failed to delete student from auth.users:",
        authDeleteError,
      );
    }

    return { success: true };
  } catch (error: any) {
    if (error instanceof NotFoundError || error instanceof AppError) {
      throw error;
    }
    console.error("Unexpected error deleting student:", error);
    throw new AppError("Failed to delete student", 500);
  }
};

/**
 * Create student by school admin (immediate creation with is_active: false)
 * @param studentData - Student data from frontend
 * @param schoolId - School ID
 * @param invitedBy - ID of the user who created the invitation
 * @param invitedByName - Name of the user who created the invitation
 * @returns Created student data
 */
export const createStudentBySchoolAdmin = async (
  studentData: any,
  schoolId: string,
  invitedBy: string,
  invitedByName: string,
): Promise<Student> => {
  try {
    // Create auth user first
    // Email confirmation will be handled via invitation acceptance flow
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: studentData.email,
        password: Math.random().toString(36).slice(-12), // Random password
        email_confirm: true,
      });

    if (authError || !authUser.user) {
      throw new AppError("Failed to create auth user", 500);
    }

    // Create user record in users table with is_active: false
    const userRecord: any = {
      id: authUser.user.id,
      role: "USER" as const,
      school_id: schoolId,
      first_name: studentData.firstName,
      last_name: studentData.lastName,
      avatar: null,
      // Student-specific fields
      date_of_birth: studentData.dateOfBirth || null,
      emergency_contact: studentData.emergencyContact || null,
      emergency_phone: studentData.emergencyPhone || null,
      medical_conditions: studentData.medicalConditions || null,
      whatsapp_number: studentData.whatsappNumber || null,
      nationality: studentData.nationality || null,
      weight:
        studentData.weight !== undefined && studentData.weight !== null
          ? studentData.weight
          : null,
      height:
        studentData.height !== undefined && studentData.height !== null
          ? studentData.height
          : null,
      can_swim: studentData.canSwim !== undefined ? studentData.canSwim : null,
      // Common fields
      is_active: false, // Key: inactive until invitation accepted
    };

    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .insert(userRecord)
      .select()
      .single();

    if (userError) {
      // Clean up auth user if user creation fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw new AppError(
        `Failed to create user profile: ${userError.message || userError.code || "Unknown error"}`,
        500,
      );
    }

    const { error: membershipError } = await (supabaseAdmin as any)
      .from("student_schools")
      .insert({
        student_id: authUser.user.id,
        school_id: schoolId,
        is_primary: true,
        is_active: true,
        ...buildSchoolScopedStudentFields(studentData),
      });

    if (membershipError) {
      await supabaseAdmin.from("users").delete().eq("id", authUser.user.id);
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw new AppError("Failed to create student-school relationship", 500);
    }

    // Create simple invitation record (just for tracking)
    const invitationToken =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const { error: invitationError } = await supabaseAdmin
      .from("user_invitations")
      .insert({
        email: studentData.email,
        first_name: studentData.firstName,
        last_name: studentData.lastName,
        role: "USER" as const,
        school_id: schoolId,
        invited_by: invitedBy,
        invited_by_name: invitedByName,
        invitation_token: invitationToken,
        expires_at: expiresAt.toISOString(),
        is_used: false,
        user_id: authUser.user.id, // Link to the created user
        // Only essential fields - all user data is in users table
      });

    if (invitationError) {
      console.error("Failed to create invitation record:", invitationError);
      // Don't fail the whole operation for this
    }

    try {
      const { emailService } = await import("./email");
      const baseUrl = process.env["CLIENT_URL"] || "http://localhost:3000";

      let schoolName = "Your School";
      try {
        const school = await getSchoolById(schoolId);
        schoolName = school.name;
      } catch (schoolError) {
        console.error("Failed to get school name:", schoolError);
      }

      await emailService.sendStudentFormEmail({
        to: studentData.email,
        firstName: studentData.firstName,
        lastName: studentData.lastName,
        schoolName: schoolName,
        invitationToken: invitationToken,
        expiresAt: expiresAt.toISOString(),
        baseUrl: baseUrl,
      });
    } catch (emailError) {
      console.error("Failed to send student form email:", emailError);
      // Don't fail the whole operation for this
    }

    // Return student data
    const mergedUser = mergeSchoolScopedStudentFields(
      user,
      buildSchoolScopedStudentFields(studentData),
    );
    return transformUserToStudent(mergedUser, studentData.email);
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to create student", 500);
  }
};
