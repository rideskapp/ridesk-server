// Handles instructor rates and compensation calculations

import { supabaseAdmin } from "../database/supabase";
import { AppError, NotFoundError, ALL_SCHOOLS_ID } from "../types";
import { logger } from "../utils/logger";

export interface InstructorRate {
  id: string;
  instructor_id: string;
  category_id: string;
  school_id: string;
  category_name?: string;
  discipline?: string;
  rate_type: "hourly";
  rate_value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateInstructorRateRequest {
  instructor_id: string;
  category_id: string;
  school_id: string;
  rate_type: "hourly";
  rate_value: number;
  is_active?: boolean;
}

export interface UpdateInstructorRateRequest {
  category_id?: string;
  rate_type?: "hourly";
  rate_value?: number;
  is_active?: boolean;
}

export interface LessonCompensationDetail {
  lessonId: string;
  date: string;
  time: string;
  duration: number;
  categoryId: string;
  categoryName?: string;
  productName?: string;
  studentName?: string;
  hourlyRate: number;
  compensation: number;
  compensationPaid: boolean;
}

export interface InstructorCompensationSummary {
  instructorId: string;
  instructorName: string;
  totalCompensation: number;
  totalHours: number;
  lessonCount: number;
  lessons: LessonCompensationDetail[];
  paidCompensation: number;
  unpaidCompensation: number;
  paidLessonCount: number;
  unpaidLessonCount: number;
}

export interface CompensationReport {
  instructorSummaries: InstructorCompensationSummary[];
  stats: {
    totalCompensation: number;
    activeInstructors: number;
    totalLessons: number;
    totalHours: number;
    averagePerLesson: number;
    averagePerHour: number;
    paidCompensation: number;
    unpaidCompensation: number;
    paidLessonCount: number;
    unpaidLessonCount: number;
  };
}

export const getInstructorRates = async (
  instructorId: string,
  schoolId: string,
): Promise<InstructorRate[]> => {
  try {
    // Validate school exists
    const { data: school, error: schoolError } = await supabaseAdmin
      .from("schools")
      .select("id")
      .eq("id", schoolId)
      .single();

    if (schoolError || !school) {
      throw new NotFoundError("School not found");
    }

    // Validate instructor belongs to this school
    const { error: instructorSchoolError } = await supabaseAdmin
      .from("instructor_schools")
      .select("school_id")
      .eq("instructor_id", instructorId)
      .eq("school_id", schoolId)
      .single();

    if (instructorSchoolError) {
      throw new AppError("Instructor does not belong to this school", 403);
    }

    const { data, error } = await (supabaseAdmin as any)
      .from("instructor_rates")
      .select("*")
      .eq("instructor_id", instructorId)
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .order("category_id", { ascending: true })
      .not("category_id", "is", null);

    if (error) {
      throw new AppError(`Failed to fetch instructor rates: ${error.message}`, 500);
    }

    const rates = data || [];
    if (rates.length > 0) {
      const categoryIds = [...new Set(rates.map((r: any) => r.category_id).filter(Boolean))];
      if (categoryIds.length > 0) {
        const { data: categories, error: categoriesError } = await (supabaseAdmin as any)
          .from("product_categories")
          .select("id, name")
          .in("id", categoryIds);

        if (!categoriesError && categories) {
          const categoryMap = new Map(categories.map((c: any) => [c.id, c.name]));
          return rates.map((rate: any) => ({
            ...rate,
            category_name: categoryMap.get(rate.category_id) || null,
          })) as InstructorRate[];
        }
      }
    }

    return rates.map((rate: any) => ({
      ...rate,
      category_name: null,
    })) as InstructorRate[];
  } catch (error: any) {
    if (error instanceof AppError || error instanceof NotFoundError) {
      throw error;
    }
    throw new AppError(`Failed to get instructor rates: ${error.message}`, 500);
  }
};

export const createInstructorRate = async (
  rateData: CreateInstructorRateRequest,
  schoolId: string,
): Promise<InstructorRate> => {
  try {
    // Validate schoolId matches rateData.school_id
    if (rateData.school_id !== schoolId) {
      throw new AppError("School ID mismatch", 400);
    }

    // Validate rate_type is "hourly" (only supported type)
    if (rateData.rate_type !== "hourly") {
      throw new AppError("Only 'hourly' rate_type is supported", 400);
    }

    // Validate instructor belongs to school
    const { error: instructorSchoolError } = await supabaseAdmin
      .from("instructor_schools")
      .select("school_id")
      .eq("instructor_id", rateData.instructor_id)
      .eq("school_id", schoolId)
      .single();

    if (instructorSchoolError) {
      throw new AppError("Instructor does not belong to this school", 403);
    }

    // Validate category belongs to school
    const { data: category, error: categoryError } = await (supabaseAdmin as any)
      .from("product_categories")
      .select("id, school_id")
      .eq("id", rateData.category_id)
      .single();

    if (categoryError || !category) {
      throw new NotFoundError("Product category not found");
    }

    if ((category as any).school_id !== schoolId) {
      throw new AppError("Product category does not belong to this school", 403);
    }

    let existing = null;
    try {
      const { data: existingData, error: checkError } = await (supabaseAdmin as any)
        .from("instructor_rates")
        .select("id")
        .eq("instructor_id", rateData.instructor_id)
        .eq("category_id", rateData.category_id)
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        if (checkError.message?.includes("does not exist") || checkError.message?.includes("category_id")) {
          existing = null;
        } else {
          throw new AppError(`Failed to check existing rates: ${checkError.message}`, 500);
        }
      } else {
        existing = existingData;
      }
    } catch (err: any) {
      if (err.message?.includes("does not exist") || err.message?.includes("category_id")) {
        existing = null;
      } else {
        throw err;
      }
    }

    if (existing) {
      throw new AppError(
        `Active rate already exists for this instructor, category, and school. Please update the existing rate instead.`,
        409,
      );
    }

    const { data, error } = await (supabaseAdmin as any)
      .from("instructor_rates")
      .insert([
        {
          instructor_id: rateData.instructor_id,
          category_id: rateData.category_id,
          school_id: rateData.school_id,
          rate_type: rateData.rate_type,
          rate_value: rateData.rate_value,
          is_active: rateData.is_active ?? true,
        },
      ])
      .select("*")
      .single();

    if (error) {
      throw new AppError(`Failed to create instructor rate: ${error.message}`, 500);
    }

    let categoryName = null;
    if (data.category_id) {
      const { data: category, error: categoryError } = await (supabaseAdmin as any)
        .from("product_categories")
        .select("name")
        .eq("id", data.category_id)
        .single();
      
      if (!categoryError && category) {
        categoryName = category.name;
      }
    }

    return {
      ...data,
      category_name: categoryName,
    } as InstructorRate;
  } catch (error: any) {
    if (error instanceof AppError || error instanceof NotFoundError) {
      throw error;
    }
    throw new AppError(`Failed to create instructor rate: ${error.message}`, 500);
  }
};

