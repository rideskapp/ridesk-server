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

// Mock instructors service
const mockGetAllInstructors = jest.fn();
const mockGetInstructorById = jest.fn();
const mockSearchInstructors = jest.fn();
const mockGetInstructorStats = jest.fn();

jest.mock("../src/services/instructors", () => ({
  getAllInstructors: (...args: any[]) => mockGetAllInstructors(...args),
  getInstructorById: (...args: any[]) => mockGetInstructorById(...args),
  searchInstructors: (...args: any[]) => mockSearchInstructors(...args),
  getInstructorStats: (...args: any[]) => mockGetInstructorStats(...args),
}));

// Import app after mocks
import app from "../src/index";

describe("GET /api/instructors", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 with instructors array", async () => {
    mockGetAllInstructors.mockResolvedValueOnce({
      instructors: [
        { id: "instructor-1", name: "John Instructor", email: "john@example.com" },
        { id: "instructor-2", name: "Jane Instructor", email: "jane@example.com" },
      ],
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });

    const res = await request(app).get("/api/instructors");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.instructors)).toBe(true);
    expect(res.body.data.instructors).toHaveLength(2);
  });

  it("should support pagination", async () => {
    mockGetAllInstructors.mockResolvedValueOnce({
      instructors: [{ id: "instructor-1", name: "John" }],
      pagination: { page: 2, limit: 5, total: 10, totalPages: 2 },
    });

    const res = await request(app).get("/api/instructors?page=2&limit=5");

    expect(res.status).toBe(200);
    expect(res.body.data.pagination.page).toBe(2);
  });
});

describe("GET /api/instructors/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SCHOOL_ADMIN";
    mockUser.schoolId = "test-school-1";
  });

  it("should return 200 with instructor details", async () => {
    mockGetInstructorById.mockResolvedValueOnce({
      id: "instructor-1",
      name: "John Instructor",
      email: "john@example.com",
      school_id: "test-school-1",
    });

    const res = await request(app).get("/api/instructors/instructor-1");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe("instructor-1");
  });

  it("should return 404 for non-existent instructor", async () => {
    mockGetInstructorById.mockRejectedValueOnce({
      statusCode: 404,
      message: "Instructor not found",
    });

    const res = await request(app).get("/api/instructors/non-existent");

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("not found");
  });
});

describe("GET /api/instructors/search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SCHOOL_ADMIN";
    mockUser.schoolId = "test-school-1";
  });

  it("should return search results", async () => {
    mockSearchInstructors.mockResolvedValueOnce({
      instructors: [
        { id: "instructor-1", name: "John Instructor", email: "john@example.com" },
      ],
    });

    const res = await request(app).get("/api/instructors/search?q=john");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.instructors)).toBe(true);
  });
});
