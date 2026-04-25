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
const mockUpdateInstructor = jest.fn();
const mockDeleteInstructor = jest.fn();

jest.mock("../src/services/instructors", () => ({
  updateInstructor: (...args: any[]) => mockUpdateInstructor(...args),
  deleteInstructor: (...args: any[]) => mockDeleteInstructor(...args),
}));

// Import app after mocks
import app from "../src/index";

describe("PUT /api/instructors/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SCHOOL_ADMIN";
    mockUser.schoolId = "test-school-1";
  });

  it("should update instructor successfully", async () => {
    mockUpdateInstructor.mockResolvedValueOnce({
      id: "instructor-1",
      name: "Updated Name",
      email: "updated@example.com",
      school_id: "test-school-1",
    });

    const res = await request(app)
      .put("/api/instructors/instructor-1")
      .send({
        name: "Updated Name",
        email: "updated@example.com",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Updated Name");
  });

  it("should return 403 when schoolId is missing", async () => {
    mockUser.schoolId = undefined as any;

    const res = await request(app)
      .put("/api/instructors/instructor-1")
      .send({
        name: "Updated Name",
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("School ID is required");
  });

  it("should handle service errors", async () => {
    mockUser.schoolId = "test-school-1";
    mockUpdateInstructor.mockRejectedValueOnce({
      statusCode: 404,
      message: "Instructor not found",
    });

    const res = await request(app)
      .put("/api/instructors/non-existent")
      .send({
        name: "Updated Name",
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("not found");
  });
});

describe("DELETE /api/instructors/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SCHOOL_ADMIN";
    mockUser.schoolId = "test-school-1";
  });

  it("should delete instructor successfully", async () => {
    mockDeleteInstructor.mockResolvedValueOnce({ success: true });

    const res = await request(app).delete("/api/instructors/instructor-1");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("deactivated");
  });

  it("should handle service errors", async () => {
    mockDeleteInstructor.mockRejectedValueOnce({
      statusCode: 404,
      message: "Instructor not found",
    });

    const res = await request(app).delete("/api/instructors/non-existent");

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("not found");
  });
});
