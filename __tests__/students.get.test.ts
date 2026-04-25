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

// Mock students service
const mockGetAllStudents = jest.fn();
const mockGetStudentById = jest.fn();
const mockSearchStudents = jest.fn();

jest.mock("../src/services/students", () => ({
  getAllStudents: (...args: any[]) => mockGetAllStudents(...args),
  getStudentById: (...args: any[]) => mockGetStudentById(...args),
  searchStudents: (...args: any[]) => mockSearchStudents(...args),
}));

// Import app after mocks
import app from "../src/index";

describe("GET /api/students", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 with students array", async () => {
    mockGetAllStudents.mockResolvedValueOnce({
      students: [
        { id: "student-1", name: "John Doe", email: "john@example.com" },
        { id: "student-2", name: "Jane Smith", email: "jane@example.com" },
      ],
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      failures: [],
    });

    const res = await request(app).get("/api/students");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.students)).toBe(true);
    expect(res.body.data.students).toHaveLength(2);
  });

  it("should support pagination with page and limit", async () => {
    mockGetAllStudents.mockResolvedValueOnce({
      students: [{ id: "student-1", name: "John Doe" }],
      pagination: { page: 2, limit: 5, total: 10, totalPages: 2 },
      failures: [],
    });

    const res = await request(app).get("/api/students?page=2&limit=5");

    expect(res.status).toBe(200);
    expect(res.body.data.pagination.page).toBe(2);
    expect(res.body.data.pagination.limit).toBe(5);
  });

  it("should return 403 when schoolId is missing for SUPER_ADMIN", async () => {
    mockUser.role = "SUPER_ADMIN";
    mockUser.schoolId = undefined as any;

    const res = await request(app).get("/api/students");

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("School ID is required");
  });
});

describe("GET /api/students/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SCHOOL_ADMIN";
    mockUser.schoolId = "test-school-1";
  });

  it("should return 200 with student details", async () => {
    mockGetStudentById.mockResolvedValueOnce({
      id: "student-1",
      name: "John Doe",
      email: "john@example.com",
      school_id: "test-school-1",
    });

    const res = await request(app).get("/api/students/student-1");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe("student-1");
    expect(res.body.data.name).toBe("John Doe");
  });

  it("should return 404 for non-existent student", async () => {
    mockGetStudentById.mockRejectedValueOnce({
      statusCode: 404,
      message: "Student not found",
    });

    const res = await request(app).get("/api/students/non-existent");

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("not found");
  });
});

describe("GET /api/students/search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SCHOOL_ADMIN";
    mockUser.schoolId = "test-school-1";
  });

  it("should return search results", async () => {
    mockSearchStudents.mockResolvedValueOnce({
      students: [
        { id: "student-1", name: "John Doe", email: "john@example.com" },
      ],
      failures: [],
    });

    const res = await request(app).get("/api/students/search?q=john");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.students)).toBe(true);
    expect(res.body.data.students).toHaveLength(1);
  });
});
