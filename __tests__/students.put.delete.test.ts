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
const mockUpdateStudent = jest.fn();
const mockDeleteStudent = jest.fn();

jest.mock("../src/services/students", () => ({
  updateStudent: (...args: any[]) => mockUpdateStudent(...args),
  deleteStudent: (...args: any[]) => mockDeleteStudent(...args),
}));

// Import app after mocks
import app from "../src/index";

describe("PUT /api/students/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SCHOOL_ADMIN";
    mockUser.schoolId = "test-school-1";
  });

  it("should update student successfully", async () => {
    mockUpdateStudent.mockResolvedValueOnce({
      id: "student-1",
      name: "Updated Name",
      email: "updated@example.com",
      school_id: "test-school-1",
    });

    const res = await request(app)
      .put("/api/students/student-1")
      .send({
        firstName: "Updated",
        lastName: "Name",
        email: "updated@example.com",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Updated Name");
  });

  it("should return 403 when schoolId is missing", async () => {
    mockUser.schoolId = undefined as any;

    const res = await request(app)
      .put("/api/students/student-1")
      .send({
        firstName: "Updated",
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("School ID is required");
  });

  it("should handle service errors", async () => {
    mockUser.schoolId = "test-school-1";
    mockUpdateStudent.mockRejectedValueOnce({
      statusCode: 404,
      message: "Student not found",
    });

    const res = await request(app)
      .put("/api/students/non-existent")
      .send({
        firstName: "Updated",
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("not found");
  });

  it("should return 400 for whitespace-only firstName on update", async () => {
    const res = await request(app).put("/api/students/student-1").send({
      firstName: "   ",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Validation failed");
  });
});

describe("DELETE /api/students/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SCHOOL_ADMIN";
    mockUser.schoolId = "test-school-1";
  });

  it("should delete student successfully", async () => {
    mockDeleteStudent.mockResolvedValueOnce({ success: true });

    const res = await request(app).delete("/api/students/student-1");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("deleted");
  });

  it("should handle service errors", async () => {
    mockDeleteStudent.mockRejectedValueOnce({
      statusCode: 404,
      message: "Student not found",
    });

    const res = await request(app).delete("/api/students/non-existent");

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("not found");
  });
});
