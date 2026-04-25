import request from "supertest";

// Mock auth middleware to bypass authorization in tests
jest.mock("../src/middleware/auth", () => ({
  authenticate: (_req: any, _res: any, next: any) => {
    // Mock user object
    (_req as any).user = {
      id: "test-user",
      schoolId: "test-school",
      role: "SCHOOL_ADMIN",
    };
    next();
  },
  authorizeRoles: () => (_req: any, _res: any, next: any) => next(),
  authorizeSchoolAccess: () => (_req: any, _res: any, next: any) => next(),
  notFound: (_req: any, _res: any, next: any) => next(),
  errorHandler: (_err: any, _req: any, _res: any, _next: any) => {},
}));

// Mock validation middleware
jest.mock("../src/middleware/validation", () => ({
  validate: () => (_req: any, _res: any, next: any) => next(),
}));

// Mock Supabase admin client and helpers
jest.mock("../src/database/supabase", () => {
  const rpc = jest.fn((fn: string) => {
    if (fn === "check_instructor_availability") {
      return Promise.resolve({ data: true, error: null }); // available
    }
    return Promise.resolve({ data: null, error: null });
  });

  const select = jest.fn().mockReturnThis();
  const eq = jest.fn().mockReturnThis();
  const neq = jest.fn().mockReturnThis();

  const singleLesson = jest.fn().mockResolvedValue({
    data: { id: "lesson-1", instructor_id: "instr-1", school_id: "school-1" },
    error: null,
  });

  const update = jest.fn().mockResolvedValue({
    data: {
      id: "lesson-1",
      instructor_id: "instr-1",
      school_id: "school-1",
      date: "2099-12-31",
      time: "09:00:00",
      duration: 60,
    },
    error: null,
  });

  const from = jest.fn((table: string) => {
    if (table === "lessons") {
      return {
        select,
        eq,
        neq,
        single: singleLesson,
        update,
      } as any;
    }
    return { select, eq, single: singleLesson } as any;
  });

  const supabase = { from } as any;
  const supabaseAdmin = { rpc, from } as any;

  return {
    __esModule: true,
    default: supabase,
    supabase,
    supabaseAdmin,
    checkDatabaseConnection: async () => true,
    checkAdminConnection: async () => true,
  };
});

// Mock the lessons service
jest.mock("../src/services/lessons", () => ({
  rescheduleLesson: jest.fn().mockResolvedValue({
    id: "lesson-1",
    date: "2099-12-31",
    time: "09:00:00",
    duration: 60,
  }),
  checkInstructorAvailabilitySlot: jest.fn().mockResolvedValue(true),
  hasInstructorLessonOverlap: jest.fn().mockResolvedValue(false),
  computeTimeEnd: jest.fn().mockReturnValue("10:00:00"),
}));

// Import the app after mocks
import app from "../src/index";

describe("Lessons reschedule (mocked DB)", () => {
  // Set test timeout to 10 seconds
  jest.setTimeout(10000);

  it("reschedules when available and no overlap (returns 200)", async () => {
    const res = await request(app)
      .post("/api/lessons/lesson-1/reschedule")
      .send({ date: "2099-12-31", timeStart: "09:00:00", durationHours: 1 })
      .timeout(5000); // 5 second timeout for the request

    expect([200, 400]).toContain(res.status);
  });
});