export const updateInstructorRate = async (
  id: string,
  updates: UpdateInstructorRateRequest,
  schoolId: string,
): Promise<InstructorRate> => {
  try {
    // Get existing rate with school_id
    const { data: existing, error: fetchError } = await (supabaseAdmin as any)
      .from("instructor_rates")
      .select("instructor_id, school_id, category_id")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError("Instructor rate not found");
    }

    // Validate school matches
    if (existing.school_id !== schoolId) {
      throw new AppError("Rate does not belong to this school", 403);
    }

    // Validate rate_type is "hourly" if provided (only supported type)
    if (updates.rate_type !== undefined && updates.rate_type !== "hourly") {
      throw new AppError("Only 'hourly' rate_type is supported", 400);
    }

    // If category_id is being changed, validate new category belongs to school
    if (updates.category_id && updates.category_id !== existing.category_id) {
      const { data: category, error: categoryError } = await (supabaseAdmin as any)
        .from("product_categories")
        .select("id, school_id")
        .eq("id", updates.category_id)
        .single();

      if (categoryError || !category) {
        throw new NotFoundError("Product category not found");
      }

      if ((category as any).school_id !== schoolId) {
        throw new AppError("Product category does not belong to this school", 403);
      }

      // Check for conflict with new category (including school_id)
      const { data: conflict, error: conflictError } = await (supabaseAdmin as any)
        .from("instructor_rates")
        .select("id")
        .eq("instructor_id", existing.instructor_id)
        .eq("category_id", updates.category_id)
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .neq("id", id)
        .single();

      if (conflictError && conflictError.code !== "PGRST116") {
        throw new AppError(`Failed to check conflicts: ${conflictError.message}`, 500);
      }

      if (conflict) {
        throw new AppError(
          `Active rate already exists for this instructor and category in this school.`,
          409,
        );
      }
    }

    const updateData: any = {};
    if (updates.category_id !== undefined) updateData.category_id = updates.category_id;
    if (updates.rate_type !== undefined) updateData.rate_type = updates.rate_type;
    if (updates.rate_value !== undefined) updateData.rate_value = updates.rate_value;
    if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

    const { data, error } = await (supabaseAdmin as any)
      .from("instructor_rates")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new AppError(`Failed to update instructor rate: ${error.message}`, 500);
    }

    // Fetch category name separately
    let categoryName = null;
    if (data.category_id) {
      const { data: category, error: categoryError } = await (supabaseAdmin as any)
        .from("product_categories")
        .select("name")
        .eq("id", data.category_id)
        .single();
      
      if (!categoryError && category) {
        categoryName = category.name;
      }
    }

    return {
      ...data,
      category_name: categoryName,
    } as InstructorRate;
  } catch (error: any) {
    if (error instanceof AppError || error instanceof NotFoundError) {
      throw error;
    }
    throw new AppError(`Failed to update instructor rate: ${error.message}`, 500);
  }
};

