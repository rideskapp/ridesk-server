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

// Mock schools service
const mockGetAllSchools = jest.fn();
const mockGetSchoolById = jest.fn();
const mockGetSchoolBySlug = jest.fn();
const mockGetSchoolByUserId = jest.fn();
const mockSearchSchools = jest.fn();

jest.mock("../src/services/schools", () => ({
  getAllSchools: (...args: any[]) => mockGetAllSchools(...args),
  getSchoolById: (...args: any[]) => mockGetSchoolById(...args),
  getSchoolBySlug: (...args: any[]) => mockGetSchoolBySlug(...args),
  getSchoolByUserId: (...args: any[]) => mockGetSchoolByUserId(...args),
  searchSchools: (...args: any[]) => mockSearchSchools(...args),
}));

// Import app after mocks
import app from "../src/index";

describe("GET /api/schools", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 with schools array", async () => {
    mockGetAllSchools.mockResolvedValueOnce({
      schools: [
        { id: "school-1", name: "School 1", slug: "school-1" },
        { id: "school-2", name: "School 2", slug: "school-2" },
      ],
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });

    const res = await request(app).get("/api/schools");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it("should support pagination", async () => {
    mockGetAllSchools.mockResolvedValueOnce({
      schools: [{ id: "school-1", name: "School 1" }],
      pagination: { page: 2, limit: 5, total: 10, totalPages: 2 },
    });

    const res = await request(app).get("/api/schools?page=2&limit=5");

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.limit).toBe(5);
  });
});

describe("GET /api/schools/search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SUPER_ADMIN";
  });

  it("should return search results", async () => {
    mockSearchSchools.mockResolvedValueOnce({
      schools: [
        { id: "school-1", name: "Test School", slug: "test-school" },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    const res = await request(app).get("/api/schools/search?q=test");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe("GET /api/schools/slug/:slug", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 with school by slug", async () => {
    mockGetSchoolBySlug.mockResolvedValueOnce({
      id: "school-1",
      name: "Test School",
      slug: "test-school",
    });

    const res = await request(app).get("/api/schools/slug/test-school");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slug).toBe("test-school");
  });

  it("should return 404 for non-existent slug", async () => {
    mockGetSchoolBySlug.mockRejectedValueOnce({
      statusCode: 404,
      message: "School not found",
    });

    const res = await request(app).get("/api/schools/slug/non-existent");

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("not found");
  });
});
