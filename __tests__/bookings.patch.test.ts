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
    if (table === "bookings") {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: "booking-1",
            school_id: "test-school-1",
            product_id: "product-1",
            total_minutes: 1800,
            remaining_minutes: 1200,
            status: "active",
          },
          error: null,
        }),
        update: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: "booking-1",
                status: "active",
                remaining_minutes: 1500,
              },
              error: null,
            }),
          }),
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: "booking-1",
                  status: "active",
                  remaining_minutes: 1500,
                },
                error: null,
              }),
            }),
          }),
        }),
      };
    }
    if (table === "booking_participants") {
      return {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
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
          }],
          error: null,
        });
      };
      return builder;
    }
    if (table === "lessons") {
      const builder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
      builder.then = async (resolve: any) => {
        resolve({
          data: [],
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

describe("PATCH /api/bookings/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SCHOOL_ADMIN";
    mockUser.schoolId = "test-school-1";
  });

  it("should return 400 when schoolId is missing for SUPER_ADMIN", async () => {
    mockUser.role = "SUPER_ADMIN";
    mockUser.schoolId = undefined as any;

    const res = await request(app)
      .patch("/api/bookings/booking-1")
      .send({
        notes: "Updated notes",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("School ID is required");
  });

  it("should return 400 when update body is empty", async () => {
    const res = await request(app)
      .patch("/api/bookings/booking-1")
      .send({});

    expect(res.status).toBe(400);
  });

  it("should return 404 for non-existent booking", async () => {
    // Mock booking query to return null
    const { supabaseAdmin } = require("../src/database/supabase");
    const originalFrom = supabaseAdmin.from;
    supabaseAdmin.from = jest.fn((table: string) => {
      if (table === "bookings") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        };
      }
      return originalFrom(table);
    });

    const res = await request(app)
      .patch("/api/bookings/non-existent")
      .send({
        notes: "Updated notes",
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("not found");
    
    supabaseAdmin.from = originalFrom;
  });

  it("should validate student_ids format", async () => {
    const res = await request(app)
      .patch("/api/bookings/booking-1")
      .send({
        student_ids: ["invalid-uuid"],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("GUID");
  });

  it("should validate date format", async () => {
    const res = await request(app)
      .patch("/api/bookings/booking-1")
      .send({
        start_date: "invalid-date",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("date");
  });
});