export const deleteInstructorRate = async (
  id: string,
  schoolId: string,
): Promise<void> => {
  try {
    const { data: existing, error: fetchError } = await (supabaseAdmin as any)
      .from("instructor_rates")
      .select("instructor_id, school_id")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError("Instructor rate not found");
    }

    // Validate school matches
    if (existing.school_id !== schoolId) {
      throw new AppError("Rate does not belong to this school", 403);
    }

    const { error } = await (supabaseAdmin as any)
      .from("instructor_rates")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      throw new AppError(`Failed to delete instructor rate: ${error.message}`, 500);
    }
  } catch (error: any) {
    if (error instanceof AppError || error instanceof NotFoundError) {
      throw error;
    }
    throw new AppError(`Failed to delete instructor rate: ${error.message}`, 500);
  }
};


export const calculateLessonCompensation = async (
  instructorId: string,
  categoryId: string,
  duration: number, // duration in hours
  schoolId: string,
): Promise<number | null> => {
  try {
    if (!categoryId || !schoolId) {
      return null;
    }

    const { data: rate, error } = await (supabaseAdmin as any)
      .from("instructor_rates")
      .select("rate_type, rate_value")
      .eq("instructor_id", instructorId)
      .eq("category_id", categoryId)
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .single();

    if (error || !rate) {
      return null;
    }

    // Only handle hourly rate type
    if (rate.rate_type === "hourly") {
      return rate.rate_value * duration;
    }

    return null;
  } catch (error: any) {
    console.error("Error calculating lesson compensation:", error);
    return null;
  }
};

export interface CompensationBreakdown {
  amount: number;
  hourlyRate: number;
  hours: number;
  rateType: "hourly";
  formula: string;
  instructorId: string;
  productId?: string | undefined;
  productName?: string | undefined;
  categoryId: string;
  categoryName?: string | undefined;
  rateId?: string | undefined;
  isVisible: boolean;
  isCalculated: boolean;
}

export const getLessonCompensationBreakdown = async (
  instructorId: string,
  categoryId: string,
  durationHours: number,
  schoolId: string,
  productId?: string,
  productName?: string,
): Promise<CompensationBreakdown | null> => {
  try {
    if (!categoryId || !schoolId) {
      return null; 
    }

    const { data: rate, error: rateError } = await (supabaseAdmin as any)
      .from("instructor_rates")
      .select("id, rate_type, rate_value, category_id")
      .eq("instructor_id", instructorId)
      .eq("category_id", categoryId)
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .single();

    if (rateError || !rate) {
      return {
        amount: 0,
        hourlyRate: 0,
        hours: durationHours,
        rateType: "hourly",
        formula: "N/A",
        instructorId,
        productId: productId || undefined,
        productName: productName || undefined,
        categoryId,
        categoryName: undefined,
        rateId: undefined,
        isVisible: false,
        isCalculated: false,
      };
    }

    let categoryName = null;
    if (rate.category_id) {
      const { data: category, error: categoryError } = await (supabaseAdmin as any)
        .from("product_categories")
        .select("name")
        .eq("id", rate.category_id)
        .single();
      
      if (!categoryError && category) {
        categoryName = category.name;
      }
    }
    let amount = 0;
    let formula = "";
    const hourlyRate = rate.rate_type === "hourly" ? rate.rate_value : 0;

    // Only handle hourly rate type
    if (rate.rate_type === "hourly") {
      amount = rate.rate_value * durationHours;
      formula = `€${rate.rate_value.toFixed(2)} x ${durationHours}`;
    }

    return {
      amount,
      hourlyRate,
      hours: durationHours,
      rateType: "hourly",
      formula,
      instructorId,
      productId: productId || undefined,
      productName: productName || undefined,
      categoryId,
      categoryName: categoryName || undefined,
      rateId: rate.id || undefined,
      isVisible: true,
      isCalculated: amount > 0,
    };
  } catch (error: any) {
    console.error("Error getting compensation breakdown:", error);
    return null;
  }
};

