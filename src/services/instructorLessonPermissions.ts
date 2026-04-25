import { supabaseAdmin } from "../database/supabase";

export const NO_BOOKED_HOURS_ERROR =
  "No available booked hours for this student. Please contact the school to update the booking.";
export const INSTRUCTOR_LESSON_EDIT_FORBIDDEN_ERROR =
  "You are not authorized by this school to edit lessons.";

export const canInstructorEditLessonsInSchool = async (
  instructorId: string,
  schoolId: string,
): Promise<boolean> => {
  const { data, error } = await (supabaseAdmin as any)
    .from("instructor_lesson_permissions")
    .select("can_edit_lessons")
    .eq("instructor_id", instructorId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to check instructor lesson permissions: ${error.message}`,
    );
  }

  return Boolean(data?.can_edit_lessons);
};

export const setInstructorLessonEditPermission = async (
  instructorId: string,
  schoolId: string,
  canEditLessons: boolean,
  actorId: string,
) => {
  const now = new Date().toISOString();
  const { data, error } = await (supabaseAdmin as any)
    .from("instructor_lesson_permissions")
    .upsert(
      {
        instructor_id: instructorId,
        school_id: schoolId,
        can_edit_lessons: canEditLessons,
        created_by: actorId,
        updated_by: actorId,
        updated_at: now,
      },
      { onConflict: "instructor_id,school_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to set instructor lesson permission: ${error.message}`);
  }

  return data;
};

export const removeInstructorLessonEditPermission = async (
  instructorId: string,
  schoolId: string,
) => {
  const { error } = await (supabaseAdmin as any)
    .from("instructor_lesson_permissions")
    .delete()
    .eq("instructor_id", instructorId)
    .eq("school_id", schoolId);

  if (error) {
    throw new Error(
      `Failed to remove instructor lesson permission: ${error.message}`,
    );
  }
};

export const listInstructorLessonPermissionsBySchool = async (schoolId: string) => {
  const { data, error } = await (supabaseAdmin as any)
    .from("instructor_lesson_permissions")
    .select("id, instructor_id, school_id, can_edit_lessons, updated_at")
    .eq("school_id", schoolId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list instructor lesson permissions: ${error.message}`);
  }

  return data || [];
};
