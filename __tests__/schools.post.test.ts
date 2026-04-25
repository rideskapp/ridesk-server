import request from "supertest";

// Mock user that can be changed per test
let mockUser = {
  id: "test-user",
  schoolId: "test-school-1",
  role: "SUPER_ADMIN",
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

// Mock schools service
const mockCreateSchool = jest.fn();

jest.mock("../src/services/schools", () => ({
  createSchool: (...args: any[]) => mockCreateSchool(...args),
}));

// Import app after mocks
import app from "../src/index";

describe("POST /api/schools", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SUPER_ADMIN";
  });

  it("should create school successfully", async () => {
    mockCreateSchool.mockResolvedValueOnce({
      id: "school-new",
      name: "New School",
      slug: "new-school",
      email: "info@newschool.com",
    });

    const res = await request(app)
      .post("/api/schools")
      .send({
        name: "New School",
        slug: "new-school",
        email: "info@newschool.com",
        phone: "+1234567890",
        address: "123 Main St",
        openHoursStart: "09:00",
        openHoursEnd: "18:00",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe("school-new");
  });

  it("should handle service errors", async () => {
    mockCreateSchool.mockRejectedValueOnce({
      statusCode: 409,
      message: "School with this slug already exists",
    });

    const res = await request(app)
      .post("/api/schools")
      .send({
        name: "New School",
        slug: "existing-slug",
        email: "info@newschool.com",
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("already exists");
  });

  it("should allow SCHOOL_ADMIN to create school", async () => {
    mockUser.role = "SCHOOL_ADMIN";
    mockCreateSchool.mockResolvedValueOnce({
      id: "school-new",
      name: "New School",
      slug: "new-school",
    });

    // Mock the auth service import
    jest.mock("../src/services/auth", () => ({
      updateUserSchool: jest.fn().mockResolvedValue(undefined),
    }));

    const res = await request(app)
      .post("/api/schools")
      .send({
        name: "New School",
        slug: "new-school",
        email: "info@newschool.com",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("should handle database errors", async () => {
    mockCreateSchool.mockRejectedValueOnce({
      statusCode: 500,
      message: "Database connection failed",
    });

    const res = await request(app)
      .post("/api/schools")
      .send({
        name: "New School",
        slug: "new-school",
        email: "info@newschool.com",
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Database");
  });

  it("should handle duplicate slug errors", async () => {
    mockCreateSchool.mockRejectedValueOnce({
      statusCode: 409,
      message: "School slug already exists",
    });

    const res = await request(app)
      .post("/api/schools")
      .send({
        name: "Duplicate School",
        slug: "existing-slug",
        email: "info@duplicate.com",
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("slug");
  });
});
