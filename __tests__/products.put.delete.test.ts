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
        neq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: "product-1",
            title: "Test Product",
            school_id: "test-school-1",
            price: 100,
          },
          error: null,
        }),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: "product-1",
            title: "Test Product",
            school_id: "test-school-1",
            price: 100,
          },
          error: null,
        }),
        update: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: "product-1",
                title: "Updated Product",
                school_id: "test-school-1",
              },
              error: null,
            }),
          }),
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: "product-1",
                  title: "Updated Product",
                },
                error: null,
              }),
            }),
          }),
        }),
        delete: jest.fn().mockReturnThis(),
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

describe("PUT /api/products/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SCHOOL_ADMIN";
    mockUser.schoolId = "test-school-1";
  });

  it("should update product successfully", async () => {
    const res = await request(app)
      .put("/api/products/product-1")
      .send({
        title: "Updated Product",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe("Updated Product");
  });

  it("should return 404 for non-existent product", async () => {
    const { supabaseAdmin } = require("../src/database/supabase");
    const originalFrom = supabaseAdmin.from;
    supabaseAdmin.from = jest.fn((table: string) => {
      if (table === "products") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: "Not found" },
          }),
        };
      }
      return originalFrom(table);
    });

    const res = await request(app)
      .put("/api/products/non-existent")
      .send({
        title: "Updated Product",
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("not found");
    
    supabaseAdmin.from = originalFrom;
  });

  it("should return 403 when SCHOOL_ADMIN tries to update product from another school", async () => {
    const { supabaseAdmin } = require("../src/database/supabase");
    const originalFrom = supabaseAdmin.from;
    supabaseAdmin.from = jest.fn((table: string) => {
      if (table === "products") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: "product-1",
              school_id: "different-school",
            },
            error: null,
          }),
        };
      }
      return originalFrom(table);
    });

    const res = await request(app)
      .put("/api/products/product-1")
      .send({
        title: "Updated Product",
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Access denied");
    
    supabaseAdmin.from = originalFrom;
  });
});

describe("DELETE /api/products/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SCHOOL_ADMIN";
    mockUser.schoolId = "test-school-1";
  });

  it("should delete product successfully", async () => {
    const { supabaseAdmin } = require("../src/database/supabase");
    const originalFrom = supabaseAdmin.from;
    supabaseAdmin.from = jest.fn((table: string) => {
      if (table === "products") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              id: "product-1",
              school_id: "test-school-1",
            },
            error: null,
          }),
          delete: jest.fn().mockReturnThis(),
        };
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
          resolve({ data: [], error: null });
        };
        return builder;
      }
      return originalFrom(table);
    });

    const res = await request(app).delete("/api/products/product-1");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    
    supabaseAdmin.from = originalFrom;
  });

  it("should return 404 for non-existent product", async () => {
    const { supabaseAdmin } = require("../src/database/supabase");
    const originalFrom = supabaseAdmin.from;
    supabaseAdmin.from = jest.fn((table: string) => {
      if (table === "products") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: "Not found" },
          }),
        };
      }
      return originalFrom(table);
    });

    const res = await request(app).delete("/api/products/non-existent");

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("not found");
    
    supabaseAdmin.from = originalFrom;
  });
});
