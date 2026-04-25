/**
 * @fileoverview School management service for Ridesk Server
 * @description Handles school CRUD operations and multi-school data separation
 * @author Ridesk Team
 * @version 1.0.0
 */

import { v4 as uuidv4 } from "uuid";
import { supabaseAdmin } from "../database/supabase";
import {
  School,
  CreateSchoolRequest,
  UpdateSchoolRequest,
  NotFoundError,
  ConflictError,
  AppError,
} from "../types";
import { generateUniqueSlug } from "../utils/slugify";

const mapSchoolRowToSchool = (school: any): School => {
  const preserveNull = (value: any): string | null | undefined => {
    if (value === null) return null;
    if (value === undefined || value === "") return undefined;
    return value;
  };

  return {
    id: school.id,
    name: school.name,
    slug: school.slug,
    logo: preserveNull(school.logo),
    email: preserveNull(school.email),
    phone: preserveNull(school.phone),
    address: preserveNull(school.address),
    website: preserveNull((school as any).website),
    spotName: preserveNull(school.spot_name),
    windguruUrl: preserveNull(school.windguru_url),
    disciplines: school.disciplines,
    openHoursStart: preserveNull(school.open_hours_start),
    openHoursEnd: preserveNull(school.open_hours_end),
    defaultLessonStatusId: preserveNull((school as any).default_lesson_status_id),
    defaultPaymentStatusId: preserveNull((school as any).default_payment_status_id),
    isActive: school.is_active,
    createdAt: school.created_at,
    updatedAt: school.updated_at,
  };
};

export const getSchoolTimezone = async (schoolId: string): Promise<string> => {
  // for now, default to UTC.
  try {
    const { data } = await supabaseAdmin
      .from("schools")
      .select("timezone")
      .eq("id", schoolId)
      .maybeSingle();
    const tz = (data as any)?.timezone;
    return typeof tz === "string" && tz.length > 0 ? tz : "UTC";
  } catch {
    return "UTC";
  }
};

/**
 * Create a new school
 * @param schoolData - School creation data
 * @returns Created school
 */
