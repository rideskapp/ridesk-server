/**
 * @fileoverview Lessons service: conflict detection and rescheduling
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../database/supabase";
import { Database } from "../database/types";
import { AppError, ALL_SCHOOLS_ID } from "../types";
import { checkInstructorAvailabilitySlot } from "./availability";
import { isSchoolDateAvailable } from "./schoolCalendar";

export interface LessonRecord {
  id: string;
  school_id: string;
  instructor_id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  duration: number; // hours
}

export interface LessonListItem extends LessonRecord {
  product_id: string | null;
  product_name: string | null;
  product_category_id: string | null;
  discipline: string | null;
  lesson_status_id: string | null;
  lesson_status_name: string | null;
  payment_status_id: string | null;
  payment_status_name: string | null;
  instructor_first_name: string | null;
  instructor_last_name: string | null;
  instructor_avatar: string | null;
  student_first_name: string | null;
  student_last_name: string | null;
  student_avatar: string | null;
  school_name?: string | null;
  school_logo?: string | null;
  booking_id?: string | null;
  student_count?: number; // Total number of participants; only first student's data is returned above
  has_multiple_students?: boolean; // True if lesson has more than one participant
}

interface StudentEnrichmentResult {
  studentDataMap: Map<
    string,
    Array<{
      first_name: string | null;
      last_name: string | null;
      avatar: string | null;
    }>
  >;
}

/**
 * Raw lesson data structure as returned from database queries with joins
 * Represents the actual shape of data from Supabase queries selecting * from lessons
 * plus joined instructor and status relations
 */
interface RawLessonData {
  id: string;
  school_id: string;
  instructor_id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  duration: number; // hours
  discipline: string | null;
  level: string;
  payment_status: string;
  status: string;
  source: string;
  product_id: string | null;
  lesson_status_id: string | null;
  payment_status_id: string | null;
  student_id?: string | null;
  booking_id?: string | null;
  product_name?: string | null; // May come from joins
  notes?: string | null;
  price?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  instructor?: {
    first_name: string | null;
    last_name: string | null;
    avatar: string | null;
  } | null;
  lesson_statuses?: {
    name: string | null;
  } | null;
  payment_statuses?: {
    name: string | null;
  } | null;
  school?: {
    name: string | null;
    logo: string | null;
  } | null;
}

/**
 * Helper function to map a lesson with enriched data (product, student, instructor)
 * @param lesson - Raw lesson object from database
 * @param productMap - Map of product_id to product data
 * @param bookingProductMap - Map of booking_id to product_id
 * @param studentDataMap - Map of lesson_id to array of student data
 * @returns Enriched LessonListItem with all resolved fields
 */
const mapLessonWithEnrichment = (
  lesson: RawLessonData,
  productMap: Map<
    string,
    { category_id: string | null; name: string | null; title?: string | null }
  >,
  bookingProductMap: Map<string, string>,
  studentDataMap: Map<
    string,
    Array<{
      first_name: string | null;
      last_name: string | null;
      avatar: string | null;
    }>
  >,
): LessonListItem => {
  // Product resolution: booking_id -> bookingProductMap -> productMap, fallback to product_id
  let product = null;
  let resolvedProductId: string | null = null;

  if (lesson.booking_id) {
    const bookingProductId = bookingProductMap.get(lesson.booking_id);
    if (bookingProductId) {
      product = productMap.get(bookingProductId);
      if (product) {
        resolvedProductId = bookingProductId;
      }
    }
  }

  if (!product && lesson.product_id) {
    product = productMap.get(lesson.product_id);
    if (product) {
      resolvedProductId = lesson.product_id;
    }
  }

  const categoryId = product?.category_id || null;
  if (lesson.booking_id && !categoryId) {
    console.warn(
      `Warning: No category_id found for lesson ${lesson.id} from booking ${lesson.booking_id}`,
    );
  }

  const studentDataArray = studentDataMap.get(lesson.id);
  const studentData =
    studentDataArray && studentDataArray.length > 0
      ? studentDataArray[0]
      : null;
  const studentCount = studentDataArray?.length || 0;
  const hasMultipleStudents = studentCount > 1;

  let instructor = lesson.instructor;
  if (Array.isArray(instructor)) {
    console.warn("Unexpected array for lesson.instructor", {
      lessonId: lesson.id,
      instructor,
    });
    instructor =
      (
        instructor as Array<{
          first_name: string | null;
          last_name: string | null;
          avatar: string | null;
        }>
      )[0] ?? null;
  } else if (instructor && typeof instructor !== "object") {
    console.warn("Unexpected non-object type for lesson.instructor", {
      lessonId: lesson.id,
      instructorType: typeof instructor,
    });
    instructor = null;
  }

  const instructorAvatar = instructor?.avatar || null;

  let school = lesson.school;
  if (Array.isArray(school)) {
    school = school[0] ?? null;
  }

  const result: LessonListItem = {
    // Fields from LessonRecord
    id: lesson.id,
    school_id: lesson.school_id,
    instructor_id: lesson.instructor_id,
    date: lesson.date,
    time: lesson.time,
    duration: lesson.duration,
    product_id: resolvedProductId || lesson.product_id || null,
    discipline: lesson.discipline || null,
    lesson_status_id: lesson.lesson_status_id || null,
    payment_status_id: lesson.payment_status_id || null,
    product_category_id: categoryId,
    product_name: product?.title || product?.name || null,
    lesson_status_name: lesson.lesson_statuses?.name || null,
    payment_status_name: lesson.payment_statuses?.name || null,
    instructor_first_name: instructor?.first_name || null,
    instructor_last_name: instructor?.last_name || null,
    instructor_avatar: instructorAvatar,
    student_first_name: studentData?.first_name || null,
    student_last_name: studentData?.last_name || null,
    student_avatar: studentData?.avatar || null,
    school_name: school?.name || null,
    school_logo: school?.logo || null,
    booking_id: lesson.booking_id ?? null,
  };

  // Conditionally include optional fields (only when they have values)
  if (studentCount > 0) {
    result.student_count = studentCount;
  }
  if (hasMultipleStudents) {
    result.has_multiple_students = true;
  }

  return result;
};

/**
 * Helper function to enrich lessons with student data from participants
 * Fetches student data from lesson_participants, booking_participants, and users tables in parallel
 * @param lessons - Array of lesson objects to enrich (minimal interface with id, booking_id, student_id)
 * @param supabaseAdmin - Supabase admin client
 * @returns StudentEnrichmentResult containing studentDataMap keyed by lesson ID
 */
