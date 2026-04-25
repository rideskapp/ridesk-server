/**
 * @fileoverview Instructor management service for Ridesk Server
 * @description Handles instructor CRUD operations using the users table with role filtering
 * @author Ridesk Team
 * @version 1.0.0
 */

import { supabaseAdmin } from "../database/supabase";
import { randomBytes, randomUUID } from "crypto";
import { getSchoolById } from "./schools";
import { AppError, NotFoundError } from "../types";

export interface Instructor {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  whatsappNumber?: string | null;
  avatar?: string | null;
  specialties: string[];
  certifications: string[];
  languages: string[];
  notes?: string | null;
  hourlyRate?: number | null;
  commissionRate?: number | null;
  isPrimary: boolean | null;
  schoolId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  canEditLessons?: boolean;
}

export interface CreateInstructorRequest {
  firstName: string;
  lastName: string;
  email: string;
  whatsappNumber?: string;
  avatar?: string;
  specialties: string[];
  certifications: string[];
  languages: string[];
  notes?: string;
  isPrimary: boolean;
}

export interface UpdateInstructorRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  whatsappNumber?: string;
  avatar?: string;
  specialties?: string[];
  certifications?: string[];
  languages?: string[];
  notes?: string;
  hourlyRate?: number;
  commissionRate?: number;
  isPrimary?: boolean;
  isActive?: boolean;
}

