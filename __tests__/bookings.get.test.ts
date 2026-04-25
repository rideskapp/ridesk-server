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
      order: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: finalData, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: finalData, error: null }),
    };
    // Make it thenable and return paginated data
    builder.then = async (resolve: any) => {
      const data = Array.isArray(finalData) ? finalData : [finalData];
      resolve({ data, error: null });
    };
    // Support range() for pagination
    builder.range = jest.fn().mockReturnThis();
    return builder;
  };

  const from = jest.fn((table: string) => {
    if (table === "bookings") {
      const builder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: "booking-1",
            school_id: "test-school-1",
            product_id: "product-1",
            total_minutes: 1800,
            remaining_minutes: 1200,
            status: "active",
            products: { id: "product-1", title: "Test Product" },
          },
          error: null,
        }),
      };
      builder.then = async (resolve: any) => {
        resolve({
          data: [{
            id: "booking-1",
            school_id: "test-school-1",
            product_id: "product-1",
            total_minutes: 1800,
            remaining_minutes: 1200,
            status: "active",
            products: { id: "product-1", title: "Test Product" },
          }],
          error: null,
        });
      };
      return builder;
    }
    if (table === "users") {
      return createQueryBuilder({ id: "student-1", school_id: "test-school-1" });
    }
    if (table === "booking_participants") {
      const builder: any = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };
      builder.then = async (resolve: any) => {
        resolve({
          data: [{ booking_id: "booking-1", id: "participant-1", student_id: "student-1", users: { first_name: "John", last_name: "Doe" } }],
          error: null,
        });
      };
      // Also support direct await
      builder.eq = jest.fn((column: string, value: any) => {
        builder.then = async (resolve: any) => {
          resolve({
            data: [{ booking_id: "booking-1", id: "participant-1", student_id: "student-1", users: { first_name: "John", last_name: "Doe" } }],
            error: null,
          });
        };
        return builder;
      });
      return builder;
    }
    if (table === "lessons") {
      const builder: any = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [{ booking_id: "booking-1" }],
          error: null,
        }),
      };
      builder.then = async (resolve: any) => {
        resolve({
          data: [{ booking_id: "booking-1" }],
          error: null,
        });
      };
      return builder;
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

describe("GET /api/bookings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 with bookings array", async () => {
    const res = await request(app).get("/api/bookings");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.bookings).toBeDefined();
    expect(Array.isArray(res.body.data.bookings)).toBe(true);
  });

  it("should support pagination", async () => {
    const res = await request(app).get("/api/bookings?page=1&limit=5");

    expect(res.status).toBe(200);
    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.pagination.page).toBe(1);
    expect(res.body.data.pagination.limit).toBe(5);
  });

  it("should filter by status", async () => {
    const res = await request(app).get("/api/bookings?status=active");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should filter by productId", async () => {
    const res = await request(app).get("/api/bookings?productId=product-1");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should return 400 when schoolId is missing for SUPER_ADMIN", async () => {
    mockUser.role = "SUPER_ADMIN";
    mockUser.schoolId = undefined as any;

    const res = await request(app).get("/api/bookings");

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("School ID is required");
  });
});