const enrichLessonsWithStudentData = async (
  lessons: Pick<RawLessonData, "id" | "booking_id" | "student_id">[],
  supabaseAdmin: SupabaseClient<Database>,
): Promise<StudentEnrichmentResult> => {
  const lessonIds = lessons?.map((l) => l.id) || [];
  const studentDataMap = new Map<
    string,
    Array<{
      first_name: string | null;
      last_name: string | null;
      avatar: string | null;
    }>
  >();

  // Prepare parallel queries for independent data fetches
  const lessonsWithBookings = lessons?.filter((l) => l.booking_id) || [];
  const bookingIdsForParticipants = [
    ...new Set(lessonsWithBookings.map((l) => l.booking_id)),
  ];

  const candidateStudentIdsFromLessons = [
    ...new Set(lessons?.map((l) => l.student_id).filter(Boolean) || []),
  ];

  const queryPromises: Promise<any>[] = [];

  // 1. Lesson participants query (with nested user data)
  if (lessonIds.length > 0) {
    queryPromises.push(
      Promise.resolve(
        supabaseAdmin
          .from("lesson_participants")
          .select(
            `
            lesson_id,
            student_id,
            users:users!lesson_participants_student_id_fkey(first_name, last_name, avatar)
          `,
          )
          .in("lesson_id", lessonIds),
      )
        .then((result: any) => ({ type: "lessonParticipants", ...result }))
        .catch((error: any) => ({ type: "lessonParticipants", error })),
    );
  }

  // 2. Booking participants query
  if (bookingIdsForParticipants.length > 0) {
    queryPromises.push(
      (supabaseAdmin as any)
        .from("booking_participants")
        .select("id, booking_id, student_id")
        .in("booking_id", bookingIdsForParticipants)
        .then((result: any) => ({ type: "bookingParticipants", ...result }))
        .catch((error: any) => ({ type: "bookingParticipants", error })),
    );
  }

  const queryResults = await Promise.all(queryPromises);

  const allCandidateStudentIds = new Set<string>(
    candidateStudentIdsFromLessons.filter((id): id is string => Boolean(id)),
  );

  const lessonParticipantsResult = queryResults.find(
    (r: any) => r.type === "lessonParticipants",
  );
  if (
    lessonParticipantsResult &&
    !lessonParticipantsResult.error &&
    lessonParticipantsResult.data
  ) {
    lessonParticipantsResult.data.forEach((lp: any) => {
      if (lp.student_id) {
        allCandidateStudentIds.add(lp.student_id);
      }
    });
  }

  const bookingParticipantsResult = queryResults.find(
    (r: any) => r.type === "bookingParticipants",
  );
  if (
    bookingParticipantsResult &&
    !bookingParticipantsResult.error &&
    bookingParticipantsResult.data
  ) {
    bookingParticipantsResult.data.forEach((bp: any) => {
      if (bp.student_id) {
        allCandidateStudentIds.add(bp.student_id);
      }
    });
  }

  // 3. Student users query - fetch all student user data for all collected student IDs
  const studentUserMap = new Map<
    string,
    {
      first_name: string | null;
      last_name: string | null;
      avatar: string | null;
    }
  >();
  if (allCandidateStudentIds.size > 0) {
    const candidateIdsArray = Array.from(allCandidateStudentIds);
    try {
      const { data: studentUsers, error: studentUsersError } =
        await supabaseAdmin
          .from("users")
          .select("id, first_name, last_name, avatar")
          .in("id", candidateIdsArray);

      if (studentUsersError) {
        console.error(
          `Error fetching student users:`,
          studentUsersError.message || studentUsersError,
        );
      } else if (studentUsers) {
        studentUsers.forEach((user: any) => {
          studentUserMap.set(user.id, {
            first_name: user.first_name || null,
            last_name: user.last_name || null,
            avatar: user.avatar || null,
          });
        });
      }
    } catch (error: any) {
      console.error(`Error fetching student users:`, error?.message || error);
    }
  }

  const seenStudentIds = new Map<string, Set<string>>();
  if (
    lessonParticipantsResult &&
    !lessonParticipantsResult.error &&
    lessonParticipantsResult.data
  ) {
    lessonParticipantsResult.data.forEach((lp: any) => {
      if (lp.lesson_id && lp.users) {
        // Initialize both the array in studentDataMap and Set in seenStudentIds if lesson.id is missing
        if (!studentDataMap.has(lp.lesson_id)) {
          studentDataMap.set(lp.lesson_id, []);
        }
        if (!seenStudentIds.has(lp.lesson_id)) {
          seenStudentIds.set(lp.lesson_id, new Set<string>());
        }

        const lessonSeenIds = seenStudentIds.get(lp.lesson_id)!;
        if (lp.student_id && lessonSeenIds.has(lp.student_id)) {
          return;
        }

        // Type guard for lp.users (handle array/object edge cases from Supabase nested joins)
        let userData = lp.users;
        if (Array.isArray(userData)) {
          userData = userData[0] ?? null;
        } else if (userData && typeof userData !== "object") {
          userData = null;
        }
        if (!userData) {
          return;
        }

        const studentData = {
          first_name: userData.first_name || null,
          last_name: userData.last_name || null,
          avatar: userData.avatar || null,
        };

        // Add student ID to the Set and push studentData to the array
        if (lp.student_id) {
          lessonSeenIds.add(lp.student_id);
        }
        studentDataMap.get(lp.lesson_id)!.push(studentData);
      } else if (lp.lesson_id && lp.student_id && !lp.users) {
        // Nested join failed or student data missing, try to use data from parallel studentUsers query
        const userData = studentUserMap.get(lp.student_id);
        if (userData) {
          if (!studentDataMap.has(lp.lesson_id)) {
            studentDataMap.set(lp.lesson_id, []);
          }
          if (!seenStudentIds.has(lp.lesson_id)) {
            seenStudentIds.set(lp.lesson_id, new Set<string>());
          }

          const lessonSeenIds = seenStudentIds.get(lp.lesson_id)!;
          if (!lessonSeenIds.has(lp.student_id)) {
            // Add student ID to the Set and push userData to the array
            lessonSeenIds.add(lp.student_id);
            studentDataMap.get(lp.lesson_id)!.push(userData);
          }
        } else {
          // Student ID not found in parallel query - log warning but don't fail
          console.warn(
            `Student ID ${lp.student_id} not found in parallel studentUsers query for lesson ${lp.lesson_id}`,
          );
        }
      }
    });
  } else if (lessonParticipantsResult?.error) {
    console.error(
      `Error fetching lesson_participants for lessonIds [${lessonIds.slice(0, 5).join(", ")}${lessonIds.length > 5 ? "..." : ""}]:`,
      lessonParticipantsResult.error?.message || lessonParticipantsResult.error,
    );
  }
  if (bookingParticipantsResult && bookingParticipantsResult.error) {
    console.error(
      `Error fetching booking_participants for bookingIdsForParticipants [${bookingIdsForParticipants.slice(0, 5).join(", ")}${bookingIdsForParticipants.length > 5 ? "..." : ""}]:`,
      bookingParticipantsResult.error?.message ||
        bookingParticipantsResult.error,
    );
  }

  if (
    bookingParticipantsResult &&
    !bookingParticipantsResult.error &&
    bookingParticipantsResult.data
  ) {
    const bookingParticipants = bookingParticipantsResult.data;

    // Create a map of booking_id to student_ids for efficient lookup
    const bookingToStudentIdsMap = new Map<string, string[]>();
    bookingParticipants.forEach((bp: any) => {
      if (bp.booking_id && bp.student_id) {
        const existing = bookingToStudentIdsMap.get(bp.booking_id) || [];
        if (!existing.includes(bp.student_id)) {
          existing.push(bp.student_id);
        }
        bookingToStudentIdsMap.set(bp.booking_id, existing);
      }
    });

    // Use the shared seenStudentIds map (declared earlier) for deduplication
    lessonsWithBookings.forEach((lesson: any) => {
      const studentIdsForBooking =
        bookingToStudentIdsMap.get(lesson.booking_id) || [];
      studentIdsForBooking.forEach((studentId: string) => {
        const userData = studentUserMap.get(studentId);
        if (userData) {
          // Initialize both the array in studentDataMap and Set in seenStudentIds if lesson.id is missing
          if (!studentDataMap.has(lesson.id)) {
            studentDataMap.set(lesson.id, []);
          }
          if (!seenStudentIds.has(lesson.id)) {
            seenStudentIds.set(lesson.id, new Set<string>());
          }

          // Check if student ID was already added to this lesson
          const lessonSeenIds = seenStudentIds.get(lesson.id)!;
          if (!lessonSeenIds.has(studentId)) {
            // Add student ID to the Set and push userData to the array
            lessonSeenIds.add(studentId);
            studentDataMap.get(lesson.id)!.push(userData);
          }
        } else {
          console.warn(
            `Student ID ${studentId} not found in parallel studentUsers query for booking ${lesson.booking_id} (lesson ${lesson.id})`,
          );
        }
      });
    });
  }

  // 4. Process students from lesson.student_id field (direct student reference on lessons table)
  // This ensures lessons with a student_id field are also counted, even if they're not in participants tables
  lessons.forEach((lesson) => {
    if (lesson.student_id) {
      const userData = studentUserMap.get(lesson.student_id);
      if (userData) {
        if (!studentDataMap.has(lesson.id)) {
          studentDataMap.set(lesson.id, []);
        }
        if (!seenStudentIds.has(lesson.id)) {
          seenStudentIds.set(lesson.id, new Set<string>());
        }

        const lessonSeenIds = seenStudentIds.get(lesson.id)!;
        if (!lessonSeenIds.has(lesson.student_id)) {
          lessonSeenIds.add(lesson.student_id);
          studentDataMap.get(lesson.id)!.push(userData);
        }
      } else {
        console.warn(
          `Student ID ${lesson.student_id} not found in parallel studentUsers query for lesson ${lesson.id}`,
        );
      }
    }
  });

  return { studentDataMap };
};

