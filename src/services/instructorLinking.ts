/**
 * @fileoverview Instructor linking service for Ridesk Server
 * @description Handles linking existing instructors to schools
 * @author Ridesk Team
 * @version 1.0.0
 */

import { supabaseAdmin } from "../database/supabase";
import { AppError, ConflictError, NotFoundError } from "../types";

/**
 * Link an existing instructor to a school
 * @param instructorEmail - Instructor's email
 * @param schoolId - School ID to link to
 * @param invitedBy - ID of user creating the link
 * @param invitedByName - Name of user creating the link
 * @returns Linked instructor data
 */
export const linkInstructorToSchool = async (
  instructorEmail: string,
  schoolId: string,
  _invitedBy: string,
  _invitedByName: string,
): Promise<any> => {
  // Check if instructor exists
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
  const authUser = existingUsers.users.find(user => user.email === instructorEmail);

  if (!authUser) {
    throw new NotFoundError("Instructor with this email does not exist");
  }

  // Get instructor data from users table
  const { data: instructor, error: instructorError } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .eq("role", "INSTRUCTOR")
    .single();

  if (instructorError || !instructor) {
    throw new NotFoundError("Instructor profile not found");
  }

  // Check if instructor is already linked to this school
  const { data: existingLink } = await supabaseAdmin
    .from("instructor_schools")
    .select("id")
    .eq("instructor_id", instructor.id)
    .eq("school_id", schoolId)
    .single();

  if (existingLink) {
    throw new ConflictError("Instructor is already linked to this school");
  }

  // Create instructor-school relationship
  const { data: link, error: linkError } = await supabaseAdmin
    .from("instructor_schools")
    .insert({
      instructor_id: instructor.id,
      school_id: schoolId,
      is_active: true,
    })
    .select()
    .single();

  if (linkError) {
    throw new AppError("Failed to link instructor to school", 500);
  }

  return {
    instructor,
    link,
    message: "Instructor successfully linked to school",
  };
};

/**
 * Check if an instructor exists and can be linked
 * @param instructorEmail - Instructor's email
 * @returns Instructor existence and linkability info
 */
export const checkInstructorLinkability = async (
  instructorEmail: string,
): Promise<{
  exists: boolean;
  isInstructor: boolean;
  currentSchools: string[];
}> => {
  // Check if user exists in auth
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
  const authUser = existingUsers.users.find(user => user.email === instructorEmail);

  if (!authUser) {
    return {
      exists: false,
      isInstructor: false,
      currentSchools: [],
    };
  }

  // Get instructor data
  const { data: instructor } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", authUser.id)
    .single();

  if (!instructor || instructor.role !== "INSTRUCTOR") {
    return {
      exists: true,
      isInstructor: false,
      currentSchools: [],
    };
  }

  // Get current schools
  const { data: schools } = await supabaseAdmin
    .from("instructor_schools")
    .select("school_id, schools(name)")
    .eq("instructor_id", authUser.id)
    .eq("is_active", true);

  return {
    exists: true,
    isInstructor: true,
    currentSchools: schools?.map((s) => s.school_id) || [],
  };
};
