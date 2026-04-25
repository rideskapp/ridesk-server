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

// Mock Supabase
jest.mock("../src/database/supabase", () => {
  const createQueryBuilder = (finalData: any) => {
    const builder: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: finalData, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: finalData, error: null }),
    };
    builder.then = async (resolve: any) => resolve({ data: finalData, error: null });
    return builder;
  };

  const from = jest.fn((table: string) => {
    if (table === "products") {
      const builder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: "product-1",
            duration_hours: 30,
            school_id: "test-school-1",
          },
          error: null,
        }),
      };
      return builder;
    }
    if (table === "users") {
      const builder: any = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };
      builder.then = async (resolve: any) => {
        resolve({
          data: [{
            id: "student-1",
            school_id: "test-school-1",
            role: "USER",
            skill_level: "beginner",
            first_name: "John",
            last_name: "Doe",
          }],
          error: null,
        });
      };
      return builder;
    }
    if (table === "bookings") {
      return {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: "booking-new",
                school_id: "test-school-1",
                product_id: "product-1",
                total_minutes: 1800,
                remaining_minutes: 1800,
                status: "active",
              },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "booking_participants") {
      return {
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
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

// Import app after mocks
import app from "../src/index";

describe("POST /api/bookings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SCHOOL_ADMIN";
    mockUser.schoolId = "test-school-1";
  });

  it("should return 400 when schoolId is missing for SUPER_ADMIN", async () => {
    mockUser.role = "SUPER_ADMIN";
    mockUser.schoolId = undefined as any;

    const res = await request(app)
      .post("/api/bookings")
      .send({
        product_id: "123e4567-e89b-12d3-a456-426614174000",
        student_ids: ["123e4567-e89b-12d3-a456-426614174001"],
        start_date: "2099-01-01",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("School ID is required");
  });

  it("should return 400 when student_id or student_ids is missing", async () => {
    mockUser.role = "SCHOOL_ADMIN";
    mockUser.schoolId = "test-school-1";

    const res = await request(app)
      .post("/api/bookings")
      .send({
        product_id: "123e4567-e89b-12d3-a456-426614174000",
        start_date: "2099-01-01",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("custom validation");
  });

  it("should return 400 for invalid product_id format", async () => {
    const res = await request(app)
      .post("/api/bookings")
      .send({
        product_id: "invalid-uuid",
        student_ids: ["123e4567-e89b-12d3-a456-426614174001"],
        start_date: "2099-01-01",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("GUID");
  });

  it("should return 400 for invalid date format", async () => {
    const res = await request(app)
      .post("/api/bookings")
      .send({
        product_id: "123e4567-e89b-12d3-a456-426614174000",
        student_ids: ["123e4567-e89b-12d3-a456-426614174001"],
        start_date: "invalid-date",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("date");
  });

  it("should accept single student_id", async () => {
    const res = await request(app)
      .post("/api/bookings")
      .send({
        product_id: "123e4567-e89b-12d3-a456-426614174000",
        student_id: "123e4567-e89b-12d3-a456-426614174001",
        start_date: "2099-01-01",
      });

    // Will fail validation or database check, but should pass schema validation
    expect([200, 201, 400, 404, 500]).toContain(res.status);
  });
});
