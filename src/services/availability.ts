/**
 * @fileoverview Instructor availability service
 * @description Encapsulates availability CRUD and helper queries using Supabase RPCs
 */

import { supabaseAdmin } from "../database/supabase";
import { AppError } from "../types";

const normalizeTime = (time: string): string => {
  const parts = time.split(":");
  const hours = parts[0] || "00";
  const minutes = parts[1] || "00";
  const seconds = parts[2] || "00";
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:${seconds.padStart(2, "0")}`;
};

const normalizeDate = (d: string) => d.split("T")[0] as string;

export interface InstructorAvailability {
  id: string;
  instructor_id: string;
  date: string; // YYYY-MM-DD
  time_start: string; // HH:MM:SS
  time_end: string; // HH:MM:SS
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface MinimalSlotRow {
  id: string;
  date: string;
  time_start: string;
  time_end: string;
}

export const getInstructorAvailability = async (
  instructorId: string,
  startDate: string,
  endDate: string,
): Promise<InstructorAvailability[]> => {
  const { data, error } = await supabaseAdmin
    .from("instructor_availability")
    .select("*")
    .eq("instructor_id", instructorId)
    .gte("date", startDate)
    .lte("date", endDate);

  if (error) {
    throw new AppError(`Failed to fetch availability: ${error.message}`, 500);
  }

  return (data as unknown as InstructorAvailability[]) ?? [];
};

export const addInstructorAvailability = async (
  instructorId: string,
  date: string,
  timeStart: string,
  timeEnd: string,
): Promise<string> => {
  // Normalize inputs
  const normDate = normalizeDate(date);
  const normTimeStart = normalizeTime(timeStart);
  const normTimeEnd = normalizeTime(timeEnd);

  // First check if it already exists to avoid unique constraint violation
  const { data: existingRecords, error: existingError } = await supabaseAdmin
    .from("instructor_availability")
    .select("id, active")
    .eq("instructor_id", instructorId)
    .eq("date", normDate)
    .eq("time_start", normTimeStart)
    .eq("time_end", normTimeEnd)
    .limit(1);

  if (existingError) {
    throw new AppError(`Failed to checking existing availability: ${existingError.message}`, 500);
  }

  const existing = existingRecords?.[0];

  if (existing) {
    if (!existing.active) {
      // Reactivate the slot if it exists but is inactive
      const { error: updateError } = await supabaseAdmin
        .from("instructor_availability")
        .update({ active: true })
        .eq("id", existing.id);

      if (updateError) {
        throw new AppError(`Failed to reactivate availability: ${updateError.message}`, 400);
      }
    }
    return existing.id;
  }

  const { data, error } = await supabaseAdmin
    .from("instructor_availability")
    .insert({
      instructor_id: instructorId,
      date: normDate,
      time_start: normTimeStart,
      time_end: normTimeEnd,
      active: true // Ensure active is true
    })
    .select();

  if (error) {
    // If we hit a race condition, try one more time to fetch
    if (error.code === '23505') { // Unique violation
      const { data: retryRecords, error: retryError } = await supabaseAdmin
        .from("instructor_availability")
        .select("id, active")
        .eq("instructor_id", instructorId)
        .eq("date", normDate)
        .eq("time_start", normTimeStart)
        .eq("time_end", normTimeEnd)
        .limit(1);

      if (retryError) {
        throw new AppError(`Failed to fetch availability on retry: ${retryError.message}`, 500);
      }
      
      const retryExisting = retryRecords?.[0];

      if (retryExisting) {
         if (!retryExisting.active) {
            const { error: updateError } = await supabaseAdmin
              .from("instructor_availability")
              .update({ active: true })
              .eq("id", retryExisting.id);

            if (updateError) {
              throw new AppError(`Failed to reactivate availability on retry: ${updateError.message}`, 400);
            }
         }
         return retryExisting.id;
      }
    }

    throw new AppError(`Failed to add availability: ${error.message}`, 400);
  }

  return data?.[0]?.id || "";
};

export const addBatchInstructorAvailability = async (
  instructorId: string,
  slots: Array<{ date: string; timeStart: string; timeEnd: string }>,
): Promise<string[]> => {
  if (slots.length === 0) return [];

  // Prepare data for upsert with normalized dates and times
  // Deduplicate and normalize in one pass
  const uniqueRecordsMap = new Map<string, {
    instructor_id: string;
    date: string;
    time_start: string;
    time_end: string;
    active: boolean;
  }>();

  slots.forEach((slot) => {
    const record = {
      instructor_id: instructorId, // Used as part of the key for consistency, though constant here
      date: normalizeDate(slot.date),
      time_start: normalizeTime(slot.timeStart),
      time_end: normalizeTime(slot.timeEnd),
      active: true,
    };
    // Include instructor_id in key for completeness, though it's constant for this batch
    const key = `${record.instructor_id}|${record.date}|${record.time_start}|${record.time_end}`;
    
    // We only need one record per key for the upsert
    if (!uniqueRecordsMap.has(key)) {
      uniqueRecordsMap.set(key, record);
    }
  });

  const uniqueRecords = Array.from(uniqueRecordsMap.values());

  // Perform upsert (insert or update on conflict)
  const { error } = await supabaseAdmin
    .from("instructor_availability")
    .upsert(uniqueRecords, {
      onConflict: "instructor_id,date,time_start,time_end",
      ignoreDuplicates: false, // Set to false to allow reactivation of inactive slots
    });

  if (error) {
    throw new AppError(
      `Failed to add batch availability: ${error.message}`,
      400,
    );
  }

  // Fetch all existing IDs for the requested slots (mirroring single-slot logic pattern)
  const uniqueDates = Array.from(new Set(uniqueRecords.map((r) => r.date)));

  const { data: currentSlots, error: fetchError } = await supabaseAdmin
    .from("instructor_availability")
    .select("id, date, time_start, time_end")
    .eq("instructor_id", instructorId)
    .in("date", uniqueDates);

  if (fetchError) {
    throw new AppError(
      `Failed to fetch availability ids: ${fetchError.message}`,
      500,
    );
  }

  // Create a map for quick lookup using keys formed by normalized components
  const slotMap = new Map<string, string>();
  currentSlots?.forEach((row: MinimalSlotRow) => {
    // DB returns YYYY-MM-DD
    const key = `${normalizeDate(row.date)}|${normalizeTime(row.time_start)}|${normalizeTime(row.time_end)}`;
    slotMap.set(key, row.id);
  });

  // Map input slots back to their IDs using normalized keys
  const ids: string[] = [];
  slots.forEach((slot) => {
    const key = `${normalizeDate(slot.date)}|${normalizeTime(slot.timeStart)}|${normalizeTime(slot.timeEnd)}`;

    if (slotMap.has(key)) {
      ids.push(slotMap.get(key)!);
    }
  });

  return ids;
};

export const removeInstructorAvailability = async (
  availabilityId: string,
): Promise<boolean> => {
  const { error } = await supabaseAdmin
    .from("instructor_availability")
    .delete()
    .eq("id", availabilityId);

  if (error) {
    throw new AppError(`Failed to remove availability: ${error.message}`, 400);
  }

  return !error;
};



export const checkInstructorAvailabilitySlot = async (
  instructorId: string,
  date: string,
  timeStart: string,
  timeEnd: string,
): Promise<boolean> => {
  // Normalize time formats to HH:MM:SS for consistent comparison
  const normalizedTimeStart = normalizeTime(timeStart);
  const normalizedTimeEnd = normalizeTime(timeEnd);

  const { data: slots, error: fetchError } = await supabaseAdmin
    .from("instructor_availability")
    .select("time_start, time_end")
    .eq("instructor_id", instructorId)
    .eq("date", date)
    .eq("active", true)
    .order("time_start", { ascending: true });

  if (fetchError) {
    console.error('Availability fetch error:', {
      instructorId,
      date,
      error: fetchError.message,
    });
    throw new AppError(`Failed to check availability: ${fetchError.message}`, 400);
  }

  if (!slots || slots.length === 0) {
    return false;
  }

  // Check if a single slot covers the entire duration
  const singleSlot = slots.find(
    (slot) =>
      slot.time_start <= normalizedTimeStart &&
      slot.time_end >= normalizedTimeEnd
  );

  if (singleSlot) {
    return true;
  }

  // If no single slot covers it, check if multiple consecutive slots cover the duration
  const relevantSlots = slots.filter(
    (slot) =>
      slot.time_start < normalizedTimeEnd && slot.time_end > normalizedTimeStart
  );

  if (relevantSlots.length === 0) {
    return false;
  }

  relevantSlots.sort((a, b) => a.time_start.localeCompare(b.time_start));

  const startingSlot = relevantSlots.find(
    (slot) => slot.time_start <= normalizedTimeStart
  );

  if (!startingSlot) {
    return false; // No slot starts at or before lesson start
  }

  let coverageEnd = startingSlot.time_end;

  for (const slot of relevantSlots) {
    if (slot.time_start <= coverageEnd) {
      coverageEnd = slot.time_end > coverageEnd ? slot.time_end : coverageEnd;
    }
  }

  return coverageEnd >= normalizedTimeEnd;
};

export interface AvailableInstructor {
  instructor_id: string;
  first_name: string;
  last_name: string;
  email: string;
  specialties: string[] | null;
  languages: string[] | null;
}

export const getAvailableInstructorsForSlot = async (
  _schoolId: string,
  date: string,
  timeStart: string,
  timeEnd: string,
  _discipline?: string,
): Promise<AvailableInstructor[]> => {
  // Normalize time formats to HH:MM:SS for consistent comparison
  const normalizedTimeStart = normalizeTime(timeStart);
  const normalizedTimeEnd = normalizeTime(timeEnd);

  const { data, error } = await supabaseAdmin
    .from("instructor_availability")
    .select(
      `
      instructor_id,
      users!inner(first_name, last_name, email)
    `,
    )
    .eq("date", date)
    .eq("active", true)
    .lte("time_start", normalizedTimeStart)
    .gte("time_end", normalizedTimeEnd);

  if (error) {
    throw new AppError(
      `Failed to get available instructors: ${error.message}`,
      500,
    );
  }

  return (
    data?.map((item: any) => ({
      instructor_id: item.instructor_id,
      first_name: item.users.first_name,
      last_name: item.users.last_name,
      email: item.users.email,
      specialties: null,
      languages: null,
    })) ?? []
  );
};

/**
 * Get availability for multiple instructors in a single batch
 * @param instructorIds - Array of instructor IDs
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Array of availability slots for all instructors
 */
export const getBatchInstructorAvailability = async (
  instructorIds: string[],
  startDate: string,
  endDate: string,
): Promise<InstructorAvailability[]> => {
  if (instructorIds.length === 0) {
    return [];
  }

  // Fetch all instructor availabilities in parallel
  const promises = instructorIds.map((id) =>
    getInstructorAvailability(id, startDate, endDate),
  );
  const results = await Promise.all(promises);
  return results.flat();
};
