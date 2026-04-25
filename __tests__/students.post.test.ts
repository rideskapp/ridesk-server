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

// Mock students service
const mockCreateStudent = jest.fn();
const mockCreateStudentBySchoolAdmin = jest.fn();

jest.mock("../src/services/students", () => ({
  createStudent: (...args: any[]) => mockCreateStudent(...args),
  createStudentBySchoolAdmin: (...args: any[]) => mockCreateStudentBySchoolAdmin(...args),
}));

// Import app after mocks
import app from "../src/index";

describe("POST /api/students", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SUPER_ADMIN";
    mockUser.schoolId = "test-school-1";
  });

  it("should create student successfully", async () => {
    mockCreateStudent.mockResolvedValueOnce({
      id: "student-new",
      name: "New Student",
      email: "new@example.com",
      school_id: "test-school-1",
    });

    const res = await request(app)
      .post("/api/students?schoolId=test-school-1")
      .send({
        schoolId: "123e4567-e89b-12d3-a456-426614174000",
        firstName: "New",
        lastName: "Student",
        email: "new@example.com",
        whatsappNumber: "+12345678901",
        studentLevelId: "223e4567-e89b-12d3-a456-426614174000",
        skillLevel: "beginner",
        preferredDisciplines: ["kite"],
        preferredLanguage: ["en"],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe("student-new");
  });

  it("should return 403 when schoolId is missing for SUPER_ADMIN", async () => {
    const res = await request(app)
      .post("/api/students")
      .send({
        schoolId: "123e4567-e89b-12d3-a456-426614174000",
        firstName: "New",
        lastName: "Student",
        email: "new@example.com",
        whatsappNumber: "+12345678901",
        studentLevelId: "223e4567-e89b-12d3-a456-426614174000",
        skillLevel: "beginner",
        preferredDisciplines: ["kite"],
        preferredLanguage: ["en"],
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("School ID is required");
  });
});

describe("POST /api/students/school-admin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SCHOOL_ADMIN";
    mockUser.schoolId = "test-school-1";
  });

  it("should create student by school admin successfully", async () => {
    // Mock supabase auth to return no existing users
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

    mockCreateStudentBySchoolAdmin.mockResolvedValueOnce({
      id: "student-new",
      name: "New Student",
      email: "new@example.com",
      school_id: "test-school-1",
    });

    const res = await request(app)
      .post("/api/students/school-admin")
      .send({
        firstName: "New",
        lastName: "Student",
        email: "new@example.com",
        whatsappNumber: "+12345678901",
        skillLevel: "beginner",
        preferredDisciplines: ["kite"],
        preferredLanguage: ["en"],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("should return 403 when schoolId is missing", async () => {
    mockUser.schoolId = undefined as any;

    const res = await request(app)
      .post("/api/students/school-admin")
      .send({
        firstName: "New",
        lastName: "Student",
        email: "new@example.com",
        whatsappNumber: "+12345678901",
        skillLevel: "beginner",
        preferredDisciplines: ["kite"],
        preferredLanguage: ["en"],
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("School ID is required");
  });

  it("should handle service errors", async () => {
    mockUser.schoolId = "test-school-1";
    mockCreateStudentBySchoolAdmin.mockRejectedValueOnce({
      statusCode: 400,
      message: "Email already exists",
    });

    const res = await request(app)
      .post("/api/students/school-admin")
      .send({
        firstName: "New",
        lastName: "Student",
        email: "existing@example.com",
        whatsappNumber: "+12345678901",
        skillLevel: "beginner",
        preferredDisciplines: ["kite"],
        preferredLanguage: ["en"],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("already exists");
  });

  it("should return 400 for whitespace-only required fields", async () => {
    const res = await request(app).post("/api/students/school-admin").send({
      firstName: "   ",
      lastName: "Student",
      email: "new@example.com",
      whatsappNumber: "+12345678901",
      skillLevel: "beginner",
      preferredDisciplines: ["kite"],
      preferredLanguage: ["en"],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Validation failed");
  });
});
