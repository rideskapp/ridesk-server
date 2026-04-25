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
const mockCreateInstructorBySchoolAdmin = jest.fn();

jest.mock("../src/services/instructors", () => ({
  createInstructorBySchoolAdmin: (...args: any[]) => mockCreateInstructorBySchoolAdmin(...args),
}));

// Mock Supabase
jest.mock("../src/database/supabase", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        listUsers: jest.fn().mockResolvedValue({
          data: { users: [] },
          error: null,
        }),
      },
    },
    from: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

// Import app after mocks
import app from "../src/index";

describe("POST /api/instructors", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SCHOOL_ADMIN";
    mockUser.schoolId = "test-school-1";
  });

  it("should create instructor successfully", async () => {
    mockCreateInstructorBySchoolAdmin.mockResolvedValueOnce({
      instructor: {
        id: "instructor-new",
        name: "New Instructor",
        email: "new@example.com",
        school_id: "test-school-1",
      },
      message: "Instructor created successfully",
    });

    const res = await request(app)
      .post("/api/instructors")
      .send({
        name: "New Instructor",
        email: "new@example.com",
        phone: "1234567890",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe("instructor-new");
  });

  it("should return 403 when schoolId is missing", async () => {
    mockUser.schoolId = undefined as any;

    const res = await request(app)
      .post("/api/instructors")
      .send({
        name: "New Instructor",
        email: "new@example.com",
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("School ID is required");
  });

  it("should handle service errors", async () => {
    mockUser.schoolId = "test-school-1";
    mockCreateInstructorBySchoolAdmin.mockRejectedValueOnce({
      statusCode: 400,
      message: "Email already exists",
    });

    const res = await request(app)
      .post("/api/instructors")
      .send({
        name: "New Instructor",
        email: "existing@example.com",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("already exists");
  });
});

describe("POST /api/instructors/school-admin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SCHOOL_ADMIN";
    mockUser.schoolId = "test-school-1";
  });

  it("should create instructor by school admin successfully", async () => {
    mockCreateInstructorBySchoolAdmin.mockResolvedValueOnce({
      instructor: {
        id: "instructor-new",
        name: "New Instructor",
        email: "new@example.com",
      },
      message: "Instructor created successfully",
    });

    const res = await request(app)
      .post("/api/instructors/school-admin")
      .send({
        name: "New Instructor",
        email: "new@example.com",
        phone: "1234567890",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("should return 403 when schoolId is missing for school-admin endpoint", async () => {
    mockUser.schoolId = undefined as any;

    const res = await request(app)
      .post("/api/instructors/school-admin")
      .send({
        name: "New Instructor",
        email: "new@example.com",
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("School ID is required");
  });
});
