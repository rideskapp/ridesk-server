import { supabaseAdmin } from "../database/supabase";
import { AppError } from "../types";

export interface ReportingData {
  overview: {
    totalRevenue: number;
    bookingCount: number;
    studentCount: number;
    averageRevenuePerBooking: number;
  };
  breakdownByBookingType: Array<{
    type: string;
    revenue: number;
    count: number;
  }>;
  breakdownByDiscipline: Array<{
    discipline: string;
    revenue: number;
    count: number;
  }>;
  breakdownByInstructor: Array<{
    instructorId: string;
    instructorName: string;
    revenue: number;
    lessonCount: number;
  }>;
  paidVsPending: {
    paid: number;
    pending: number;
    overdue: number;
  };
}

/**
 * Maps product category slug to booking type
 */
const getBookingTypeFromCategory = (categorySlug: string | null | undefined): string => {
  if (!categorySlug) return "Packages";
  
  const slug = categorySlug.toLowerCase();
  if (slug.includes("private")) return "Private";
  if (slug.includes("group")) return "Group";
  return "Packages";
};

type BookingPaymentStatus = "paid" | "partially_paid" | "unpaid" | "pending" | "overdue";

/**
 * Get reporting data for a school in a date range
 */
export const getReportingData = async (
  schoolId: string,
  startDate: string,
  endDate: string,
): Promise<ReportingData> => {
  try {
    // Fetch bookings in date range with products and participants
    const { data: bookings, error: bookingsError } = await (supabaseAdmin as any)
      .from("bookings")
      .select(
        `
        id,
        created_at,
        product_id,
        final_price,
        outstanding_amount,
        payment_status,
        products:product_id(
          id,
          price,
          category_id,
          discipline_id
        ),
        participants:booking_participants(
          student_id
        )
        `
      )
      .eq("school_id", schoolId)
      .gte("created_at", `${startDate}T00:00:00.000Z`)
      .lte("created_at", `${endDate}T23:59:59.999Z`);

    if (bookingsError) {
      throw new AppError(`Failed to fetch bookings: ${bookingsError.message}`, 500);
    }

    const bookingsList = bookings || [];

    // Get unique category and discipline IDs
    const categoryIds = [...new Set(bookingsList.map((b: any) => b.products?.category_id).filter(Boolean))];
    const disciplineIds = [...new Set(bookingsList.map((b: any) => b.products?.discipline_id).filter(Boolean))];

    // Fetch categories
    const categoryMap = new Map<string, string>();
    if (categoryIds.length > 0) {
      const { data: categories, error: categoriesError } = await (supabaseAdmin as any)
        .from("product_categories")
        .select("id, slug")
        .in("id", categoryIds);

      if (categoriesError) {
        console.warn(`Failed to fetch categories: ${categoriesError.message}`, { categoryIds });
      } else if (categories) {
        categories.forEach((cat: any) => {
          categoryMap.set(cat.id, cat.slug);
        });
      }
    }

    // Fetch disciplines
    const disciplineMap = new Map<string, string>();
    if (disciplineIds.length > 0) {
      const { data: disciplines, error: disciplinesError } = await (supabaseAdmin as any)
        .from("disciplines")
        .select("id, slug")
        .in("id", disciplineIds);

      if (disciplinesError) {
        console.warn(`Failed to fetch disciplines: ${disciplinesError.message}`, { disciplineIds });
      } else if (disciplines) {
        disciplines.forEach((dis: any) => {
          disciplineMap.set(dis.id, dis.slug);
        });
      }
    }

    // Calculate overview metrics
    let totalRevenue = 0;
    const uniqueStudents = new Set<string>();
    const bookingIds = bookingsList.map((b: any) => b.id);

    bookingsList.forEach((booking: any) => {
      const price = Number(booking.final_price ?? booking.products?.price ?? 0);
      totalRevenue += price;
      
      if (booking.participants) {
        booking.participants.forEach((p: any) => {
          if (p.student_id) {
            uniqueStudents.add(p.student_id);
          }
        });
      }
    });

    const bookingCount = bookingsList.length;
    const studentCount = uniqueStudents.size;
    const averageRevenuePerBooking = bookingCount > 0 
      ? Math.round((totalRevenue / bookingCount) * 100) / 100 
      : 0;

    // Calculate breakdown by booking type
    const bookingTypeRevenueMap = new Map<string, { revenue: number; count: number }>();
    
    bookingsList.forEach((booking: any) => {
      const categoryId = booking.products?.category_id;
      const categorySlug = categoryId ? categoryMap.get(categoryId) : null;
      const type = getBookingTypeFromCategory(categorySlug);
      const price = Number(booking.final_price ?? booking.products?.price ?? 0);

      const existing = bookingTypeRevenueMap.get(type) || { revenue: 0, count: 0 };
      bookingTypeRevenueMap.set(type, {
        revenue: existing.revenue + price,
        count: existing.count + 1,
      });
    });

    const breakdownByBookingType = Array.from(bookingTypeRevenueMap.entries()).map(([type, data]) => ({
      type,
      revenue: Math.round(data.revenue * 100) / 100,
      count: data.count,
    }));

    // Calculate breakdown by discipline
    const disciplineRevenueMap = new Map<string, { revenue: number; count: number }>();
    
    bookingsList.forEach((booking: any) => {
      const disciplineId = booking.products?.discipline_id;
      const disciplineSlug = disciplineId ? disciplineMap.get(disciplineId) : null;
      if (disciplineSlug) {
        const price = Number(booking.final_price ?? booking.products?.price ?? 0);
        const existing = disciplineRevenueMap.get(disciplineSlug) || { revenue: 0, count: 0 };
        disciplineRevenueMap.set(disciplineSlug, {
          revenue: existing.revenue + price,
          count: existing.count + 1,
        });
      }
    });

    const breakdownByDiscipline = Array.from(disciplineRevenueMap.entries()).map(([discipline, data]) => ({
      discipline,
      revenue: Math.round(data.revenue * 100) / 100,
      count: data.count,
    }));

    // Fetch all lessons linked to bookings for instructor breakdown only
    const { data: lessons, error: lessonsError } = await (supabaseAdmin as any)
      .from("lessons")
      .select(
        `
        id,
        booking_id,
        instructor_id,
        instructor:users!lessons_instructor_id_fkey(first_name,last_name)
        `,
      )
      .in("booking_id", bookingIds.length > 0 ? bookingIds : ["00000000-0000-0000-0000-000000000000"]);
    if (lessonsError) {
      throw new AppError(`Failed to fetch lessons: ${lessonsError.message}`, 500);
    }
    const lessonsByBooking = new Map<string, any[]>();
    (lessons || []).forEach((lesson: any) => {
      const current = lessonsByBooking.get(lesson.booking_id) || [];
      current.push(lesson);
      lessonsByBooking.set(lesson.booking_id, current);
    });

    // Calculate breakdown by instructor using booking prices
    // Allocate booking price proportionally to instructors based on their lesson count
    const instructorMap = new Map<string, { name: string; revenue: number; lessonCount: number }>();
    
    bookingsList.forEach((booking: any) => {
      const bookingPrice = Number(booking.final_price ?? booking.products?.price ?? 0);
      const bookingId = booking.id;
      const lessonsForBooking = lessonsByBooking.get(bookingId) || [];
      
      if (lessonsForBooking.length === 0) return;
      
      // Count lessons per instructor for this booking
      const instructorLessonCounts = new Map<string, number>();
      const instructorNames = new Map<string, string>();
      
      lessonsForBooking.forEach((lesson: any) => {
        if (lesson.instructor_id) {
          const instructorId = lesson.instructor_id;
          const instructorName = lesson.instructor
            ? `${lesson.instructor.first_name || ""} ${lesson.instructor.last_name || ""}`.trim() || "Unknown"
            : "Unknown";
          
          instructorNames.set(instructorId, instructorName);
          instructorLessonCounts.set(
            instructorId,
            (instructorLessonCounts.get(instructorId) || 0) + 1
          );
        }
      });
      
      // Allocate booking price proportionally to each instructor
      // Only count instructor-assigned lessons to ensure full allocation
      const totalInstructorLessons = Array.from(instructorLessonCounts.values()).reduce((sum, count) => sum + count, 0);
      if (totalInstructorLessons === 0) return; // No instructor-assigned lessons, skip this booking
      
      instructorLessonCounts.forEach((lessonCount, instructorId) => {
        const instructorName = instructorNames.get(instructorId) || "Unknown";
        const proportion = lessonCount / totalInstructorLessons;
        const allocatedRevenue = bookingPrice * proportion;
        
        const existing = instructorMap.get(instructorId) || {
          name: instructorName,
          revenue: 0,
          lessonCount: 0,
        };
        
        instructorMap.set(instructorId, {
          name: instructorName,
          revenue: existing.revenue + allocatedRevenue,
          lessonCount: existing.lessonCount + lessonCount,
        });
      });
    });

    const breakdownByInstructor = Array.from(instructorMap.entries()).map(([instructorId, data]) => ({
      instructorId,
      instructorName: data.name,
      revenue: Math.round(data.revenue * 100) / 100,
      lessonCount: data.lessonCount,
    }));

    // Calculate paid vs pending vs overdue using booking-level financial status
    let paidRevenue = 0;
    let pendingRevenue = 0;
    let overdueRevenue = 0;

    bookingsList.forEach((booking: any) => {
      const bookingPrice = Number(booking.final_price ?? booking.products?.price ?? 0);
      const status = String(
        (booking.payment_status || "unpaid") as BookingPaymentStatus,
      ).toLowerCase();
      switch (status) {
        case "paid":
          paidRevenue += bookingPrice;
          break;
        case "pending":
        case "unpaid":
        case "partially_paid":
          pendingRevenue += bookingPrice;
          break;
        case "overdue":
          overdueRevenue += bookingPrice;
          break;
        default:
          pendingRevenue += bookingPrice;
      }
    });

    return {
      overview: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        bookingCount,
        studentCount,
        averageRevenuePerBooking,
      },
      breakdownByBookingType,
      breakdownByDiscipline,
      breakdownByInstructor,
      paidVsPending: {
        paid: Math.round(paidRevenue * 100) / 100,
        pending: Math.round(pendingRevenue * 100) / 100,
        overdue: Math.round(overdueRevenue * 100) / 100,
      },
    };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Failed to get reporting data: ${error.message}`, 500);
  }
};