export const getLessonsByRange = async (
  schoolId: string,
  startDate: string,
  endDate: string,
  opts?: {
    instructorId?: string;
    discipline?: string;
    studentId?: string;
    limit?: number;
    offset?: number;
  },
): Promise<LessonListItem[]> => {
  let query = supabaseAdmin
    .from("lessons")
    .select(
      `
      *,
      instructor:users!lessons_instructor_id_fkey(first_name, last_name, avatar),
      lesson_statuses(name),
      payment_statuses(name)
    `,
    )
    .eq("school_id", schoolId)
    .gte("date", startDate)
    .lte("date", endDate);

  if (opts?.instructorId) {
    query = query.eq("instructor_id", opts.instructorId);
  }
  if (opts?.discipline) {
    query = query.eq("discipline", opts.discipline);
  }

  let filteredData: any[] = [];
  if (opts?.studentId) {
    // Execute both participant queries in parallel to get lesson IDs and booking IDs
    const [
      { data: lessonParticipants, error: participantsError },
      { data: bookingParticipants, error: bookingParticipantsError },
    ] = await Promise.all([
      (supabaseAdmin as any)
        .from("lesson_participants")
        .select("lesson_id")
        .eq("student_id", opts.studentId),
      (supabaseAdmin as any)
        .from("booking_participants")
        .select("booking_id")
        .eq("student_id", opts.studentId),
    ]);

    if (participantsError) {
      throw new AppError(
        `Failed to fetch lesson participants: ${participantsError.message}`,
        500,
      );
    }

    if (bookingParticipantsError) {
      throw new AppError(
        `Failed to fetch booking participants: ${bookingParticipantsError.message}`,
        500,
      );
    }

    const participantLessonIds = (lessonParticipants || []).map(
      (lp: any) => lp.lesson_id,
    );
    const bookingIds = (bookingParticipants || []).map(
      (bp: any) => bp.booking_id,
    );

    const lessonQueries: any[] = [];

    if (participantLessonIds.length > 0) {
      let participantQuery = supabaseAdmin
        .from("lessons")
        .select(
          `
          *,
          instructor:users!lessons_instructor_id_fkey(first_name, last_name, avatar),
          lesson_statuses(name),
          payment_statuses(name)
        `,
        )
        .eq("school_id", schoolId)
        .gte("date", startDate)
        .lte("date", endDate)
        .in("id", participantLessonIds);

      if (opts?.instructorId) {
        participantQuery = participantQuery.eq(
          "instructor_id",
          opts.instructorId,
        );
      }
      if (opts?.discipline) {
        participantQuery = participantQuery.eq("discipline", opts.discipline);
      }

      lessonQueries.push(participantQuery.then((result: any) => result));
    }

    if (bookingIds.length > 0) {
      let bookingQuery = supabaseAdmin
        .from("lessons")
        .select(
          `
          *,
          instructor:users!lessons_instructor_id_fkey(first_name, last_name, avatar),
          lesson_statuses(name),
          payment_statuses(name)
        `,
        )
        .eq("school_id", schoolId)
        .gte("date", startDate)
        .lte("date", endDate)
        .in("booking_id", bookingIds);

      if (opts?.instructorId) {
        bookingQuery = bookingQuery.eq("instructor_id", opts.instructorId);
      }
      if (opts?.discipline) {
        bookingQuery = bookingQuery.eq("discipline", opts.discipline);
      }

      lessonQueries.push(bookingQuery.then((result: any) => result));
    }

    if (lessonQueries.length === 0) {
      filteredData = [];
    } else {
      const results = await Promise.all(lessonQueries);

      for (const result of results) {
        if (result.error) {
          throw new AppError(
            `Failed to fetch lessons: ${result.error.message}`,
            500,
          );
        }
      }

      const allLessons = results.flatMap((result: any) => result.data || []);

      // Deduplicate by lesson ID (a lesson could match both conditions)
      const lessonMap = new Map<string, any>();
      allLessons.forEach((lesson: any) => {
        if (!lessonMap.has(lesson.id)) {
          lessonMap.set(lesson.id, lesson);
        }
      });

      filteredData = Array.from(lessonMap.values());

      const limit = opts?.limit || 500;
      const offset = opts?.offset || 0;
      filteredData = filteredData.slice(offset, offset + limit);
    }
  } else {
    const { data, error } = await query
      .limit(opts?.limit || 500)
      .range(opts?.offset || 0, (opts?.offset || 0) + (opts?.limit || 500) - 1);
    if (error) {
      throw new AppError(`Failed to fetch lessons: ${error.message}`, 500);
    }
    filteredData = data || [];
  }

  const productIds = [
    ...new Set(
      filteredData
        ?.filter((l: any) => l.product_id)
        .map((l: any) => l.product_id) || [],
    ),
  ];

  const bookingIdsForProducts = [
    ...new Set(
      filteredData
        ?.filter((l: any) => l.booking_id)
        .map((l: any) => l.booking_id) || [],
    ),
  ];

  const bookingProductMap = new Map<string, string>();
  if (bookingIdsForProducts.length > 0) {
    const { data: bookings, error: bookingsError } = await (
      supabaseAdmin as any
    )
      .from("bookings")
      .select("id, product_id")
      .in("id", bookingIdsForProducts);

    if (!bookingsError && bookings) {
      bookings.forEach((b: any) => {
        if (b.product_id) {
          bookingProductMap.set(b.id, b.product_id);
          if (!productIds.includes(b.product_id)) {
            productIds.push(b.product_id);
          }
        }
      });
    }
  }

  const productMap = new Map<
    string,
    { category_id: string | null; name: string | null; title?: string | null }
  >();

  if (productIds.length > 0) {
    const { data: products, error: productsError } = await (
      supabaseAdmin as any
    )
      .from("products")
      .select("id, category_id, name, title")
      .in("id", productIds);

    if (!productsError && products) {
      products.forEach((p: any) => {
        productMap.set(p.id, {
          category_id: p.category_id || null,
          name: p.name || null,
          title: p.title || null,
        });
      });
    }
  }

  // Fetch student data from participants for all lessons
  const { studentDataMap } = await enrichLessonsWithStudentData(
    filteredData || [],
    supabaseAdmin,
  );

  const mappedData =
    filteredData?.map((lesson: any) =>
      mapLessonWithEnrichment(
        lesson as RawLessonData,
        productMap,
        bookingProductMap,
        studentDataMap,
      ),
    ) ?? [];

  return mappedData as LessonListItem[];
};

