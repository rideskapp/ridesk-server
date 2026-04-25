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
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: "product-new",
                title: "New Product",
                slug: "new-product",
                school_id: "test-school-1",
                price: 100,
              },
              error: null,
            }),
          }),
        }),
      };
      builder.then = async (resolve: any) => {
        resolve({ data: [], error: null });
      };
      return builder;
    }
    if (table === "product_categories") {
      return createQueryBuilder({
        id: "category-1",
        school_id: "test-school-1",
      });
    }
    if (table === "disciplines") {
      return createQueryBuilder({
        id: "discipline-1",
        school_id: "test-school-1",
      });
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

describe("POST /api/products", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SCHOOL_ADMIN";
    mockUser.schoolId = "test-school-1";
  });

  it("should create product successfully", async () => {
    const res = await request(app)
      .post("/api/products")
      .send({
        title: "New Product",
        category_id: "category-1",
        price: 100,
        price_type: "per_person",
        max_participants: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe("product-new");
  });

  it("should return 409 when slug already exists", async () => {
    const { supabaseAdmin } = require("../src/database/supabase");
    const originalFrom = supabaseAdmin.from;
    supabaseAdmin.from = jest.fn((table: string) => {
      if (table === "products") {
        const builder: any = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [{ id: "existing-product" }],
            error: null,
          }),
        };
        builder.then = async (resolve: any) => {
          resolve({ data: [{ id: "existing-product" }], error: null });
        };
        return builder;
      }
      return originalFrom(table);
    });

    const res = await request(app)
      .post("/api/products")
      .send({
        title: "Existing Product",
        category_id: "category-1",
        price: 100,
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("slug already exists");
    
    supabaseAdmin.from = originalFrom;
  });

  it("should return 400 when schoolId is missing for SCHOOL_ADMIN", async () => {
    mockUser.schoolId = undefined as any;

    const res = await request(app)
      .post("/api/products")
      .send({
        title: "New Product",
        category_id: "category-1",
        price: 100,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("School ID is required");
  });

  it("should allow SUPER_ADMIN to create product for any school", async () => {
    mockUser.role = "SUPER_ADMIN";
    mockUser.schoolId = "test-school-1";

    const res = await request(app)
      .post("/api/products")
      .send({
        title: "Super Admin Product",
        category_id: "category-1",
        price: 100,
        school_id: "test-school-1",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("should include slug in response", async () => {
    mockUser.role = "SCHOOL_ADMIN";
    mockUser.schoolId = "test-school-1";

    const res = await request(app)
      .post("/api/products")
      .send({
        title: "Product With Slug",
        category_id: "category-1",
        price: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBeDefined();
  });
});
