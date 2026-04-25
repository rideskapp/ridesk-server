/**
 * @fileoverview Instructor-School management service
 * @description Handles many-to-many relationships between instructors and schools
 * @author Ridesk Team
 * @version 1.0.0
 */

import { supabaseAdmin } from "../database/supabase";
import {
  InstructorSchoolAssignment,
  AssignInstructorToSchoolRequest,
  UpdateInstructorSchoolAssignmentRequest,
  NotFoundError,
  AppError,
} from "../types";

/**
 * Assign instructor to school
 * @param assignmentData - Assignment data
 * @returns Created assignment
 */
export const assignInstructorToSchool = async (
  assignmentData: AssignInstructorToSchoolRequest,
): Promise<InstructorSchoolAssignment> => {
  try {
    // Validate instructor exists and has INSTRUCTOR role
    const { data: instructor, error: instructorError } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("id", assignmentData.instructorId)
      .single();

    if (instructorError || !instructor) {
      throw new NotFoundError("Instructor not found");
    }

    if (instructor.role !== "INSTRUCTOR") {
      throw new AppError("User is not an instructor", 400);
    }

    // Validate school exists
    const { data: school, error: schoolError } = await supabaseAdmin
      .from("schools")
      .select("id, name, slug")
      .eq("id", assignmentData.schoolId)
      .single();

    if (schoolError || !school) {
      throw new NotFoundError("School not found");
    }

    // If setting as primary, unset other primary assignments for this instructor
    if (assignmentData.isPrimary) {
      await supabaseAdmin
        .from("instructor_schools")
        .update({ is_primary: false })
        .eq("instructor_id", assignmentData.instructorId);
    }

    // Create instructor-school assignment in junction table
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("instructor_schools")
      .insert({
        instructor_id: assignmentData.instructorId,
        school_id: assignmentData.schoolId,
        is_primary: assignmentData.isPrimary || false,
        hourly_rate: assignmentData.hourlyRate ?? null,
        commission_rate: assignmentData.commissionRate ?? null,
      })
      .select(
        `
        id,
        instructor_id,
        school_id,
        is_primary,
        hourly_rate,
        commission_rate,
        is_active,
        created_at,
        updated_at,
        schools!inner(name, slug)
      `,
      )
      .single();

    if (assignmentError) {
      throw new AppError(
        `Failed to assign instructor to school: ${assignmentError.message}`,
        500,
      );
    }

    return {
      id: assignment.id,
      instructorId: assignment.instructor_id,
      schoolId: assignment.school_id,
      schoolName: assignment.schools.name,
      schoolSlug: assignment.schools.slug,
      isPrimary: assignment.is_primary,
      hourlyRate: assignment.hourly_rate,
      commissionRate: assignment.commission_rate,
      isActive: assignment.is_active,
      createdAt: assignment.created_at,
      updatedAt: assignment.updated_at,
    };
  } catch (error) {
    if (error instanceof AppError || error instanceof NotFoundError) {
      throw error;
    }
    throw new AppError("Failed to assign instructor to school", 500);
  }
};

/**
 * Remove instructor from school
 * @param instructorId - Instructor ID
 * @param schoolId - School ID
 * @returns Success status
 */
export const removeInstructorFromSchool = async (
  instructorId: string,
  schoolId: string,
): Promise<{ success: boolean }> => {
  try {
    const { error } = await supabaseAdmin
      .from("instructor_schools")
      .delete()
      .eq("instructor_id", instructorId)
      .eq("school_id", schoolId);

    if (error) {
      throw new AppError(
        `Failed to remove instructor from school: ${error.message}`,
        500,
      );
    }

    return { success: true };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to remove instructor from school", 500);
  }
};

/**
 * Get instructor's school assignments
 * @param instructorId - Instructor ID
 * @returns List of school assignments
 */
export const getInstructorSchools = async (
  instructorId: string,
): Promise<InstructorSchoolAssignment[]> => {
  try {
    const { data, error } = await supabaseAdmin
      .from("instructor_schools")
      .select(
        `
        id,
        school_id,
        is_primary,
        hourly_rate,
        commission_rate,
        is_active,
        created_at,
        updated_at,
        schools!inner(
          name,
          slug,
          school_settings(
            compensation_mode
          )
        )
      `,
      )
      .eq("instructor_id", instructorId)
      .order("is_primary", { ascending: false })
      // Order by related table column requires foreignTable option
      .order("name", { foreignTable: "schools", ascending: true });

    if (error) {
      throw new AppError(
        `Failed to get instructor schools: ${error.message}`,
        500,
      );
    }

    return data.map((assignment: any) => ({
      id: assignment.id,
      instructorId,
      schoolId: assignment.school_id,
      schoolName: assignment.schools.name,
      schoolSlug: assignment.schools.slug,
      isPrimary: assignment.is_primary,
      hourlyRate: assignment.hourly_rate,
      commissionRate: assignment.commission_rate,
      isActive: assignment.is_active,
      compensationMode: assignment.schools.school_settings?.[0]?.compensation_mode || assignment.schools.school_settings?.compensation_mode || 'fixed',
      createdAt: assignment.created_at,
      updatedAt: assignment.updated_at,
    }));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to get instructor schools", 500);
  }
};