export interface InstructorsResponse {
  instructors: Instructor[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Create a new instructor (user with role INSTRUCTOR)
 * @param instructorData - Instructor data
 * @param schoolId - School ID for the instructor
 * @returns Created instructor
 */
export const createInstructor = async (
  instructorData: CreateInstructorRequest,
  schoolId: string,
): Promise<Instructor> => {
  try {
    // First create the user in auth.users
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: instructorData.email,
        password: "TempPassword123!", // Temporary password, user will need to reset
        email_confirm: true,
      });

    if (authError || !authUser.user) {
      throw new AppError("Failed to create user account", 500);
    }

    // Then create the user record in users table
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .insert({
        id: authUser.user.id,
        first_name: instructorData.firstName,
        last_name: instructorData.lastName,
        whatsapp_number: instructorData.whatsappNumber || null,
        avatar: instructorData.avatar || null,
        specialties: instructorData.specialties,
        languages: instructorData.languages,
        notes: null,
        is_primary: instructorData.isPrimary,
        school_id: schoolId,
        role: "INSTRUCTOR",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !user) {
      // If user creation failed, clean up the auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw new AppError("Failed to create instructor", 500);
    }

    return {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: instructorData.email,
      whatsappNumber: user.whatsapp_number,
      avatar: user.avatar,
      specialties: user.specialties || [],
      certifications: user.certifications || [],
      languages: user.languages || [],
      notes: user.notes,
      hourlyRate: user.hourly_rate,
      commissionRate: user.commission_rate,
      isPrimary: user.is_primary,
      schoolId: user.school_id,
      isActive: user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to create instructor", 500);
  }
};

/**
 * Create instructor by school admin (with invitation flow)
 * @param instructorData - Instructor data
 * @param schoolId - School ID
 * @param invitedBy - ID of user who created the instructor
 * @param invitedByName - Name of user who created the instructor
 * @returns Created instructor and invitation data
 */
export const createInstructorBySchoolAdmin = async (
  instructorData: CreateInstructorRequest,
  schoolId: string,
  invitedBy: string,
  invitedByName: string,
): Promise<{
  instructor?: Instructor;
  invitation?: any;
  message: string;
}> => {
  try {
    let userId: string;
    let userRecord: any;
    let isNewUser = false;

    // Check if user already exists in auth.users using paginated listUsers()
    let existingAuthUser: any = null;
    let page = 1;
    const perPage = 1000; // Supabase max page size
    const maxPages = 100; // Safety limit to prevent infinite loops
    let hasMorePages = true;

    while (hasMorePages && !existingAuthUser && page <= maxPages) {
      const { data: usersData, error: listUsersError } =
        await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage,
        });

      if (listUsersError) {
        console.error("Failed to list users:", listUsersError);
        throw new AppError(
          `Failed to check existing user: ${listUsersError.message}`,
          500,
        );
      }

      // Check if we found the user in this page
      existingAuthUser = usersData.users.find(
        (user) => user.email === instructorData.email,
      );

      // Check if there are more pages to fetch
      // Stop if we found the user, if this page has fewer than perPage users, or if we hit max pages
      hasMorePages =
        usersData.users.length === perPage &&
        !existingAuthUser &&
        page < maxPages;
      page++;
    }

    // Safety check: if we hit max pages without finding the user, log a warning
    if (page > maxPages && !existingAuthUser) {
      console.warn(
        `Reached maximum page limit (${maxPages}) while searching for user with email: ${instructorData.email}. User may not exist or system has very large user base.`,
      );
    }

    // If user exists in auth.users, check if they exist in public.users
    if (existingAuthUser) {
      const { data: existingUser, error: userQueryError } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("id", existingAuthUser.id)
        .maybeSingle();

      if (userQueryError) {
        console.error(
          "Failed to query user from public.users:",
          userQueryError,
        );
        throw new AppError(
          `Failed to check existing user profile: ${userQueryError.message}`,
          500,
        );
      }

      if (existingUser) {
        userId = existingUser.id;
        userRecord = existingUser;
      } else {
        // User exists in auth.users but not in public.users - create the public.users record
        userId = existingAuthUser.id;
        isNewUser = false; // Not a new auth user, but needs public.users record

        const newUserRecord = {
          id: userId,
          role: "INSTRUCTOR" as const,
          school_id: null, // Instructors use instructor_schools table
          first_name: instructorData.firstName,
          last_name: instructorData.lastName,
          whatsapp_number: instructorData.whatsappNumber || null,
          avatar: instructorData.avatar || null,
          specialties: instructorData.specialties || null,
          certifications: instructorData.certifications || null,
          languages: instructorData.languages || null,
          is_primary: instructorData.isPrimary ?? true,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: createdUser, error: userError } = await supabaseAdmin
          .from("users")
          .insert(newUserRecord)
          .select()
          .single();

        if (userError) {
          console.error("Failed to create public.users record:", userError);
          throw new AppError(
            `Failed to create user profile: ${userError.message}`,
            500,
          );
        }
        userRecord = createdUser;
      }
    } else {
      isNewUser = true;
      // Create user in auth.users with random password and email_confirm: true
      const { data: authUser, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: instructorData.email,
          password: randomBytes(12).toString("hex"),
          email_confirm: true,
        });

      if (authError || !authUser.user) {
        throw new AppError("Failed to create user account", 500);
      }

      userId = authUser.user.id;

      // Create user record in users table
      const newUserRecord = {
        id: userId,
        role: "INSTRUCTOR" as const,
        school_id: null, // Instructors use instructor_schools table
        first_name: instructorData.firstName,
        last_name: instructorData.lastName,
        whatsapp_number: instructorData.whatsappNumber || null,
        avatar: instructorData.avatar || null,
        specialties: instructorData.specialties || null,
        certifications: instructorData.certifications || null,
        languages: instructorData.languages || null,
        is_primary: instructorData.isPrimary ?? true, // First school is primary
        is_active: true, // Active by default (client requirement)
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: createdUser, error: userError } = await supabaseAdmin
        .from("users")
        .insert(newUserRecord)
        .select()
        .single();

      if (userError) {
        console.error("User creation failed:", userError);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw new AppError(
          `Failed to create user profile: ${userError.message}`,
          500,
        );
      }
      userRecord = createdUser;
    }