export const calculateCompensation = async (
  instructorId: string,
  startDate: string,
  endDate: string,
  schoolId?: string,
): Promise<InstructorCompensationSummary> => {
  try {
    const { data: instructor, error: instructorError } = await (supabaseAdmin as any)
      .from("users")
      .select("first_name, last_name")
      .eq("id", instructorId)
      .single();

    if (instructorError || !instructor) {
      throw new NotFoundError("Instructor not found");
    }

    const instructorName = `${instructor.first_name || ""} ${instructor.last_name || ""}`.trim() || "Unknown";

    let lessonsQuery = (supabaseAdmin as any)
      .from("lessons")
      .select(`
        id,
        date,
        time,
        duration,
        lesson_status_id,
        compensation_paid,
        lesson_statuses(name),
        product_id,
        products!inner(
          id,
          title,
          category_id,
          product_categories!inner(
            id,
            name
          )
        ),
        school_id
      `)
      .eq("instructor_id", instructorId)
      .gte("date", startDate)
      .lte("date", endDate)
      .not("product_id", "is", null);

    // Filter by school_id if provided and not ALL_SCHOOLS_ID
    if (schoolId && schoolId !== ALL_SCHOOLS_ID) {
      lessonsQuery = lessonsQuery.eq("school_id", schoolId);
    }

    const { data: lessons, error: lessonsError } = await lessonsQuery;

    if (lessonsError) {
      throw new AppError(`Failed to fetch lessons: ${lessonsError.message}`, 500);
    }

    const { data: confirmedStatus, error: statusError } = await (supabaseAdmin as any)
      .from("lesson_statuses")
      .select("id")
      .eq("name", "confirmed")
      .single();

    if (statusError) {
      throw new AppError(`Failed to fetch lesson status: ${statusError.message}`, 500);
    }

    const confirmedLessons = (lessons || []).filter(
      (l: any) => l.lesson_status_id === confirmedStatus.id && l.products?.category_id,
    );

    let ratesQuery = (supabaseAdmin as any)
      .from("instructor_rates")
      .select("category_id, school_id, rate_type, rate_value")
      .eq("instructor_id", instructorId)
      .eq("is_active", true)
      .not("category_id", "is", null);

    if (schoolId && schoolId !== ALL_SCHOOLS_ID) {
      ratesQuery = ratesQuery.eq("school_id", schoolId);
    }

    const { data: rates, error: ratesError } = await ratesQuery;

    if (ratesError) {
      throw new AppError(`Failed to fetch instructor rates: ${ratesError.message}`, 500);
    }

    const ratesMap = new Map<string, { rate_type: string; rate_value: number }>();
    (rates || []).forEach((rate: any) => {
      const key = `${rate.category_id}_${rate.school_id}`;
      ratesMap.set(key, {
        rate_type: rate.rate_type,
        rate_value: rate.rate_value,
      });
    });

    const lessonIds = confirmedLessons.map((l: any) => l.id);
    const studentNamesMap = new Map<string, string>();

    if (lessonIds.length > 0) {
      const { data: participants, error: participantsError } = await (supabaseAdmin as any)
        .from("lesson_participants")
        .select(`
          lesson_id,
          student_id,
          students:student_id(first_name, last_name)
        `)
        .in("lesson_id", lessonIds);

      if (!participantsError && participants) {
        participants.forEach((p: any) => {
          const student = p.students;
          if (student) {
            const name = `${student.first_name || ""} ${student.last_name || ""}`.trim();
            if (name) {
              studentNamesMap.set(p.lesson_id, name);
            }
          }
        });
      }
    }

    const lessonDetails: LessonCompensationDetail[] = [];
    let totalCompensation = 0;
    let totalHours = 0;
    let paidCompensation = 0;
    let unpaidCompensation = 0;
    let paidLessonCount = 0;
    let unpaidLessonCount = 0;

    for (const lesson of confirmedLessons) {
      const categoryId = lesson.products?.category_id;
      if (!categoryId) continue;

      const rate = ratesMap.get(`${categoryId}_${lesson.school_id}`);
      if (!rate) continue;

      const durationHours = lesson.duration / 60;

      let compensation = 0;
      // Only handle hourly rate type
      if (rate.rate_type === "hourly") {
        compensation = rate.rate_value * durationHours;
      }

      if (compensation > 0) {
        totalCompensation += compensation;
        totalHours += durationHours;

        // Handle compensation_paid safely - treat null/undefined as false
        const isPaid = Boolean(lesson.compensation_paid);
        if (isPaid) {
          paidCompensation += compensation;
          paidLessonCount++;
        } else {
          unpaidCompensation += compensation;
          unpaidLessonCount++;
        }

        const studentName = studentNamesMap.get(lesson.id);
        const lessonDetail: LessonCompensationDetail = {
          lessonId: lesson.id,
          date: lesson.date,
          time: lesson.time,
          duration: durationHours,
          categoryId: categoryId,
          compensationPaid: isPaid,
          ...(lesson.products?.product_categories?.name && { categoryName: lesson.products.product_categories.name }),
          ...(lesson.products?.title && { productName: lesson.products.title }),
          ...(studentName && { studentName }),
          hourlyRate: rate.rate_type === "hourly" ? rate.rate_value : 0,
          compensation,
        };
        lessonDetails.push(lessonDetail);
      }
    }

    return {
      instructorId,
      instructorName,
      totalCompensation,
      totalHours,
      lessonCount: lessonDetails.length,
      lessons: lessonDetails,
      paidCompensation,
      unpaidCompensation,
      paidLessonCount,
      unpaidLessonCount,
    };
  } catch (error: any) {
    if (error instanceof AppError || error instanceof NotFoundError) {
      throw error;
    }
    throw new AppError(`Failed to calculate compensation: ${error.message}`, 500);
  }
};