/**
 * Get lesson counts (total and upcoming) for multiple students in a single optimized query
 * @param schoolId - School ID
 * @param startDate - Start date (ISO format: YYYY-MM-DD)
 * @param endDate - End date (ISO format: YYYY-MM-DD)
 * @param studentIds - Array of student IDs
 * @returns Array of lesson counts per student: { studentId, total, upcoming }
 */
export const getLessonCountsByStudents = async (
  schoolId: string,
  startDate: string,
  endDate: string,
  studentIds: string[],
): Promise<Array<{ studentId: string; total: number; upcoming: number }>> => {
  if (!studentIds || studentIds.length === 0) {
    return [];
  }

  // Use consistent local time to avoid timezone mismatch
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const nowTimeStr = `${hours}:${minutes}`; // HH:mm format

  const [
    { data: lessonParticipants, error: participantsError },
    { data: bookingParticipants, error: bookingParticipantsError },
  ] = await Promise.all([
    (supabaseAdmin as any)
      .from("lesson_participants")
      .select("lesson_id, student_id")
      .in("student_id", studentIds),
    (supabaseAdmin as any)
      .from("booking_participants")
      .select("booking_id, student_id")
      .in("student_id", studentIds),
  ]);

  if (participantsError) {
    throw new AppError(
      `Failed to fetch lesson participants: ${participantsError.message}`,
      500,
    );
  }

  if (bookingParticipantsError) {
    throw new AppError(
      `Failed to fetch booking participants: ${bookingParticipantsError.message}`,
      500,
    );
  }

  const studentLessonIdsMap = new Map<string, Set<string>>();
  const studentBookingIdsMap = new Map<string, Set<string>>();

  studentIds.forEach((id) => {
    studentLessonIdsMap.set(id, new Set());
    studentBookingIdsMap.set(id, new Set());
  });

  (lessonParticipants || []).forEach((lp: any) => {
    const studentId = lp.student_id;
    const lessonId = lp.lesson_id;
    if (studentId && lessonId) {
      const lessonIds = studentLessonIdsMap.get(studentId);
      if (lessonIds) {
        lessonIds.add(lessonId);
      }
    }
  });

  (bookingParticipants || []).forEach((bp: any) => {
    const studentId = bp.student_id;
    const bookingId = bp.booking_id;
    if (studentId && bookingId) {
      const bookingIds = studentBookingIdsMap.get(studentId);
      if (bookingIds) {
        bookingIds.add(bookingId);
      }
    }
  });

  // Collect all unique lesson IDs and booking IDs
  const allLessonIds = new Set<string>();
  const allBookingIds = new Set<string>();
  studentLessonIdsMap.forEach((ids) =>
    ids.forEach((id) => allLessonIds.add(id)),
  );
  studentBookingIdsMap.forEach((ids) =>
    ids.forEach((id) => allBookingIds.add(id)),
  );

  const lessonQueries: any[] = [];

  if (allLessonIds.size > 0) {
    lessonQueries.push(
      supabaseAdmin
        .from("lessons")
        .select("id, date, time, booking_id")
        .eq("school_id", schoolId)
        .gte("date", startDate)
        .lte("date", endDate)
        .in("id", Array.from(allLessonIds)),
    );
  }

  if (allBookingIds.size > 0) {
    lessonQueries.push(
      supabaseAdmin
        .from("lessons")
        .select("id, date, time, booking_id")
        .eq("school_id", schoolId)
        .gte("date", startDate)
        .lte("date", endDate)
        .in("booking_id", Array.from(allBookingIds)),
    );
  }

  let allLessons: any[] = [];
  if (lessonQueries.length > 0) {
    const results = await Promise.all(lessonQueries);

    for (const result of results) {
      if (result.error) {
        throw new AppError(
          `Failed to fetch lessons: ${result.error.message}`,
          500,
        );
      }
    }

    const lessonMap = new Map<string, any>();
    results.forEach((result: any) => {
      (result.data || []).forEach((lesson: any) => {
        if (!lessonMap.has(lesson.id)) {
          lessonMap.set(lesson.id, lesson);
        }
      });
    });

    allLessons = Array.from(lessonMap.values());
  }

  const counts: Array<{ studentId: string; total: number; upcoming: number }> =
    [];

  studentIds.forEach((studentId) => {
    const lessonIds = studentLessonIdsMap.get(studentId) || new Set();
    const bookingIds = studentBookingIdsMap.get(studentId) || new Set();

    const studentLessons = allLessons.filter((lesson: any) => {
      return (
        lessonIds.has(lesson.id) ||
        (lesson.booking_id && bookingIds.has(lesson.booking_id))
      );
    });

    const total = studentLessons.length;

    const upcoming = studentLessons.filter((lesson: any) => {
      const lessonDate = lesson.date;
      const lessonTime = lesson.time?.substring(0, 5) || "00:00";
      return (
        lessonDate > todayStr ||
        (lessonDate === todayStr && lessonTime >= nowTimeStr)
      );
    }).length;

    counts.push({ studentId, total, upcoming });
  });

  return counts;
};