export const createSchool = async (
  schoolData: CreateSchoolRequest,
): Promise<School> => {
  try {
    const slug = schoolData.slug || await generateUniqueSlug(
      schoolData.name,
      async (slugToCheck) => {
        const { data: existingSchool } = await supabaseAdmin
          .from("schools")
          .select("id")
          .eq("slug", slugToCheck)
          .single();
        return !!existingSchool;
      }
    );

    // Create school
    const schoolId = uuidv4();
    const { data: newSchool, error } = await supabaseAdmin
      .from("schools")
      .insert({
        id: schoolId,
        name: schoolData.name,
        slug: slug,
        logo: schoolData.logo || null,
        email: schoolData.email || null,
        phone: schoolData.phone || null,
        address: schoolData.address || null,
        website: (schoolData as any).website || null,
        spot_name: schoolData.spotName || null,
        windguru_url: schoolData.windguruUrl || null,
        disciplines: schoolData.disciplines || [],
        open_hours_start: schoolData.openHoursStart || null,
        open_hours_end: schoolData.openHoursEnd || null,
        default_lesson_status_id: schoolData.defaultLessonStatusId || null,
        default_payment_status_id: schoolData.defaultPaymentStatusId || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new AppError(`Failed to create school: ${error.message}`, 500);
    }

    return mapSchoolRowToSchool(newSchool);
  } catch (error) {
    if (error instanceof ConflictError || error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to create school", 500);
  }
};

/**
 * Get school by ID
 * @param schoolId - School ID
 * @returns School data
 */
export const getSchoolById = async (schoolId: string): Promise<School> => {
  try {
    const { data: school, error } = await supabaseAdmin
      .from("schools")
      .select("*")
      .eq("id", schoolId)
      .eq("is_active", true)
      .single();

    if (error || !school) {
      throw new NotFoundError("School not found");
    }

    return mapSchoolRowToSchool(school);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new AppError("Failed to get school", 500);
  }
};

/**
 * Get school by user ID
 * @param userId - User ID
 * @returns School data or null if user has no school
 */
export const getSchoolByUserId = async (
  userId: string,
): Promise<School | null> => {
  try {
    // First get the user to check their school_id
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("school_id")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      throw new NotFoundError("User not found");
    }

    if (!user.school_id) {
      return null; // User has no school
    }

    // Get the school data
    return await getSchoolById(user.school_id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new AppError("Failed to get school by user ID", 500);
  }
};

/**
 * Get school by slug
 * @param slug - School slug
 * @returns School data
 */
export const getSchoolBySlug = async (slug: string): Promise<School> => {
  try {
    const { data: school, error } = await supabaseAdmin
      .from("schools")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (error || !school) {
      throw new NotFoundError("School not found");
    }

    return mapSchoolRowToSchool(school);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new AppError("Failed to get school", 500);
  }
};

/**
 * Get all schools (for SUPER_ADMIN)
 * @param page - Page number
 * @param limit - Items per page
 * @returns Paginated schools list
 */
export const getAllSchools = async (page: number = 1, limit: number = 10) => {
  try {
    const offset = (page - 1) * limit;

    // Get total count
    const { count, error: countError } = await supabaseAdmin
      .from("schools")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    if (countError) {
      throw new AppError("Failed to get schools count", 500);
    }

    // Get schools
    const { data: schools, error } = await supabaseAdmin
      .from("schools")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new AppError("Failed to get schools", 500);
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return {
      schools: schools.map((school) => mapSchoolRowToSchool(school)),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
      },
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to get schools", 500);
  }
};

/**
 * Update school
 * @param schoolData - School update data
 * @returns Updated school
 */
export const updateSchool = async (
  schoolData: UpdateSchoolRequest,
): Promise<School> => {
  try {
    // Check if school exists
    const existingSchool = await getSchoolById(schoolData.id);

    const slug = schoolData.slug || existingSchool.slug;

    if (schoolData.slug && schoolData.slug !== existingSchool.slug) {
      const { data: conflictingSchool } = await supabaseAdmin
        .from("schools")
        .select("id")
        .eq("slug", schoolData.slug)
        .neq("id", schoolData.id)
        .single();

      if (conflictingSchool) {
        throw new ConflictError("School with this slug already exists");
      }
    }

    // Update school
    const { data: updatedSchool, error } = await supabaseAdmin
      .from("schools")
      .update({
        name: schoolData.name || existingSchool.name,
        slug: slug,
        logo:
          schoolData.logo !== undefined
            ? schoolData.logo
            : existingSchool.logo || null,
        email:
          schoolData.email !== undefined
            ? schoolData.email
            : existingSchool.email || null,
        phone:
          schoolData.phone !== undefined
            ? schoolData.phone
            : existingSchool.phone || null,
        address:
          schoolData.address !== undefined
            ? schoolData.address
            : existingSchool.address || null,
        website:
          (schoolData as any).website !== undefined
            ? (schoolData as any).website
            : existingSchool.website || null,
        spot_name:
          schoolData.spotName !== undefined
            ? schoolData.spotName
            : existingSchool.spotName || null,
        windguru_url:
          schoolData.windguruUrl !== undefined
            ? schoolData.windguruUrl
            : existingSchool.windguruUrl || null,
        disciplines: schoolData.disciplines || existingSchool.disciplines,
        open_hours_start:
          schoolData.openHoursStart !== undefined
            ? schoolData.openHoursStart
            : existingSchool.openHoursStart || null,
        open_hours_end:
          schoolData.openHoursEnd !== undefined
            ? schoolData.openHoursEnd
            : existingSchool.openHoursEnd || null,
        default_lesson_status_id:
          schoolData.defaultLessonStatusId !== undefined
            ? (schoolData.defaultLessonStatusId === null || schoolData.defaultLessonStatusId === "" 
                ? null 
                : schoolData.defaultLessonStatusId)
            : existingSchool.defaultLessonStatusId || null,
        default_payment_status_id:
          schoolData.defaultPaymentStatusId !== undefined
            ? (schoolData.defaultPaymentStatusId === null || schoolData.defaultPaymentStatusId === "" 
                ? null 
                : schoolData.defaultPaymentStatusId)
            : existingSchool.defaultPaymentStatusId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", schoolData.id)
      .select()
      .single();

    if (error) {
      throw new AppError(`Failed to update school: ${error.message}`, 500);
    }

    return mapSchoolRowToSchool(updatedSchool);
  } catch (error) {
    if (
      error instanceof NotFoundError ||
      error instanceof ConflictError ||
      error instanceof AppError
    ) {
      throw error;
    }
    throw new AppError("Failed to update school", 500);
  }
};

/**
 * Deactivate school (soft delete)
 * @param schoolId - School ID
 * @returns Success status
 */
export const deactivateSchool = async (
  schoolId: string,
): Promise<{ success: boolean }> => {
  try {
    // Check if school exists
    await getSchoolById(schoolId);

    // Deactivate school
    const { error } = await supabaseAdmin
      .from("schools")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", schoolId);

    if (error) {
      throw new AppError("Failed to deactivate school", 500);
    }

    return { success: true };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to deactivate school", 500);
  }
};

/**
 * Search schools by name or slug
 * @param query - Search query
 * @param page - Page number
 * @param limit - Items per page
 * @returns Paginated search results
 */
export const searchSchools = async (
  query: string,
  page: number = 1,
  limit: number = 10,
) => {
  try {
    const offset = (page - 1) * limit;

    // Get total count
    const { count, error: countError } = await supabaseAdmin
      .from("schools")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .or(`name.ilike.%${query}%,slug.ilike.%${query}%`);

    if (countError) {
      throw new AppError("Failed to get schools count", 500);
    }

    // Get schools
    const { data: schools, error } = await supabaseAdmin
      .from("schools")
      .select("*")
      .eq("is_active", true)
      .or(`name.ilike.%${query}%,slug.ilike.%${query}%`)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new AppError("Failed to search schools", 500);
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return {
      schools: schools.map((school) => mapSchoolRowToSchool(school)),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
      },
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to search schools", 500);
  }
};