export const getCompensationReport = async (
  schoolId: string | undefined,
  startDate: string,
  endDate: string,
): Promise<CompensationReport> => {
  try {
    let instructorsQuery = (supabaseAdmin as any)
      .from("users")
      .select("id")
      .eq("role", "INSTRUCTOR");

    if (schoolId && schoolId !== ALL_SCHOOLS_ID) {
      instructorsQuery = instructorsQuery.eq("school_id", schoolId);
    }
    const { data: instructors, error: instructorsError } = await instructorsQuery;

    let schoolsQuery = (supabaseAdmin as any)
      .from("instructor_schools")
      .select("instructor_id")
      .eq("is_active", true);

    if (schoolId && schoolId !== ALL_SCHOOLS_ID) {
      schoolsQuery = schoolsQuery.eq("school_id", schoolId);
    }
    const { data: instructorSchools, error: schoolsError } = await schoolsQuery;

    const instructorIds = new Set<string>();
    (instructors || []).forEach((i: any) => instructorIds.add(i.id));
    (instructorSchools || []).forEach((is: any) => instructorIds.add(is.instructor_id));

    if (instructorsError || schoolsError) {
      throw new AppError(`Failed to fetch instructors: ${instructorsError?.message || schoolsError?.message}`, 500);
    }

    if (instructorIds.size === 0) {
      return {
        instructorSummaries: [],
        stats: {
          totalCompensation: 0,
          activeInstructors: 0,
          totalLessons: 0,
          totalHours: 0,
          averagePerLesson: 0,
          averagePerHour: 0,
          paidCompensation: 0,
          unpaidCompensation: 0,
          paidLessonCount: 0,
          unpaidLessonCount: 0,
        },
      };
    }

    const summaries: InstructorCompensationSummary[] = [];
    for (const instructorId of instructorIds) {
      try {
        const summary = await calculateCompensation(instructorId, startDate, endDate, schoolId);
        if (summary.lessonCount > 0) {
          summaries.push(summary);
        }
      } catch (error: any) {
        console.error(`Error calculating compensation for instructor ${instructorId}:`, error);
      }
    }

    summaries.sort((a, b) => b.totalCompensation - a.totalCompensation);

    const totalCompensation = summaries.reduce((sum, s) => sum + s.totalCompensation, 0);
    const totalLessons = summaries.reduce((sum, s) => sum + s.lessonCount, 0);
    const totalHours = summaries.reduce((sum, s) => sum + s.totalHours, 0);
    const paidCompensation = summaries.reduce((sum, s) => sum + s.paidCompensation, 0);
    const unpaidCompensation = summaries.reduce((sum, s) => sum + s.unpaidCompensation, 0);
    const paidLessonCount = summaries.reduce((sum, s) => sum + s.paidLessonCount, 0);
    const unpaidLessonCount = summaries.reduce((sum, s) => sum + s.unpaidLessonCount, 0);

    return {
      instructorSummaries: summaries,
      stats: {
        totalCompensation,
        activeInstructors: summaries.length,
        totalLessons,
        totalHours,
        averagePerLesson: totalLessons > 0 ? totalCompensation / totalLessons : 0,
        averagePerHour: totalHours > 0 ? totalCompensation / totalHours : 0,
        paidCompensation,
        unpaidCompensation,
        paidLessonCount,
        unpaidLessonCount,
      },
    };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Failed to get compensation report: ${error.message}`, 500);
  }
};

export const getInstructorMissingRatesCount = async (
  instructorId: string,
  schoolId: string,
): Promise<number> => {
  try {
    const { data: categories, error: categoriesError } = await (supabaseAdmin as any)
      .from("product_categories")
      .select("id")
      .eq("school_id", schoolId)
      .eq("is_active", true);

    if (categoriesError) {
      throw new AppError(`Failed to fetch product categories: ${categoriesError.message}`, 500);
    }

    if (!categories || categories.length === 0) {
      return 0;
    }

    const categoryIds = categories.map((c: any) => c.id);

    let rates: any[] = [];
    try {
      const { data: ratesData, error: ratesError } = await (supabaseAdmin as any)
        .from("instructor_rates")
        .select("category_id")
        .eq("instructor_id", instructorId)
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .not("category_id", "is", null)
        .in("category_id", categoryIds);

      if (ratesError) {
        if (ratesError.message?.includes("does not exist") || ratesError.message?.includes("category_id")) {
          return categories.length;
        }
        throw new AppError(`Failed to fetch instructor rates: ${ratesError.message}`, 500);
      }
      rates = ratesData || [];
    } catch (err: any) {
      if (err.message?.includes("does not exist") || err.message?.includes("category_id")) {
        return categories.length;
      }
      throw err;
    }

    const ratedCategoryIds = new Set((rates || []).map((r: any) => r.category_id));
    const missingCount = categoryIds.filter((id: string) => !ratedCategoryIds.has(id)).length;

    return missingCount;
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Failed to get missing rates count: ${error.message}`, 500);
  }
};

