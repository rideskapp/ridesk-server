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
  errorHandler: (_err: any, _req: any, _res: any, _next: any) => {},
}));

// Mock validation middleware
jest.mock("../src/middleware/validation", () => ({
  validate: () => (_req: any, _res: any, next: any) => next(),
}));

// Mock lessons service
const mockGetLessonsByRange = jest.fn().mockResolvedValue([
  {
    id: "lesson-1",
    instructor_id: "instructor-1",
    school_id: "test-school-1",
    date: "2024-12-31",
    time: "09:00:00",
    duration: 60,
  },
]);

const mockGetLessonById = jest.fn().mockResolvedValue({
  id: "lesson-1",
  instructor_id: "instructor-1",
  school_id: "test-school-1",
  date: "2024-12-31",
  time: "09:00:00",
  duration: 60,
  instructor: { first_name: "John", last_name: "Doe" },
  participants: [],
});

jest.mock("../src/services/lessons", () => ({
  getLessonsByRange: mockGetLessonsByRange,
  getLessonById: mockGetLessonById,
}));

// Import app after mocks
import app from "../src/index";

describe("GET /api/lessons", () => {
  it("should return 200 with lessons array", async () => {
    const res = await request(app)
      .get("/api/lessons")
      .query({
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should filter by instructorId", async () => {
    const res = await request(app)
      .get("/api/lessons")
      .query({
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        instructorId: "instructor-1",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should return 403 for SUPER_ADMIN without schoolId", async () => {
    // Change mock user for this test
    mockUser = {
      id: "test-user",
      role: "SUPER_ADMIN",
    } as any;

    const res = await request(app)
      .get("/api/lessons")
      .query({
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      });

    expect(res.status).toBe(403);
    
    // Reset mock user
    mockUser = {
      id: "test-user",
      schoolId: "test-school-1",
      role: "SCHOOL_ADMIN",
    };
  });
});

describe("GET /api/lessons/:id", () => {
  it("should return 200 with lesson details", async () => {
    const res = await request(app).get("/api/lessons/lesson-1");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe("lesson-1");
  });

  it("should return 404 for non-existent lesson", async () => {
    mockGetLessonById.mockRejectedValueOnce({
      statusCode: 404,
      message: "Lesson not found",
    });

    const res = await request(app).get("/api/lessons/non-existent");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