export const getInstructorLessons = async (
  instructorId: string,
  startDate?: string,
  endDate?: string,
  opts?: {
    discipline?: string;
    limit?: number;
    offset?: number;
    schoolId?: string;
  },
): Promise<LessonListItem[]> => {
  let query = supabaseAdmin
    .from("lessons")
    .select(
      `
      *,
      instructor:users!lessons_instructor_id_fkey(first_name, last_name, avatar),
      school:schools!lessons_school_id_fkey(name, logo),
      lesson_statuses(name),
      payment_statuses(name)
    `,
    )
    .eq("instructor_id", instructorId);

  if (startDate) {
    query = query.gte("date", startDate);
  }
  if (endDate) {
    query = query.lte("date", endDate);
  }
  if (opts?.discipline) {
    query = query.eq("discipline", opts.discipline);
  }
  if (opts?.schoolId && opts.schoolId !== ALL_SCHOOLS_ID) {
    query = query.eq("school_id", opts.schoolId);
  }

  const { data, error } = await query
    .limit(opts?.limit || 50)
    .range(opts?.offset || 0, (opts?.offset || 0) + (opts?.limit || 50) - 1);
  if (error) {
    throw new AppError(
      `Failed to fetch instructor lessons: ${error.message}`,
      500,
    );
  }

  const productIds = [
    ...new Set(
      data?.filter((l: any) => l.product_id).map((l: any) => l.product_id) ||
        [],
    ),
  ];

  const bookingIds = [
    ...new Set(
      data?.filter((l: any) => l.booking_id).map((l: any) => l.booking_id) ||
        [],
    ),
  ];

  const bookingProductMap = new Map<string, string>();
  if (bookingIds.length > 0) {
    const { data: bookings, error: bookingsError } = await (
      supabaseAdmin as any
    )
      .from("bookings")
      .select("id, product_id")
      .in("id", bookingIds);

    if (!bookingsError && bookings) {
      bookings.forEach((b: any) => {
        if (b.product_id) {
          bookingProductMap.set(b.id, b.product_id);
          if (!productIds.includes(b.product_id)) {
            productIds.push(b.product_id);
          }
        }
      });
    }
  }

  const productMap = new Map<
    string,
    { category_id: string | null; name: string | null; title?: string | null }
  >();

  if (productIds.length > 0) {
    const { data: products, error: productsError } = await (
      supabaseAdmin as any
    )
      .from("products")
      .select("id, category_id, name, title")
      .in("id", productIds);

    if (!productsError && products) {
      products.forEach((p: any) => {
        productMap.set(p.id, {
          category_id: p.category_id || null,
          name: p.name || null,
          title: p.title || null,
        });
      });
    }
  }

  // Fetch student data from participants for all lessons
  const { studentDataMap } = await enrichLessonsWithStudentData(
    data || [],
    supabaseAdmin,
  );

  const mappedData =
    data?.map((lesson: any) =>
      mapLessonWithEnrichment(
        lesson as RawLessonData,
        productMap,
        bookingProductMap,
        studentDataMap,
      ),
    ) ?? [];

  return mappedData as LessonListItem[];
};

export interface InstructorConflictLesson {
  id: string;
  instructor_id: string;
  school_id: string;
  date: string;
  time: string;
  duration: number;
  school_name: string | null;
  school_logo: string | null;
}