/**
 * Mark a single lesson's compensation as paid/unpaid
 */
export const markLessonCompensationPaid = async (
  lessonId: string,
  paid: boolean,
  _userId: string,
  userRole: string,
  userSchoolId?: string,
): Promise<void> => {
  try {
    // Validate inputs
    if (!lessonId || typeof lessonId !== 'string') {
      throw new AppError("Invalid lesson ID", 400);
    }

    if (typeof paid !== 'boolean') {
      throw new AppError("Invalid paid status", 400);
    }

    // Fetch lesson to verify access
    const { data: lesson, error: lessonError } = await (supabaseAdmin as any)
      .from("lessons")
      .select("id, school_id, instructor_id, compensation_paid")
      .eq("id", lessonId)
      .single();

    if (lessonError || !lesson) {
      throw new NotFoundError("Lesson not found");
    }

    // Verify school access for SCHOOL_ADMIN
    if (userRole === "SCHOOL_ADMIN" && lesson.school_id !== userSchoolId) {
      throw new AppError("You can only update lessons in your school", 403);
    }

    // Check if already in desired state (optimization)
    if (lesson.compensation_paid === paid) {
      logger.info('Lesson compensation status unchanged', {
        lessonId,
        paid,
        userId: _userId,
        userRole,
        schoolId: userSchoolId,
      });
      return; // No update needed
    }

    // Update compensation_paid status
    const { error: updateError } = await (supabaseAdmin as any)
      .from("lessons")
      .update({ 
        compensation_paid: paid,
        updated_at: new Date().toISOString()
      })
      .eq("id", lessonId);

    if (updateError) {
      logger.error("Failed to update compensation status", { 
        error: updateError.message, 
        lessonId,
        userId: _userId,
        userRole,
        schoolId: userSchoolId,
      });
      throw new AppError(`Failed to update compensation status: ${updateError.message}`, 500);
    }

    // Audit log for successful update
    logger.info('Marked lesson compensation as paid/unpaid', {
      lessonId,
      paid,
      userId: _userId,
      userRole,
      schoolId: userSchoolId,
    });
  } catch (error: any) {
    if (error instanceof AppError || error instanceof NotFoundError) {
      throw error;
    }
    logger.error("Error in markLessonCompensationPaid", { 
      error: error.message, 
      lessonId,
      userId: _userId,
      userRole,
      schoolId: userSchoolId,
    });
    throw new AppError(`Failed to mark lesson compensation as paid: ${error.message}`, 500);
  }
};