    // Link instructor to school via instructor_schools table
    // Determine whether this upsert should set is_primary=true. For new users, default true.
    let shouldSetPrimary = isNewUser ? true : false;
    if (!isNewUser) {
      try {
        const { data: existingPrimary, error: primaryError } =
          await supabaseAdmin
            .from("instructor_schools")
            .select("id")
            .eq("instructor_id", userId)
            .eq("is_primary", true)
            .limit(1);

        if (
          !primaryError &&
          Array.isArray(existingPrimary) &&
          existingPrimary.length === 0
        ) {
          shouldSetPrimary = true;
        }
      } catch (e) {
        // If check fails, be conservative and do not override existing primary state
        shouldSetPrimary = false;
      }
    }

    const { error: linkError } = await supabaseAdmin
      .from("instructor_schools")
      .upsert({
        instructor_id: userId,
        school_id: schoolId,
        is_primary: shouldSetPrimary,
        is_active: true,
      });

    if (linkError) {
      console.error("Failed to link instructor to school:", linkError);
    }

    // ALWAYS Create invitation record (even for existing users)
    const invitationToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Invalidate any existing pending invitations for this email+school (mark as used/expired)
    try {
      await supabaseAdmin
        .from("user_invitations")
        .update({ is_used: true, expires_at: new Date().toISOString() })
        .eq("email", instructorData.email)
        .eq("school_id", schoolId)
        .eq("is_used", false);
    } catch (e) {
      console.error("Failed to invalidate existing invitations:", e);
    }

    const { error: invitationError } = await supabaseAdmin
      .from("user_invitations")
      .insert({
        email: instructorData.email,
        first_name: instructorData.firstName,
        last_name: instructorData.lastName,
        role: "INSTRUCTOR",
        school_id: schoolId,
        invited_by: invitedBy,
        invited_by_name: invitedByName,
        invitation_token: invitationToken,
        expires_at: expiresAt.toISOString(),
        is_used: false,
        user_id: userId, // Link invitation to user
      });

    if (invitationError) {
      console.error("Failed to create invitation record:", invitationError);
    }

    // Send invitation email
    try {
      const { emailService } = await import("./email");
      const baseUrl = process.env["CLIENT_URL"] || "http://localhost:3000";

      let schoolName = "Your School";
      try {
        const school = await getSchoolById(schoolId);
        if (school && school.name) schoolName = school.name;
      } catch (e) {
        // fallback to default
      }

      await emailService.sendUserInvitation({
        to: instructorData.email,
        firstName: instructorData.firstName,
        lastName: instructorData.lastName,
        schoolName: schoolName,
        role: "Instructor",
        invitationToken: invitationToken,
        expiresAt: expiresAt.toISOString(),
        baseUrl: baseUrl,
      });
    } catch (emailError: any) {
      console.error(
        "Failed to send instructor invitation email:",
        {
          email: instructorData.email,
          invitedBy,
          schoolId,
        },
        emailError,
      );
    }

    // Return instructor data
    return {
      instructor: {
        id: userRecord.id,
        firstName: userRecord.first_name || "",
        lastName: userRecord.last_name || "",
        email: instructorData.email,
        whatsappNumber: instructorData.whatsappNumber || "",
        avatar: userRecord.avatar || "",
        specialties: userRecord.specialties || [],
        certifications: userRecord.certifications || [],
        languages: userRecord.languages || [],
        notes: userRecord.notes || "",
        hourlyRate: userRecord.hourly_rate ?? 0,
        commissionRate: userRecord.commission_rate ?? 0,
        isPrimary: userRecord.is_primary || false,
        isActive: userRecord.is_active || false,
        schoolId: schoolId,
        createdAt: userRecord.created_at || new Date().toISOString(),
        updatedAt: userRecord.updated_at || new Date().toISOString(),
      },
      invitation: {
        token: invitationToken,
        expiresAt: expiresAt.toISOString(),
      },
      message: isNewUser
        ? "Instructor created and invitation sent"
        : "Instructor already exists. Invitation sent to link to this school.",
    };
  } catch (error) {
    console.error("Error creating instructor by school admin:", error);
    throw error;
  }
};

