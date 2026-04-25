import { supabaseAdmin } from "../database/supabase";
import { AppError } from "../types";

export type WeeklyAvailability = { weekday: number; is_available: boolean };
export type SpecialDate = { date: string; is_available: boolean; reason?: string | null };

export const getWeeklyAvailability = async (schoolId: string): Promise<WeeklyAvailability[]> => {
  const { data, error } = await (supabaseAdmin as any)
    .from("school_availability")
    .select("weekday,is_available")
    .eq("school_id", schoolId)
    .order("weekday", { ascending: true });

  if (error) {
    throw new AppError(`Failed to fetch weekly availability: ${error.message}`, 500);
  }

  if (!data || data.length < 7) {
    await ensureWeeklyDefaults(schoolId);
    const { data: refill } = await (supabaseAdmin as any)
      .from("school_availability")
      .select("weekday,is_available")
      .eq("school_id", schoolId)
      .order("weekday", { ascending: true });
    return (refill || []) as unknown as WeeklyAvailability[];
  }

  return data as unknown as WeeklyAvailability[];
};

export const setWeeklyAvailability = async (
  schoolId: string,
  rows: WeeklyAvailability[],
): Promise<WeeklyAvailability[]> => {
  if (!Array.isArray(rows) || rows.length !== 7) {
    throw new AppError("Weekly availability must contain exactly 7 rows", 400);
  }

  const payload = rows.map((r) => ({ school_id: schoolId, weekday: r.weekday, is_available: r.is_available }));
  const { data, error } = await (supabaseAdmin as any)
    .from("school_availability")
    .upsert(payload, { onConflict: "school_id,weekday" })
    .select("weekday,is_available")
    .order("weekday", { ascending: true });

  if (error) {
    throw new AppError(`Failed to save weekly availability: ${error.message}`, 500);
  }
  return (data || []) as unknown as WeeklyAvailability[];
};

export const listSpecialDates = async (
  schoolId: string,
  from: string,
  to: string,
): Promise<SpecialDate[]> => {
  const { data, error } = await (supabaseAdmin as any)
    .from("school_special_dates")
    .select("date,is_available,reason")
    .eq("school_id", schoolId)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  if (error) {
    throw new AppError(`Failed to list special dates: ${error.message}`, 500);
  }
  return (data || []) as unknown as SpecialDate[];
};

export const upsertSpecialDatesBulk = async (
  schoolId: string,
  items: SpecialDate[],
): Promise<SpecialDate[]> => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }
  if (items.length > 366) {
    throw new AppError("Too many dates in one request (max 366)", 400);
  }

  const payload = items.map((i) => ({ school_id: schoolId, date: i.date, is_available: i.is_available, reason: i.reason || null }));
  const { data, error } = await (supabaseAdmin as any)
    .from("school_special_dates")
    .upsert(payload, { onConflict: "school_id,date" })
    .select("date,is_available,reason")
    .order("date", { ascending: true });

  if (error) {
    throw new AppError(`Failed to upsert special dates: ${error.message}`, 500);
  }
  return (data || []) as unknown as SpecialDate[];
};

export const deleteSpecialDates = async (schoolId: string, dates: string[]): Promise<{ deleted: number }> => {
  if (!dates?.length) return { deleted: 0 };
  const { count, error } = await (supabaseAdmin as any)
    .from("school_special_dates")
    .delete({ count: "exact" })
    .eq("school_id", schoolId)
    .in("date", dates);
  if (error) {
    throw new AppError(`Failed to delete special dates: ${error.message}`, 500);
  }
  return { deleted: count || 0 };
};

export const isSchoolDateAvailable = async (schoolId: string, date: string): Promise<boolean> => {
  // 1) Check special date override
  const { data: special, error: specialErr } = await (supabaseAdmin as any)
    .from("school_special_dates")
    .select("is_available")
    .eq("school_id", schoolId)
    .eq("date", date)
    .maybeSingle();
  if (specialErr) {
    throw new AppError(`Failed to check special date: ${specialErr.message}`, 500);
  }
  if (special) return Boolean((special as any).is_available);

  // 2) Fallback to weekly rule
  let dateStr = date;
  if (!date.includes("T")) {
    dateStr = date + "T00:00:00Z";
  }
  
  const jsDate = new Date(dateStr);
  
  // Validate date
  if (isNaN(jsDate.getTime())) {
    throw new AppError(`Invalid date format: ${date}`, 400);
  }
  
  const sundayZero = jsDate.getUTCDay();
  const weekday = sundayZero === 0 ? 6 : sundayZero - 1;

  if (isNaN(weekday) || weekday < 0 || weekday > 6) {
    throw new AppError(`Invalid weekday calculated: ${weekday} for date: ${date}`, 400);
  }

  const weekdayInt = parseInt(String(weekday), 10);
  if (isNaN(weekdayInt) || weekdayInt < 0 || weekdayInt > 6) {
    throw new AppError(`Invalid weekday integer: ${weekdayInt} for date: ${date}`, 400);
  }

  const { data: weekly, error: weeklyErr } = await (supabaseAdmin as any)
    .from("school_availability")
    .select("is_available")
    .eq("school_id", schoolId)
    .eq("weekday", weekdayInt)
    .maybeSingle();
  if (weeklyErr) {
    throw new AppError(`Failed to fetch weekly availability: ${weeklyErr.message}`, 500);
  }
  return weekly ? Boolean((weekly as any).is_available) : true;
};

export const ensureWeeklyDefaults = async (schoolId: string): Promise<void> => {
  await (supabaseAdmin as any).rpc("ensure_weekly_defaults", { p_school_id: schoolId as any });
};