export const getInstructorConflicts = async (
  instructorIds: string[],
  startDate: string,
  endDate: string,
): Promise<InstructorConflictLesson[]> => {
  if (instructorIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("lessons")
    .select(
      `
      id,
      instructor_id,
      school_id,
      date,
      time,
      duration,
      school:schools!lessons_school_id_fkey(name, logo)
    `,
    )
    .in("instructor_id", instructorIds)
    .gte("date", startDate)
    .lte("date", endDate);

  if (error) {
    throw new AppError(
      `Failed to fetch instructor conflicts: ${error.message}`,
      500,
    );
  }

  const mappedData =
    data?.map((lesson: any) => {
      let school = lesson.school;
      if (Array.isArray(school)) {
        school = school[0] ?? null;
      }

      return {
        id: lesson.id,
        instructor_id: lesson.instructor_id,
        school_id: lesson.school_id,
        date: lesson.date,
        time: lesson.time,
        duration: lesson.duration,
        school_name: school?.name || null,
        school_logo: school?.logo || null,
      } as InstructorConflictLesson;
    }) ?? [];

  return mappedData;
};

export const computeTimeEnd = (
  timeStart: string,
  durationMinutes: number,
): string => {
  // timeStart format HH:MM or HH:MM:SS
  const [hStr, mStr, sStr] = timeStart.split(":");
  const base = new Date(
    0,
    0,
    1,
    parseInt(hStr || "0", 10),
    parseInt(mStr || "0", 10),
    parseInt(sStr || "0", 10),
  );
  // Add duration in minutes
  base.setMinutes(base.getMinutes() + durationMinutes);
  const hh = String(base.getHours()).padStart(2, "0");
  const mm = String(base.getMinutes()).padStart(2, "0");
  const ss = String(base.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

export const hasInstructorLessonOverlap = async (
  instructorId: string,
  date: string,
  timeStart: string,
  timeEnd: string,
  excludeLessonId?: string,
): Promise<boolean> => {
  // Fetch same-day lessons for instructor and check overlap in JS to avoid complex SQL
  const query = supabaseAdmin
    .from("lessons")
    .select("id,time,duration")
    .eq("instructor_id", instructorId)
    .eq("date", date);

  if (excludeLessonId) query.neq("id", excludeLessonId);

  const { data, error } = await query;
  if (error) {
    throw new AppError(
      `Failed to fetch existing lessons: ${error.message}`,
      500,
    );
  }

  const requestedStart = timeStart;
  const requestedEnd = timeEnd;

  const toEnd = (t: string, d: number) => computeTimeEnd(t, d || 1);

  return (data ?? []).some((l) => {
    const existingStart = (l as unknown as { time: string }).time;
    const existingEnd = toEnd(
      existingStart,
      (l as unknown as { duration: number }).duration,
    );

    const timeToMinutes = (timeStr: string) => {
      const timeParts = timeStr.split(":").map(Number);
      const hours = timeParts[0] || 0;
      const minutes = timeParts[1] || 0;
      return hours * 60 + minutes;
    };

    const requestedStartMinutes = timeToMinutes(requestedStart);
    const requestedEndMinutes = timeToMinutes(requestedEnd);
    const existingStartMinutes = timeToMinutes(existingStart);
    const existingEndMinutes = timeToMinutes(existingEnd);

    return (
      requestedStartMinutes < existingEndMinutes &&
      requestedEndMinutes > existingStartMinutes
    );
  });
};

export const rescheduleLesson = async (
  lessonId: string,
  date: string,
  timeStart: string,
  durationMinutes: number,
  instructorIdOverride?: string,
): Promise<{ id: string; date: string; time: string; duration: number }> => {
  // Load lesson to get instructor and school
  const { data: lesson, error: getErr } = await supabaseAdmin
    .from("lessons")
    .select("id,instructor_id,school_id")
    .eq("id", lessonId)
    .single();
  if (getErr || !lesson) {
    throw new AppError("Lesson not found", 404);
  }

  const currentInstructorId = (lesson as unknown as LessonRecord).instructor_id;
  const schoolId = (lesson as unknown as LessonRecord).school_id;
  const instructorId = instructorIdOverride || currentInstructorId;

  const normalizedTimeStart =
    timeStart.includes(":") && timeStart.split(":").length === 2
      ? `${timeStart}:00`
      : timeStart;

  const timeEnd = computeTimeEnd(normalizedTimeStart, durationMinutes);

  // 1) Check if school is available on the requested date
  const schoolAvailable = await isSchoolDateAvailable(schoolId, date);
  if (!schoolAvailable) {
    throw new AppError("School is closed on the selected date", 400);
  }

  // Check if lesson end time exceeds school closing time
  const { data: school, error: schoolError } = await supabaseAdmin
    .from("schools")
    .select("open_hours_end")
    .eq("id", schoolId)
    .single();

  if (!schoolError && school?.open_hours_end) {
    const closingTime =
      school.open_hours_end.includes(":") &&
      school.open_hours_end.split(":").length === 2
        ? `${school.open_hours_end}:00`
        : school.open_hours_end;

    if (timeEnd > closingTime) {
      throw new AppError(
        `Lesson cannot extend beyond school closing time. School closes at ${school.open_hours_end}`,
        400,
      );
    }
  }

  // 2) Check instructor declared availability
  const available = await checkInstructorAvailabilitySlot(
    instructorId,
    date,
    normalizedTimeStart,
    timeEnd,
  );
  if (!available) {
    throw new AppError("Instructor not available for the requested time", 400);
  }

  // 3) Check no overlapping lessons
  const overlaps = await hasInstructorLessonOverlap(
    instructorId,
    date,
    normalizedTimeStart,
    timeEnd,
    lessonId,
  );
  if (overlaps) {
    throw new AppError("Requested time overlaps with another lesson", 400);
  }

  // 4) Update the lesson timing (and instructor if changed)
  const updatePayload: Record<string, any> = {
    date,
    time: normalizedTimeStart,
    duration: durationMinutes,
  };
  if (instructorId !== currentInstructorId) {
    updatePayload["instructor_id"] = instructorId;
  }

  const { data: updated, error: updErr } = await supabaseAdmin
    .from("lessons")
    .update(updatePayload)
    .eq("id", lessonId)
    .select("id,date,time,duration")
    .single();

  if (updErr || !updated) {
    throw new AppError("Failed to reschedule lesson", 500);
  }

  return updated as unknown as {
    id: string;
    date: string;
    time: string;
    duration: number;
  };
};

export interface LessonDetails {
  id: string;
  date: string;
  time: string;
  duration: number;
  discipline: string;
  level: string;
  price: number;
  notes?: string;
  booking_id?: string;
  product_id?: string;
  lesson_status_id?: string;
  payment_status_id?: string;
  instructor: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    whatsapp_number?: string;
    avatar?: string;
    specialties?: string[];
  };
  product?: {
    id: string;
    name: string;
    title?: string;
    price: number;
    duration_hours?: number;
    category?: {
      id: string;
      name: string;
      color?: string;
    };
  };
  participants: Array<{
    id: string;
    student_id: string;
    first_name: string;
    last_name: string;
    email: string;
    whatsapp_number?: string;
    skill_level?: string;
  }>;
  booking?: {
    id: string;
    total_minutes: number;
    remaining_minutes: number;
    start_date: string;
    end_date: string;
  };
  bookingLessons?: Array<{
    id: string;
    date: string;
    time: string;
    duration: number;
  }>;
  lessonStatus?: {
    id: string;
    name: string;
    display_name: string;
    color: string;
  };
  paymentStatus?: {
    id: string;
    name: string;
    display_name: string;
    color: string;
  };
  school?: {
    id: string;
    name: string;
    address?: string;
  };
}

export const getLessonById = async (
  lessonId: string,
  schoolId: string | null,
): Promise<LessonDetails> => {
  // verify the lesson exists
  const { data: lessonCheck, error: checkError } = await (supabaseAdmin as any)
    .from("lessons")
    .select("id, school_id")
    .eq("id", lessonId)
    .maybeSingle();

  if (checkError) {
    console.error("Error checking lesson existence:", checkError);
    throw new AppError(`Failed to fetch lesson: ${checkError.message}`, 500);
  }

  if (!lessonCheck) {
    console.error("Lesson not found by ID:", lessonId);
    throw new AppError("Lesson not found", 404);
  }

  // Verify school_id matches
  if (schoolId && lessonCheck.school_id !== schoolId) {
    console.error("Lesson school_id mismatch:", {
      lessonSchoolId: lessonCheck.school_id,
      requestedSchoolId: schoolId,
      lessonId,
    });
    throw new AppError("Lesson not found", 404);
  }

  // fetch lesson with all related data
  const { data: lesson, error: lessonError } = await (supabaseAdmin as any)
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .single();

  if (lessonError) {
    console.error("Error fetching lesson:", lessonError);
    throw new AppError(`Failed to fetch lesson: ${lessonError.message}`, 500);
  }

  if (!lesson) {
    throw new AppError("Lesson not found", 404);
  }

  // Fetch instructor details
  let instructor = null;
  if (lesson.instructor_id) {
    const { data: instructorData, error: instructorError } = await (
      supabaseAdmin as any
    )
      .from("users")
      .select("id, first_name, last_name, whatsapp_number, avatar, specialties")
      .eq("id", lesson.instructor_id)
      .maybeSingle();

    if (instructorError) {
      console.error(
        "Error fetching instructor from users table:",
        instructorError,
      );
    } else if (instructorData) {
      // Fetch email from auth.users
      try {
        const { data: authUser, error: authError } =
          await supabaseAdmin.auth.admin.getUserById(lesson.instructor_id);
        if (authError) {
          console.error(
            "Error fetching instructor email from auth.users:",
            authError,
          );
        }
        instructor = {
          ...instructorData,
          email: authUser?.user?.email || "",
        };
      } catch (authError: any) {
        console.error(
          "Exception fetching instructor email from auth.users:",
          authError,
        );
        instructor = {
          ...instructorData,
          email: "",
        };
      }
    } else {
      console.warn(
        "Instructor not found in users table for instructor_id:",
        lesson.instructor_id,
      );
    }
  } else {
    console.warn("Lesson has no instructor_id:", lesson.id);
  }

  // Fetch lesson status
  let lessonStatus = null;
  if (lesson.lesson_status_id) {
    const { data: statusData, error: statusError } = await (
      supabaseAdmin as any
    )
      .from("lesson_statuses")
      .select("id, name, display_name, color")
      .eq("id", lesson.lesson_status_id)
      .single();

    if (!statusError && statusData) {
      lessonStatus = statusData;
    }
  }

  // Fetch payment status
  let paymentStatus = null;
  if (lesson.payment_status_id) {
    const { data: statusData, error: statusError } = await (
      supabaseAdmin as any
    )
      .from("payment_statuses")
      .select("id, name, display_name, color")
      .eq("id", lesson.payment_status_id)
      .single();

    if (!statusError && statusData) {
      paymentStatus = statusData;
    }
  }

  // Fetch product details
  let product = null;
  if (lesson.product_id) {
    const { data: productData, error: productError } = await (
      supabaseAdmin as any
    )
      .from("products")
      .select("id, title, price, duration_hours, category_id")
      .eq("id", lesson.product_id)
      .maybeSingle();

    if (productError) {
      console.error("Error fetching product:", productError);
    } else if (productData) {
      product = productData;

      // Fetch product category if category_id exists
      if (productData.category_id) {
        const { data: categoryData, error: categoryError } = await (
          supabaseAdmin as any
        )
          .from("product_categories")
          .select("id, name, color")
          .eq("id", productData.category_id)
          .maybeSingle();

        if (categoryError) {
          console.error("Error fetching product category:", categoryError);
        } else if (categoryData) {
          product.product_categories = categoryData;
        }
      }
    } else {
      console.warn("Product not found for product_id:", lesson.product_id);
    }
  }

  // Fetch school details
  let school = null;
  if (lesson.school_id) {
    const { data: schoolData, error: schoolError } = await (
      supabaseAdmin as any
    )
      .from("schools")
      .select("id, name, address")
      .eq("id", lesson.school_id)
      .single();

    if (schoolError) {
      console.error("Error fetching school:", schoolError);
    } else if (schoolData) {
      school = {
        id: schoolData.id,
        name: schoolData.name,
        address: schoolData.address || undefined,
      };
    }
  }

  // Fetch participants
  let participants: any[] = [];
  let participantStudentIds: string[] = [];
  const mappedParticipants = [];

  if (lesson.booking_id) {
    const { data: bookingParticipants, error: bookingParticipantsError } =
      await (supabaseAdmin as any)
        .from("booking_participants")
        .select("id, student_id")
        .eq("booking_id", lesson.booking_id);

    if (bookingParticipantsError) {
      console.error(
        "Error fetching booking participants:",
        bookingParticipantsError,
      );
    } else if (bookingParticipants && bookingParticipants.length > 0) {
      participants = bookingParticipants;
      participantStudentIds = bookingParticipants.map((p: any) => p.student_id);
    } else {
      console.warn("No participants found for booking:", lesson.booking_id);
    }
  } else {
    const { data: lessonParticipants, error: participantsError } = await (
      supabaseAdmin as any
    )
      .from("lesson_participants")
      .select("id, student_id")
      .eq("lesson_id", lessonId);

    if (participantsError) {
      console.warn("Failed to fetch lesson participants:", participantsError);
    } else if (lessonParticipants && lessonParticipants.length > 0) {
      participants = lessonParticipants;
      participantStudentIds = lessonParticipants.map((p: any) => p.student_id);
    } else {
      console.warn("No participants found for lesson:", lessonId);
    }
  }

  if (participantStudentIds.length > 0) {
    const { data: participantUsers, error: usersError } = await (
      supabaseAdmin as any
    )
      .from("users")
      .select("id, first_name, last_name, whatsapp_number")
      .in("id", participantStudentIds);

    if (usersError) {
      console.error(
        "Error fetching participant users from users table:",
        usersError,
      );
    } else {
      console.warn(
        "No participant users found in users table for student_ids:",
        participantStudentIds,
      );
    }

    const { data: participantMemberships, error: membershipError } = await (
      supabaseAdmin as any
    )
      .from("student_schools")
      .select("student_id, skill_level")
      .in("student_id", participantStudentIds)
      .eq("school_id", lesson.school_id)
      .eq("is_active", true);
    if (membershipError) {
      console.warn("Failed to fetch participant membership skill levels:", membershipError);
    }

    const membershipByStudentId = new Map<string, any>(
      (participantMemberships || []).map((m: any) => [m.student_id, m]),
    );

    if (participantUsers && participantUsers.length > 0) {
      // Fetch emails from auth.users for all participants
      const userEmailsMap = new Map<string, string>();
      try {
        const authUsersPromises = participantStudentIds.map(
          async (studentId: string) => {
            try {
              const { data: authUser, error: authError } =
                await supabaseAdmin.auth.admin.getUserById(studentId);
              if (authError) {
                console.warn(
                  `Error fetching email for student ${studentId}:`,
                  authError,
                );
              } else if (authUser?.user?.email) {
                userEmailsMap.set(studentId, authUser.user.email);
              }
            } catch (error) {
              console.warn(
                `Exception fetching email for student ${studentId}:`,
                error,
              );
            }
          },
        );
        await Promise.all(authUsersPromises);
      } catch (error) {
        console.error(
          "Error fetching participant emails from auth.users:",
          error,
        );
      }

      interface ParticipantUser {
        id: string;
        first_name: string | null;
        last_name: string | null;
        whatsapp_number?: string | null;
      }

      const userMap = new Map<string, ParticipantUser>(
        participantUsers.map((u: any) => [u.id, u as ParticipantUser]),
      );
      mappedParticipants.push(
        ...participants.map((p: any) => {
          const user = userMap.get(p.student_id);
          const email = userEmailsMap.get(p.student_id) || "";
          const participant: {
            id: string;
            student_id: string;
            first_name: string;
            last_name: string;
            email: string;
            whatsapp_number?: string | undefined;
            skill_level?: string | undefined;
          } = {
            id: p.id,
            student_id: p.student_id,
            first_name: user?.first_name || "",
            last_name: user?.last_name || "",
            email: email,
          };
          // Use whatsapp_number only
          if (user?.whatsapp_number) {
            participant.whatsapp_number = user.whatsapp_number;
          }
          const membership = membershipByStudentId.get(p.student_id);
          if (membership?.skill_level) {
            participant.skill_level = membership.skill_level;
          }
          return participant;
        }),
      );
    } else {
      console.warn(
        "No participant users found in users table for student_ids:",
        participantStudentIds,
      );
      mappedParticipants.push(
        ...participants.map((p: any) => ({
          id: p.id,
          student_id: p.student_id,
          first_name: "",
          last_name: "",
          email: "",
        })),
      );
    }
  }

  // Fetch booking details
  let booking = null;
  let bookingLessons: Array<{
    id: string;
    date: string;
    time: string;
    duration: number;
  }> = [];

  if (lesson.booking_id) {
    const { data: bookingData, error: bookingError } = await (
      supabaseAdmin as any
    )
      .from("bookings")
      .select("id, total_minutes, remaining_minutes, start_date, end_date")
      .eq("id", lesson.booking_id)
      .single();

    if (!bookingError && bookingData) {
      booking = bookingData;

      const { data: lessonsData, error: lessonsError } = await (
        supabaseAdmin as any
      )
        .from("lessons")
        .select("id, date, time, duration")
        .eq("booking_id", lesson.booking_id)
        .order("date", { ascending: true })
        .order("time", { ascending: true });

      if (!lessonsError && lessonsData) {
        bookingLessons = lessonsData;
      }
    }
  }

  // Map instructor data
  const mappedInstructor = instructor
    ? {
        id: instructor.id,
        first_name: instructor.first_name || "",
        last_name: instructor.last_name || "",
        email: instructor.email || "",
        whatsapp_number: instructor.whatsapp_number || undefined,
        avatar: instructor.avatar || undefined,
        specialties: instructor.specialties || [],
      }
    : {
        id: "",
        first_name: "",
        last_name: "",
        email: "",
        whatsapp_number: undefined,
        avatar: undefined,
        specialties: [],
      };

  // Map product data
  const mappedProduct:
    | {
        id: string;
        name: string;
        title?: string;
        price: number;
        duration_hours?: number;
        category?: {
          id: string;
          name: string;
          color?: string;
        };
      }
    | undefined = product
    ? {
        id: product.id,
        name: product.title || "",
        ...(product.title ? { title: product.title } : {}),
        price: product.price || 0,
        ...(product.duration_hours
          ? { duration_hours: product.duration_hours }
          : {}),
        ...(product.product_categories
          ? {
              category: {
                id: product.product_categories.id,
                name: product.product_categories.name || "",
                ...(product.product_categories.color
                  ? { color: product.product_categories.color }
                  : {}),
              },
            }
          : {}),
      }
    : undefined;

  // Map statuses
  const mappedLessonStatus = lessonStatus
    ? {
        id: lessonStatus.id,
        name: lessonStatus.name || "",
        display_name: lessonStatus.display_name || lessonStatus.name || "",
        color: lessonStatus.color || "#6B7280",
      }
    : undefined;

  const mappedPaymentStatus = paymentStatus
    ? {
        id: paymentStatus.id,
        name: paymentStatus.name || "",
        display_name: paymentStatus.display_name || paymentStatus.name || "",
        color: paymentStatus.color || "#6B7280",
      }
    : undefined;

  const result: LessonDetails = {
    id: lesson.id,
    date: lesson.date,
    time: lesson.time,
    duration: lesson.duration,
    discipline: lesson.discipline || "",
    level: lesson.level || "beginner",
    price: lesson.price || 0,
    instructor: mappedInstructor,
    participants: mappedParticipants,
  };

  if (lesson.notes) {
    result.notes = lesson.notes;
  }
  if (lesson.booking_id) {
    result.booking_id = lesson.booking_id;
  }
  if (lesson.product_id) {
    result.product_id = lesson.product_id;
  }
  if (lesson.lesson_status_id) {
    result.lesson_status_id = lesson.lesson_status_id;
  }
  if (lesson.payment_status_id) {
    result.payment_status_id = lesson.payment_status_id;
  }
  if (mappedProduct !== undefined) {
    result.product = mappedProduct;
  }
  if (booking) {
    result.booking = booking;
  }
  if (bookingLessons.length > 0) {
    result.bookingLessons = bookingLessons;
  }
  if (mappedLessonStatus) {
    result.lessonStatus = mappedLessonStatus;
  }
  if (mappedPaymentStatus) {
    result.paymentStatus = mappedPaymentStatus;
  }
  if (school) {
    result.school = school;
  }

  return result;
};
