import request from "supertest";

// Mock user that can be changed per test
let mockUser = {
  id: "test-user",
  schoolId: "test-school-1",
  role: "SCHOOL_ADMIN",
};

// Mock auth middleware
jest.mock("../src/middleware/auth", () => ({
  authenticate: (_req: any, _res: any, next: any) => {
    (_req as any).user = mockUser;
    next();
  },
  authorizeRoles: () => (_req: any, _res: any, next: any) => next(),
  authorizeSchoolAccess: () => (_req: any, _res: any, next: any) => next(),
  notFound: (_req: any, _res: any, next: any) => next(),
  errorHandler: (err: any, _req: any, res: any, _next: any) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal server error";
    res.status(statusCode).json({ success: false, error: message });
  },
}));

// Mock validation middleware
jest.mock("../src/middleware/validation", () => ({
  validate: () => (_req: any, _res: any, next: any) => next(),
}));

// Mock Supabase database with configurable responses
let mockLessonData: any = {
  id: "lesson-1",
  school_id: "test-school-1",
  instructor_id: "test-user",
  booking_id: null,
  student_id: "student-1",
  duration: 60,
  lesson_status_id: null,
  status: "pending",
  date: "2099-12-31",
  time: "09:00:00",
};

let mockUpdatedLesson: any = {
  id: "lesson-1",
  lesson_status_id: "status-2",
  status: "confirmed",
};
let mockInstructorCanEditLessons = false;

jest.mock("../src/database/supabase", () => {
  const createQueryBuilder = (finalData: any) => {
    const builder: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: finalData, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: finalData, error: null }),
    };
    builder.then = async (resolve: any) => resolve({ data: finalData, error: null });
    return builder;
  };

  const from = jest.fn((table: string) => {
    if (table === "lessons") {
      const lessonsBuilder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockLessonData,
          error: null,
        }),
        update: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUpdatedLesson,
              error: null,
            }),
          }),
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUpdatedLesson,
                error: null,
              }),
            }),
          }),
        }),
        delete: jest.fn().mockReturnThis(),
      };
      // Make delete().eq() chainable
      lessonsBuilder.delete = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      });
      return lessonsBuilder;
    }
    if (table === "lesson_statuses") {
      let currentStatusId = "status-2";
      const builder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn((column: string, value: any) => {
          if (column === "id") {
            currentStatusId = value;
            builder.single = jest.fn().mockResolvedValue({
              data: value === "status-1" 
                ? { id: "status-1", name: "pending" }
                : { id: "status-2", name: "confirmed" },
              error: null,
            });
          }
          return builder;
        }),
        single: jest.fn().mockResolvedValue({
          data: currentStatusId === "status-1" 
            ? { id: "status-1", name: "pending" }
            : { id: "status-2", name: "confirmed" },
          error: null,
        }),
      };
      builder.then = async (resolve: any) => resolve({ data: [{ id: "status-2", name: "confirmed" }], error: null });
      return builder;
    }
    if (table === "payment_statuses") {
      return createQueryBuilder({ id: "payment-2", name: "paid" });
    }
    if (table === "lesson_participants") {
      return {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    }
    if (table === "bookings") {
      return createQueryBuilder({
        id: "booking-1",
        total_minutes: 480,
        remaining_minutes: 360,
        status: "active",
      });
    }
    if (table === "booking_participants") {
      return createQueryBuilder({ booking_id: "booking-1" });
    }
    if (table === "instructor_lesson_permissions") {
      return createQueryBuilder({
        instructor_id: "test-user",
        school_id: "test-school-1",
        can_edit_lessons: mockInstructorCanEditLessons,
      });
    }
    return createQueryBuilder(null);
  });

  return {
    __esModule: true,
    default: { from },
    supabase: { from },
    supabaseAdmin: { from },
    checkDatabaseConnection: jest.fn(async () => true),
    checkAdminConnection: jest.fn(async () => true),
  };
});

// Mock services
jest.mock("../src/services/bookings", () => ({
  deductBookingMinutes: jest.fn().mockResolvedValue(undefined),
  restoreBookingMinutes: jest.fn().mockResolvedValue(undefined),
  getConfirmedLessonsDuration: jest.fn().mockResolvedValue(0),
}));

// Import app after mocks
import app from "../src/index";
import * as bookingsService from "../src/services/bookings";