/**
 * Bulk mark lessons' compensation as paid
 */
export const bulkMarkLessonsCompensationPaid = async (
  lessonIds: string[],
  _userId: string,
  userRole: string,
  userSchoolId?: string,
): Promise<number> => {
  try {
    // Validate inputs
    if (!Array.isArray(lessonIds)) {
      throw new AppError("lessonIds must be an array", 400);
    }

    if (lessonIds.length === 0) {
      throw new AppError("lessonIds cannot be empty", 400);
    }

    // Limit bulk operations to prevent abuse
    const MAX_BULK_LESSONS = 500;
    if (lessonIds.length > MAX_BULK_LESSONS) {
      throw new AppError(`Cannot mark more than ${MAX_BULK_LESSONS} lessons at once`, 400);
    }

    // Validate all IDs are valid UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const invalidIds = lessonIds.filter(id => !uuidRegex.test(id));
    if (invalidIds.length > 0) {
      throw new AppError("Invalid lesson ID format", 400);
    }

    // For SCHOOL_ADMIN, verify all lessons belong to their school
    if (userRole === "SCHOOL_ADMIN" && userSchoolId) {
      const { data: lessons, error: verifyError } = await (supabaseAdmin as any)
        .from("lessons")
        .select("id, school_id")
        .in("id", lessonIds);

      if (verifyError) {
        throw new AppError(`Failed to verify lessons: ${verifyError.message}`, 500);
      }

      const invalidLessons = (lessons || []).filter((l: any) => l.school_id !== userSchoolId);
      if (invalidLessons.length > 0) {
        throw new AppError("You can only update lessons in your school", 403);
      }
    }

    // Build query with school filter if needed
    let query = (supabaseAdmin as any)
      .from("lessons")
      .update({ 
        compensation_paid: true,
        updated_at: new Date().toISOString()
      })
      .in("id", lessonIds)
      .eq("compensation_paid", false); // Only update unpaid lessons for efficiency

    if (userRole === "SCHOOL_ADMIN" && userSchoolId) {
      query = query.eq("school_id", userSchoolId);
    }

    const { data, error } = await query.select("id");

    if (error) {
      logger.error('Failed to bulk update compensation status', { 
        error: error.message,
        userId: _userId,
        userRole,
        schoolId: userSchoolId,
        lessonCount: lessonIds.length,
      });
      throw new AppError(`Failed to bulk update compensation status: ${error.message}`, 500);
    }

    const updateCount = data?.length || 0;
    logger.info('Successfully marked lessons as paid', {
      updateCount,
      requestedCount: lessonIds.length,
      lessonIds: lessonIds.slice(0, 50),
      userId: _userId,
      userRole,
      schoolId: userSchoolId,
    });
    
    return updateCount;
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Error in bulkMarkLessonsCompensationPaid', { 
      error: error.message,
      userId: _userId,
      userRole,
      schoolId: userSchoolId,
      lessonCount: lessonIds.length,
    });
    throw new AppError(`Failed to bulk mark lessons as paid: ${error.message}`, 500);
  }
};

