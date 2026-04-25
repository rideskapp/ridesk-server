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
        order: jest.fn().mockReturnThis(),
      };
      builder.then = async (resolve: any) => {
        resolve({
          data: [{
            id: "product-1",
            title: "Test Product",
            school_id: "test-school-1",
            price: 100,
            active: true,
          }],
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

describe("GET /api/products", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 with products array", async () => {
    const res = await request(app).get("/api/products");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should filter by category_id", async () => {
    const res = await request(app).get("/api/products?category_id=cat-1");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should filter by discipline_id", async () => {
    const res = await request(app).get("/api/products?discipline_id=disc-1");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should return 400 when schoolId is missing for SUPER_ADMIN", async () => {
    mockUser.role = "SUPER_ADMIN";
    mockUser.schoolId = undefined as any;

    const res = await request(app).get("/api/products");

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("School ID is required");
  });

  it("should return products for specific school when schoolId provided", async () => {
    mockUser.role = "SUPER_ADMIN";
    mockUser.schoolId = "test-school-1";

    const res = await request(app).get("/api/products?schoolId=test-school-1");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