/**
 * Get all instructors for a school with pagination
 * @param schoolId - School ID
 * @param page - Page number
 * @param limit - Items per page
 * @param search - Search term
 * @returns Paginated instructors
 */
export const getAllInstructors = async (
  schoolId: string,
  page: number = 1,
  limit: number = 10,
  search: string = "",
): Promise<InstructorsResponse> => {
  try {
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("users")
      .select(
        `
        *,
        instructor_schools!inner(school_id, is_primary, is_active)
      `,
        { count: "exact" },
      )
      .eq("instructor_schools.school_id", schoolId)
      .eq("role", "INSTRUCTOR");

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`,
      );
    }

    const {
      data: instructors,
      error,
      count,
    } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new AppError("Failed to fetch instructors", 500);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    // Fetch emails from auth.users table using batched requests by ID
    const userIds = (instructors || []).map((instructor) => instructor.id);
    const emailMap = new Map();

    if (userIds.length > 0) {
      // Use Promise.all to fetch emails in parallel
      await Promise.all(
        userIds.map(async (userId) => {
          try {
            const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
            if (data?.user?.email) {
              emailMap.set(userId, data.user.email);
            }
          } catch (error) {
            // Ignore errors for individual user fetches
            console.warn(`Failed to fetch email for user ${userId}`, error);
          }
        }),
      );
    }

    const permissionMap = new Map<string, boolean>();
    if (userIds.length > 0) {
      const { data: permissions } = await (supabaseAdmin as any)
        .from("instructor_lesson_permissions")
        .select("instructor_id, can_edit_lessons")
        .eq("school_id", schoolId)
        .in("instructor_id", userIds);
      for (const row of permissions || []) {
        permissionMap.set(
          row.instructor_id,
          Boolean(row.can_edit_lessons),
        );
      }
    }

    return {
      instructors: (instructors || []).map((instructor) => ({
        id: instructor.id,
        firstName: instructor.first_name,
        lastName: instructor.last_name,
        email: emailMap.get(instructor.id) || null,
        whatsappNumber: instructor.whatsapp_number,
        avatar: instructor.avatar,
        specialties: instructor.specialties || [],
        certifications: instructor.certifications || [],
        languages: instructor.languages || [],
        notes: instructor.notes,
        hourlyRate: instructor.hourly_rate,
        commissionRate: instructor.commission_rate,
        isPrimary:
          (instructor as any).instructor_schools?.[0]?.is_primary || false,
        schoolId:
          (instructor as any).instructor_schools?.[0]?.school_id || schoolId,
        isActive:
          Boolean(
            (instructor as any).instructor_schools?.[0]?.is_active &&
              instructor.is_active,
          ),
        canEditLessons: permissionMap.get(instructor.id) || false,
        createdAt: instructor.created_at,
        updatedAt: instructor.updated_at,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to fetch instructors", 500);
  }
};

/**
 * Search instructors
 * @param schoolId - School ID
 * @param query - Search query
 * @returns Matching instructors
 */
export const searchInstructors = async (
  schoolId: string,
  query: string,
): Promise<Instructor[]> => {
  try {
    const { data: instructors, error } = await supabaseAdmin
      .from("users")
      .select(
        `
        *,
        instructor_schools!inner(school_id, is_primary, is_active)
      `,
      )
      .eq("instructor_schools.school_id", schoolId)
      .eq("role", "INSTRUCTOR")
      .or(
        `first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`,
      )
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      throw new AppError("Failed to search instructors", 500);
    }

    // Fetch emails from auth.users
    const userIds = (instructors || []).map((i) => i.id);
    const emailMap = new Map<string, string | null>();
    if (userIds.length > 0) {
      await Promise.all(
        userIds.map(async (userId) => {
          try {
            const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
            if (data?.user?.email) {
              emailMap.set(userId, data.user.email);
            }
          } catch (err) {
            console.warn(`Failed to fetch email for user ${userId}`, err);
          }
        }),
      );
    }

    const permissionMap = new Map<string, boolean>();
    if (userIds.length > 0) {
      const { data: permissions } = await (supabaseAdmin as any)
        .from("instructor_lesson_permissions")
        .select("instructor_id, can_edit_lessons")
        .eq("school_id", schoolId)
        .in("instructor_id", userIds);
      for (const row of permissions || []) {
        permissionMap.set(
          row.instructor_id,
          Boolean(row.can_edit_lessons),
        );
      }
    }

    return (instructors || []).map((instructor) => ({
      id: instructor.id,
      firstName: instructor.first_name,
      lastName: instructor.last_name,
      email: emailMap.get(instructor.id) || null,
      whatsappNumber: instructor.whatsapp_number,
      avatar: instructor.avatar,
      specialties: instructor.specialties || [],
      certifications: instructor.certifications || [],
      languages: instructor.languages || [],
      notes: instructor.notes,
      hourlyRate: instructor.hourly_rate,
      commissionRate: instructor.commission_rate,
      isPrimary:
        (instructor as any).instructor_schools?.[0]?.is_primary || false,
      schoolId:
        (instructor as any).instructor_schools?.[0]?.school_id || schoolId,
      isActive:
        Boolean(
          (instructor as any).instructor_schools?.[0]?.is_active &&
            instructor.is_active,
        ),
      canEditLessons: permissionMap.get(instructor.id) || false,
      createdAt: instructor.created_at,
      updatedAt: instructor.updated_at,
    }));
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to search instructors", 500);
  }
};

/**
 * Get instructor by ID
 * @param id - Instructor ID
 * @param schoolId - School ID for authorization
 * @returns Instructor data
 */
export const getInstructorById = async (
  id: string,
  schoolId: string,
): Promise<Instructor> => {
  try {
    const { data: instructor, error } = await supabaseAdmin
      .from("users")
      .select(
        `
        *,
        instructor_schools!inner(school_id, is_primary, is_active)
      `,
      )
      .eq("id", id)
      .eq("instructor_schools.school_id", schoolId)
      .eq("role", "INSTRUCTOR")
      .single();

    if (error || !instructor) {
      throw new NotFoundError("Instructor not found");
    }

    // Fetch email from auth.users
    let instructorEmail: string | null = null;
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(id);
      instructorEmail = data?.user?.email || null;
    } catch (authErr) {
      console.warn(`Failed to fetch email for instructor ${id}`, authErr);
    }

    const { data: permission } = await (supabaseAdmin as any)
      .from("instructor_lesson_permissions")
      .select("can_edit_lessons")
      .eq("instructor_id", id)
      .eq("school_id", schoolId)
      .maybeSingle();

    return {
      id: instructor.id,
      firstName: instructor.first_name,
      lastName: instructor.last_name,
      email: instructorEmail,
      whatsappNumber: instructor.whatsapp_number,
      avatar: instructor.avatar,
      specialties: instructor.specialties || [],
      certifications: instructor.certifications || [],
      languages: instructor.languages || [],
      notes: instructor.notes,
      hourlyRate: instructor.hourly_rate,
      commissionRate: instructor.commission_rate,
      isPrimary:
        (instructor as any).instructor_schools?.[0]?.is_primary || false,
      schoolId:
        (instructor as any).instructor_schools?.[0]?.school_id || schoolId,
      isActive:
        Boolean(
          (instructor as any).instructor_schools?.[0]?.is_active &&
            instructor.is_active,
        ),
      canEditLessons: Boolean(permission?.can_edit_lessons),
      createdAt: instructor.created_at,
      updatedAt: instructor.updated_at,
    };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to fetch instructor", 500);
  }
};

/**
 * Update instructor
 * @param id - Instructor ID
 * @param instructorData - Updated instructor data
 * @param schoolId - School ID for authorization
 * @returns Updated instructor
 */
export const updateInstructor = async (
  id: string,
  instructorData: UpdateInstructorRequest,
  schoolId: string,
): Promise<Instructor> => {
  try {
    // AUTHORIZATION: Verify instructor is linked to this school
    const { data: schoolLink, error: linkError } = await supabaseAdmin
      .from("instructor_schools")
      .select("id, is_primary, is_active")
      .eq("instructor_id", id)
      .eq("school_id", schoolId)
      .single();

    if (linkError || !schoolLink) {
      throw new NotFoundError("Instructor not found in this school");
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (instructorData.firstName !== undefined)
      updateData.first_name = instructorData.firstName || null;
    if (instructorData.lastName !== undefined)
      updateData.last_name = instructorData.lastName || null;
    // Note: email is stored in auth.users, not in public.users table
    if (instructorData.whatsappNumber !== undefined)
      updateData.whatsapp_number = instructorData.whatsappNumber || null;
    if (instructorData.avatar !== undefined)
      updateData.avatar = instructorData.avatar || null;
    if (instructorData.specialties !== undefined)
      updateData.specialties = instructorData.specialties || null;
    if (instructorData.languages !== undefined)
      updateData.languages = instructorData.languages || null;
    if (instructorData.notes !== undefined)
      updateData.notes = instructorData.notes || null;
    // Note: hourly_rate and commission_rate are not updated here as rates are per-category in instructor_rates table
    // Note: is_primary and is_active are handled separately via instructor_schools table

    // Update is_primary in instructor_schools table (per-school setting)
    let confirmedIsPrimary = schoolLink.is_primary ?? false;
    if (instructorData.isPrimary !== undefined) {
      // If setting this school as primary, first clear any existing primary
      if (instructorData.isPrimary === true) {
        const { error: clearError } = await supabaseAdmin
          .from("instructor_schools")
          .update({ is_primary: false })
          .eq("instructor_id", id)
          .neq("school_id", schoolId);

        if (clearError) {
          console.error("Failed to clear existing primary:", clearError);
        }
      }

      // Now update the target school's is_primary
      const { data: updatedLink, error: isPrimaryError } = await supabaseAdmin
        .from("instructor_schools")
        .update({ is_primary: instructorData.isPrimary })
        .eq("instructor_id", id)
        .eq("school_id", schoolId)
        .select("is_primary")
        .single();

      if (isPrimaryError) {
        console.error("Failed to update is_primary:", isPrimaryError);
        // Continue with requested value, but log the error
      }

      // Use confirmed DB value
      if (updatedLink) {
        confirmedIsPrimary = updatedLink.is_primary ?? false;
      }
    }

    // Update is_active in instructor_schools table (per-school setting)
    let confirmedIsActive = schoolLink.is_active ?? true;
    if (instructorData.isActive !== undefined) {
      const { data: updatedLink, error: isActiveError } = await supabaseAdmin
        .from("instructor_schools")
        .update({ is_active: instructorData.isActive })
        .eq("instructor_id", id)
        .eq("school_id", schoolId)
        .select("is_active")
        .single();

      if (isActiveError) {
        console.error("Failed to update is_active:", isActiveError);
      }

      if (updatedLink) {
        confirmedIsActive = updatedLink.is_active ?? true;
      }

      // Keep users.is_active aligned with school-link status:
      // user is active if they have at least one active school link.
      const { data: activeLinks, error: activeLinksError } = await supabaseAdmin
        .from("instructor_schools")
        .select("id")
        .eq("instructor_id", id)
        .eq("is_active", true)
        .limit(1);

      if (activeLinksError) {
        console.error(
          "Failed to determine instructor active links:",
          activeLinksError,
        );
      } else {
        const shouldBeUserActive = (activeLinks?.length || 0) > 0;
        const { error: userActiveSyncError } = await supabaseAdmin
          .from("users")
          .update({
            is_active: shouldBeUserActive,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .eq("role", "INSTRUCTOR");

        if (userActiveSyncError) {
          console.error(
            "Failed to sync users.is_active for instructor:",
            userActiveSyncError,
          );
        }
      }
    }

    const { data: instructor, error } = await supabaseAdmin
      .from("users")
      .update(updateData)
      .eq("id", id)
      .eq("role", "INSTRUCTOR")
      .select()
      .single();

    if (error || !instructor) {
      throw new NotFoundError("Instructor not found");
    }

    // Fetch email from auth.users
    let instructorEmail: string | null = null;
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(id);
      instructorEmail = data?.user?.email || null;
    } catch (authErr) {
      console.warn(`Failed to fetch email for instructor ${id}`, authErr);
    }

    const { data: permission } = await (supabaseAdmin as any)
      .from("instructor_lesson_permissions")
      .select("can_edit_lessons")
      .eq("instructor_id", id)
      .eq("school_id", schoolId)
      .maybeSingle();

    return {
      id: instructor.id,
      firstName: instructor.first_name,
      lastName: instructor.last_name,
      email: instructorEmail,
      whatsappNumber: instructor.whatsapp_number,
      avatar: instructor.avatar,
      specialties: instructor.specialties || [],
      certifications: instructor.certifications || [],
      languages: instructor.languages || [],
      notes: instructor.notes,
      hourlyRate: instructor.hourly_rate,
      commissionRate: instructor.commission_rate,
      isPrimary: confirmedIsPrimary,
      schoolId: schoolId,
      isActive: confirmedIsActive,
      canEditLessons: Boolean(permission?.can_edit_lessons),
      createdAt: instructor.created_at,
      updatedAt: instructor.updated_at,
    };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to update instructor", 500);
  }
};

/**
 * Delete instructor (soft delete from school)
 * @param id - Instructor ID
 * @param schoolId - School ID to remove instructor from
 * @returns Success status
 */
export const deleteInstructor = async (
  id: string,
  schoolId: string,
): Promise<{ success: boolean }> => {
  try {
    // Deactivate the instructor-school relationship, not the user itself
    // This allows the instructor to remain active in other schools
    const { data: link, error } = await supabaseAdmin
      .from("instructor_schools")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("instructor_id", id)
      .eq("school_id", schoolId)
      .select()
      .single();

    if (error || !link) {
      throw new NotFoundError("Instructor not found in this school");
    }

    return { success: true };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to delete instructor", 500);
  }
};

/**
 * Get instructor statistics for a school
 * @param schoolId - School ID
 * @returns Object with activeCount and totalCount
 */
export const getInstructorStats = async (
  schoolId: string,
): Promise<{ activeCount: number; totalCount: number }> => {
  try {
    // Count active instructors (linked to school with is_active = true)
    const { count: activeCount, error: activeError } = await supabaseAdmin
      .from("users")
      .select(
        `*,
        instructor_schools!inner(school_id, is_active)`,
        { count: "exact", head: true },
      )
      .eq("instructor_schools.school_id", schoolId)
      .eq("instructor_schools.is_active", true)
      .eq("role", "INSTRUCTOR")
      .eq("is_active", true);

    // Count total instructors (linked to school, regardless of is_active)
    const { count: totalCount, error: allError } = await supabaseAdmin
      .from("users")
      .select(
        `*,
        instructor_schools!inner(school_id)`,
        { count: "exact", head: true },
      )
      .eq("instructor_schools.school_id", schoolId)
      .eq("role", "INSTRUCTOR");

    if (activeError || allError) {
      throw new AppError("Failed to fetch instructor stats", 500);
    }

    return {
      activeCount: activeCount || 0,
      totalCount: totalCount || 0,
    };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to fetch instructor stats", 500);
  }
};
