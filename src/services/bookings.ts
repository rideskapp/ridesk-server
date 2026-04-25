import { supabaseAdmin } from "../database/supabase";
import { AppError } from "../types";

export interface Booking {
  id: string;
  school_id: string;
  product_id: string;
  total_minutes: number;
  remaining_minutes: number;
  start_date: string;
  end_date?: string; 
  status: "active" | "completed" | "cancelled";
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const deductBookingMinutes = async ( //deduct hrs from booking when lesson is created with "confirmed " status
  bookingId: string,
  minutes: number,
  studentId: string,
): Promise<Booking> => {
  const { data: booking, error: bookingError } = await (supabaseAdmin as any)
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) {
    throw new AppError("Booking not found", 404);
  }

  // Verify the booking belongs to the student
  const { data: participant, error: participantError } = await (supabaseAdmin as any)
    .from("booking_participants")
    .select("booking_id")
    .eq("booking_id", bookingId)
    .eq("student_id", studentId)
    .single();

  if (participantError || !participant) {
    throw new AppError("Booking does not belong to this student", 403);
  }

  if (booking.status !== "active") {
    throw new AppError("Booking is not active", 400);
  }

  if (booking.remaining_minutes < minutes) {
    throw new AppError(
      `Insufficient hours in booking. Available: ${Math.floor(booking.remaining_minutes / 60)} hours, Requested: ${Math.floor(minutes / 60)} hours`,
      400,
    );
  }

  const newRemainingMinutes = booking.remaining_minutes - minutes;
  const newStatus = newRemainingMinutes <= 0 ? "completed" : booking.status;

  const { data: updatedBooking, error: updateError } = await (supabaseAdmin as any)
    .from("bookings")
    .update({
      remaining_minutes: newRemainingMinutes,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .select()
    .single();

  if (updateError) {
    throw new AppError(`Failed to update booking: ${updateError.message}`, 500);
  }

  return updatedBooking as Booking;
};

export const restoreBookingMinutes = async ( //restore hrs to booking when lesson is deleted or status changed from confirmed to pending
  bookingId: string,
  minutes: number,
  studentId: string,
): Promise<Booking> => {
  const { data: booking, error: bookingError } = await (supabaseAdmin as any)
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) {
    throw new AppError("Booking not found", 404);
  }

  const { data: participant, error: participantError } = await (supabaseAdmin as any)
    .from("booking_participants")
    .select("booking_id")
    .eq("booking_id", bookingId)
    .eq("student_id", studentId)
    .single();

  if (participantError || !participant) {
    throw new AppError("Booking does not belong to this student", 403);
  }

  const newRemainingMinutes = Math.min(booking.remaining_minutes + minutes, booking.total_minutes);
  
  const newStatus = newRemainingMinutes > 0 ? "active" : booking.status;

  const { data: updatedBooking, error: updateError } = await (supabaseAdmin as any)
    .from("bookings")
    .update({
      remaining_minutes: newRemainingMinutes,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .select()
    .single();

  if (updateError) {
    throw new AppError(`Failed to update booking: ${updateError.message}`, 500);
  }

  return updatedBooking as Booking;
};

export const getBookingById = async (bookingId: string): Promise<Booking> => {
  const { data: booking, error } = await (supabaseAdmin as any)
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();

  if (error || !booking) {
    throw new AppError("Booking not found", 404);
  }

  return booking as Booking;
};

export const getConfirmedLessonsDuration = async (
  bookingId: string,
  excludeLessonId?: string,
): Promise<number> => {
  let query = (supabaseAdmin as any)
    .from("lessons")
    .select("duration, lesson_status_id, status")
    .eq("booking_id", bookingId);

  if (excludeLessonId) {
    query = query.neq("id", excludeLessonId);
  }

  const { data: lessons, error } = await query;

  if (error) {
    throw new AppError(`Failed to fetch lessons: ${error.message}`, 500);
  }

  if (!lessons || lessons.length === 0) {
    return 0;
  }

  const statusIds = [...new Set(lessons.map((l: any) => l.lesson_status_id).filter(Boolean))];
  
  const statusMap = new Map<string, boolean>();
  if (statusIds.length > 0) {
    const { data: statuses, error: statusError } = await (supabaseAdmin as any)
      .from("lesson_statuses")
      .select("id, name")
      .in("id", statusIds);
    
    if (!statusError && statuses) {
      statuses.forEach((s: any) => {
        statusMap.set(s.id, s.name?.toLowerCase() === "confirmed");
      });
    }
  }

  let totalDuration = 0;
  
  for (const lesson of lessons) {
    let isConfirmed = false;
    
    if (lesson.lesson_status_id && statusMap.has(lesson.lesson_status_id)) {
      isConfirmed = statusMap.get(lesson.lesson_status_id) || false;
    } else if (lesson.status && lesson.status.toLowerCase() === "confirmed") {
      isConfirmed = true;
    }
    
    if (isConfirmed) {
      totalDuration += lesson.duration || 0;
    }
  }

  return totalDuration;
};