describe("PATCH /api/lessons/:id", () => {
  beforeEach(() => {
    mockUser = {
      id: "test-user",
      schoolId: "test-school-1",
      role: "SCHOOL_ADMIN",
    };
    mockInstructorCanEditLessons = false;
    mockLessonData = {
      id: "lesson-1",
      school_id: "test-school-1",
      instructor_id: "test-user",
      booking_id: null,
      student_id: "student-1",
      duration: 60,
      lesson_status_id: null,
      status: "pending",
      date: "2099-12-31",
      time: "09:00:00",
    };
  });

  it("should update lesson status", async () => {
    const res = await request(app)
      .patch("/api/lessons/lesson-1")
      .send({
        lesson_status_id: "status-2",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Lesson updated successfully");
  });

  it("should update payment status", async () => {
    const res = await request(app)
      .patch("/api/lessons/lesson-1")
      .send({
        payment_status_id: "payment-2",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should handle booking minutes when status changes to confirmed", async () => {
    // Set up lesson with booking
    mockLessonData = {
      ...mockLessonData,
      booking_id: "booking-1",
      student_id: "student-1",
      duration: 60,
      lesson_status_id: "status-1",
      status: "pending",
    };
    mockUpdatedLesson = {
      ...mockLessonData,
      lesson_status_id: "status-2",
      status: "confirmed",
    };

    const res = await request(app)
      .patch("/api/lessons/lesson-1")
      .send({
        lesson_status_id: "status-2",
      });

    expect(res.status).toBe(200);
    expect(bookingsService.deductBookingMinutes).toHaveBeenCalledWith(
      "booking-1",
      60,
      "student-1",
    );
  });

  it("should restore booking minutes when status changes from confirmed", async () => {
    // Set up confirmed lesson with booking
    mockLessonData = {
      ...mockLessonData,
      booking_id: "booking-1",
      student_id: "student-2",
      duration: 120,
      lesson_status_id: "status-2",
      status: "confirmed",
    };
    mockUpdatedLesson = {
      ...mockLessonData,
      lesson_status_id: "status-1",
      status: "pending",
    };

    const res = await request(app)
      .patch("/api/lessons/lesson-1")
      .send({
        lesson_status_id: "status-1",
      });

    expect(res.status).toBe(200);
    expect(bookingsService.restoreBookingMinutes).toHaveBeenCalledWith(
      "booking-1",
      120,
      "student-2",
    );
  });

  it("should keep allowing edits for past lessons", async () => {
    mockLessonData = {
      ...mockLessonData,
      date: "2020-01-01",
      time: "09:00:00",
    };

    const res = await request(app)
      .patch("/api/lessons/lesson-1")
      .send({
        lesson_status_id: "status-2",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should block instructor lesson edit when school permission is missing", async () => {
    mockUser = {
      id: "test-user",
      schoolId: "test-school-1",
      role: "INSTRUCTOR",
    };
    mockInstructorCanEditLessons = false;

    const res = await request(app).patch("/api/lessons/lesson-1").send({
      lesson_status_id: "status-2",
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("not authorized");
  });

  it("should allow instructor lesson edit when school permission exists", async () => {
    mockUser = {
      id: "test-user",
      schoolId: "test-school-1",
      role: "INSTRUCTOR",
    };
    mockInstructorCanEditLessons = true;

    const res = await request(app).patch("/api/lessons/lesson-1").send({
      lesson_status_id: "status-2",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("DELETE /api/lessons/:id", () => {
  beforeEach(() => {
    // Reset to future date for delete tests
    mockLessonData = {
      id: "lesson-1",
      school_id: "test-school-1",
      booking_id: null,
      student_id: "student-1",
      duration: 60,
      lesson_status_id: null,
      status: "pending",
      date: "2099-12-31",
      time: "09:00:00",
    };
  });

  it("should delete lesson successfully", async () => {
    // Reset to basic lesson data
    mockLessonData = {
      id: "lesson-1",
      booking_id: null,
      student_id: "student-1",
      duration: 60,
      lesson_status_id: null,
      status: "pending",
      date: "2099-12-31",
      time: "09:00:00",
    };

    const res = await request(app).delete("/api/lessons/lesson-1");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Lesson deleted");
  });

  it("should restore booking minutes if lesson was confirmed", async () => {
    // Set up confirmed lesson with booking
    mockLessonData = {
      id: "lesson-1",
      booking_id: "booking-1",
      student_id: "student-2",
      duration: 120,
      lesson_status_id: "status-2",
      status: "confirmed",
      date: "2099-12-31",
      time: "09:00:00",
    };

    const res = await request(app).delete("/api/lessons/lesson-1");

    expect(res.status).toBe(200);
    expect(bookingsService.restoreBookingMinutes).toHaveBeenCalledWith(
      "booking-1",
      120,
      "student-2",
    );
  });

  it("should return 400 when deleting past lessons", async () => {
    mockLessonData = {
      ...mockLessonData,
      date: "2020-01-01",
      time: "09:00:00",
    };

    const res = await request(app).delete("/api/lessons/lesson-1");

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("past lessons");
  });
});
