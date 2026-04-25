/**
 * @fileoverview Instructor utility functions
 * @description Shared utilities for instructor-related operations
 * @author Ridesk Team
 * @version 1.0.0
 */

import { supabaseAdmin } from "../database/supabase";

/**
 * Get instructor's school ID, prioritizing primary school
 * @param instructorId - Instructor user ID
 * @returns School ID if found, null otherwise
 */
export async function resolveInstructorSchoolId(
  instructorId: string,
): Promise<string | null> {
  // First, try to get primary school
  const { data: primarySchool, error: primaryError } = await supabaseAdmin
    .from("instructor_schools")
    .select("school_id")
    .eq("instructor_id", instructorId)
    .eq("is_primary", true)
    .maybeSingle();

  if (!primaryError && primarySchool) {
    return primarySchool.school_id;
  }

  // Fallback: Get any single school association (deterministic)
  const { data: anySchool, error: anySchoolError } = await supabaseAdmin
    .from("instructor_schools")
    .select("school_id")
    .eq("instructor_id", instructorId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (!anySchoolError && anySchool && anySchool.length > 0) {
    return anySchool[0]?.school_id ?? null;
  }

  return null;
}

/**
 * Check if an instructor belongs to a specific school
 * @param instructorId - Instructor user ID
 * @param schoolId - School ID to check
 * @returns boolean
 */
export async function isInstructorInSchool(
  instructorId: string,
  schoolId: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("instructor_schools")
    .select("school_id")
    .eq("instructor_id", instructorId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    console.error("Error checking instructor school membership:", error);
    return false;
  }

  return !!data;
}