/**
 * Get school's instructors
 * @param schoolId - School ID
 * @returns List of instructor assignments
 */
export const getSchoolInstructors = async (
  schoolId: string,
): Promise<InstructorSchoolAssignment[]> => {
  try {
    const { data, error } = await supabaseAdmin
      .from("instructor_schools")
      .select(
        `
        id,
        instructor_id,
        is_primary,
        hourly_rate,
        commission_rate,
        is_active,
        created_at,
        updated_at,
        users!inner(
          first_name,
          last_name
        ),
        schools!inner(
          name,
          slug
        )
      `,
      )
      .eq("school_id", schoolId)
      .order("is_primary", { ascending: false })
      // Order by related table column requires foreignTable option
      .order("first_name", { foreignTable: "users", ascending: true });

    if (error) {
      throw new AppError(
        `Failed to get school instructors: ${error.message}`,
        500,
      );
    }

    return data.map((assignment: any) => ({
      id: assignment.id,
      instructorId: assignment.instructor_id,
      schoolId,
      schoolName: assignment.schools.name,
      schoolSlug: assignment.schools.slug,
      isPrimary: assignment.is_primary,
      hourlyRate: assignment.hourly_rate,
      commissionRate: assignment.commission_rate,
      isActive: assignment.is_active,
      createdAt: assignment.created_at,
      updatedAt: assignment.updated_at,
    }));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to get school instructors", 500);
  }
};

/**
 * Update instructor school assignment
 * @param assignmentId - Assignment ID
 * @param updateData - Update data
 * @returns Updated assignment
 */
export const updateInstructorSchoolAssignment = async (
  assignmentId: string,
  updateData: UpdateInstructorSchoolAssignmentRequest,
): Promise<InstructorSchoolAssignment> => {
  try {
    // If setting as primary, unset other primary assignments for this instructor
    if (updateData.isPrimary) {
      const { data: assignment } = await supabaseAdmin
        .from("instructor_schools")
        .select("instructor_id")
        .eq("id", assignmentId)
        .single();

      if (assignment) {
        await supabaseAdmin
          .from("instructor_schools")
          .update({ is_primary: false })
          .eq("instructor_id", assignment.instructor_id)
          .neq("id", assignmentId);
      }
    }

    // Build update payload without undefined properties to satisfy exactOptionalPropertyTypes
    const updatePayload: Record<string, any> = {};
    if (updateData.isPrimary !== undefined) {
      updatePayload["is_primary"] = updateData.isPrimary;
    }
    if (updateData.hourlyRate !== undefined) {
      updatePayload["hourly_rate"] = updateData.hourlyRate ?? null;
    }
    if (updateData.commissionRate !== undefined) {
      updatePayload["commission_rate"] = updateData.commissionRate ?? null;
    }
    if (updateData.isActive !== undefined) {
      updatePayload["is_active"] = updateData.isActive;
    }

    const { data: updatedAssignment, error } = await supabaseAdmin
      .from("instructor_schools")
      .update(updatePayload)
      .eq("id", assignmentId)
      .select(
        `
        id,
        instructor_id,
        school_id,
        is_primary,
        hourly_rate,
        commission_rate,
        is_active,
        created_at,
        updated_at,
        schools!inner(
          name,
          slug
        )
      `,
      )
      .single();

    if (error || !updatedAssignment) {
      throw new AppError(`Failed to update assignment: ${error?.message}`, 500);
    }

    return {
      id: updatedAssignment.id,
      instructorId: updatedAssignment.instructor_id,
      schoolId: updatedAssignment.school_id,
      schoolName: updatedAssignment.schools.name,
      schoolSlug: updatedAssignment.schools.slug,
      isPrimary: updatedAssignment.is_primary,
      hourlyRate: updatedAssignment.hourly_rate,
      commissionRate: updatedAssignment.commission_rate,
      isActive: updatedAssignment.is_active,
      createdAt: updatedAssignment.created_at,
      updatedAt: updatedAssignment.updated_at,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to update instructor school assignment", 500);
  }
};
