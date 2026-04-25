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

// Mock Supabase database
jest.mock("../src/database/supabase", () => {
  const select = jest.fn().mockReturnThis();
  const eq = jest.fn().mockReturnThis();
  const inFn = jest.fn().mockReturnThis();
  
  // Create chainable query builder that returns a promise
  const createQueryBuilder = (finalData: any) => {
    const builder: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: finalData, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: finalData, error: null }),
    };
    // Make it thenable for direct await
    builder.then = async (resolve: any) => resolve({ data: finalData, error: null });
    return builder;
  };

  const from = jest.fn((table: string) => {
    if (table === "users") {
      return createQueryBuilder([{ id: "student-1", skill_level: "beginner" }]);
    }
    if (table === "schools") {
      return createQueryBuilder({ open_hours_end: "18:00:00" });
    }
    if (table === "instructor_schools") {
      return createQueryBuilder({ school_id: "test-school-1" });
    }
    if (table === "lesson_participants") {
      return {
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    }
    if (table === "lessons") {
      return {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: "lesson-new" }, error: null }),
          }),
        }),
      };
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
const mockIsSchoolDateAvailable = jest.fn().mockResolvedValue(true);
const mockCheckInstructorAvailabilitySlot = jest.fn().mockResolvedValue(true);

jest.mock("../src/services/schoolCalendar", () => ({
  isSchoolDateAvailable: mockIsSchoolDateAvailable,
}));

jest.mock("../src/services/availability", () => ({
  checkInstructorAvailabilitySlot: mockCheckInstructorAvailabilitySlot,
}));

jest.mock("../src/services/bookings", () => ({
  deductBookingMinutes: jest.fn().mockResolvedValue(undefined),
  restoreBookingMinutes: jest.fn().mockResolvedValue(undefined),
  getConfirmedLessonsDuration: jest.fn().mockResolvedValue(0),
}));

const mockRescheduleLesson = jest.fn().mockResolvedValue({
  id: "lesson-1",
  date: "2025-12-31",
  time: "10:00:00",
  duration: 60,
});

const mockHasInstructorLessonOverlap = jest.fn().mockResolvedValue(false);

jest.mock("../src/services/lessons", () => ({
  rescheduleLesson: mockRescheduleLesson,
  computeTimeEnd: jest.fn((time: string, duration: number) => {
    const [h, m] = time.split(":").map(Number);
    const totalMinutes = h * 60 + m + duration;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  }),
  hasInstructorLessonOverlap: mockHasInstructorLessonOverlap,
}));

// Import app after mocks
import app from "../src/index";

describe("POST /api/lessons/:id/reschedule", () => {
  it("should successfully reschedule lesson", async () => {
    // Use a date far in the future to avoid past date validation
    const futureDate = "2099-12-31";
    
    const res = await request(app)
      .post("/api/lessons/lesson-1/reschedule")
      .send({
        date: futureDate,
        timeStart: "10:00:00",
        durationMinutes: 60,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe("lesson-1");
  });

  it("should return 400 for past date/time", async () => {
    const res = await request(app)
      .post("/api/lessons/lesson-1/reschedule")
      .send({
        date: "2020-01-01",
        timeStart: "09:00:00",
        durationMinutes: 60,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("past");
  });

  it("should return 400 when instructor unavailable", async () => {
    const error = new Error("Instructor not available for the requested time");
    (error as any).statusCode = 400;
    mockRescheduleLesson.mockRejectedValueOnce(error);

    const res = await request(app)
      .post("/api/lessons/lesson-1/reschedule")
      .send({
        date: "2099-12-31",
        timeStart: "10:00:00",
        durationMinutes: 60,
      });

    expect(res.status).toBe(400);
  });

  it("should return 400 when time overlaps with another lesson", async () => {
    const error = new Error("Requested time overlaps with another lesson");
    (error as any).statusCode = 400;
    mockRescheduleLesson.mockRejectedValueOnce(error);

    const res = await request(app)
      .post("/api/lessons/lesson-1/reschedule")
      .send({
        date: "2099-12-31",
        timeStart: "10:00:00",
        durationMinutes: 60,
      });

    expect(res.status).toBe(400);
  });

  it("should return 400 when school is closed", async () => {
    const error = new Error("School is closed on the selected date");
    (error as any).statusCode = 400;
    mockRescheduleLesson.mockRejectedValueOnce(error);

    const res = await request(app)
      .post("/api/lessons/lesson-1/reschedule")
      .send({
        date: "2099-12-31",
        timeStart: "10:00:00",
        durationMinutes: 60,
      });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/lessons", () => {
  it("should create new lesson successfully", async () => {
    const res = await request(app)
      .post("/api/lessons")
      .send({
        instructor_id: "instructor-1",
        student_id: "student-1",
        date: "2099-12-31",
        time: "09:00:00",
        duration: 60,
        discipline: "kite",
        level: "beginner",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Lesson created successfully");
  });

  it("should return 400 when creating lesson in the past", async () => {
    const res = await request(app)
      .post("/api/lessons")
      .send({
        instructor_id: "instructor-1",
        student_id: "student-1",
        date: "2020-01-01",
        time: "09:00:00",
        duration: 60,
        discipline: "kite",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("past");
  });

  it("should return 400 when instructor is unavailable", async () => {
    mockCheckInstructorAvailabilitySlot.mockResolvedValueOnce(false);

    const res = await request(app)
      .post("/api/lessons")
      .send({
        instructor_id: "instructor-1",
        student_id: "student-1",
        date: "2099-12-31",
        time: "09:00:00",
        duration: 60,
        discipline: "kite",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("not available");
  });

  it("should return 400 when time overlaps with another lesson", async () => {
    mockHasInstructorLessonOverlap.mockResolvedValueOnce(true);

    const res = await request(app)
      .post("/api/lessons")
      .send({
        instructor_id: "instructor-1",
        student_id: "student-1",
        date: "2099-12-31",
        time: "09:00:00",
        duration: 60,
        discipline: "kite",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("already has a lesson");
  });

  it("should return 400 when student not found in school", async () => {
    // Mock users query to return empty array
    const { supabaseAdmin } = require("../src/database/supabase");
    const originalFrom = supabaseAdmin.from;
    supabaseAdmin.from = jest.fn((table: string) => {
      if (table === "users") {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          then: async (resolve: any) => resolve({ data: [], error: null }),
        };
      }
      return originalFrom(table);
    });

    const res = await request(app)
      .post("/api/lessons")
      .send({
        instructor_id: "instructor-1",
        student_id: "invalid-student",
        date: "2099-12-31",
        time: "09:00:00",
        duration: 60,
        discipline: "kite",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("not found");
    
    // Restore original mock
    supabaseAdmin.from = originalFrom;
  });

  it("should return 400 when school is closed for lesson time", async () => {
    // Mock schools query to return closed hours
    const { supabaseAdmin } = require("../src/database/supabase");
    const originalFrom = supabaseAdmin.from;
    supabaseAdmin.from = jest.fn((table: string) => {
      if (table === "schools") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { open_hours_end: "08:00:00" }, // School closes at 8 AM
            error: null,
          }),
        };
      }
      return originalFrom(table);
    });

    const res = await request(app)
      .post("/api/lessons")
      .send({
        instructor_id: "instructor-1",
        student_id: "student-1",
        date: "2099-12-31",
        time: "09:00:00", // After closing time
        duration: 60,
        discipline: "kite",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("School closes");
    
    // Restore original mock
    supabaseAdmin.from = originalFrom;
  });
});
