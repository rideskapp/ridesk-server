/**
 * @file Reproduction test for instructor deactivate + re-add bug
 * @description Tests the scenario:
 *   1. Add instructor to school
 *   2. Deactivate instructor (sets is_active=false in instructor_schools)
 *   3. Try to re-add instructor to same school
 *
 * BUG: Step 3 fails with "Instructor is already associated with this school"
 *      because the route checks for existingLink but doesn't check is_active status.
 *
 * FIX: Should either:
 *   - Check for existingLink with is_active=true only, OR
 *   - If existingLink exists with is_active=false, reactivate it instead of erroring
 */
import request from "supertest";

// Mock user for testing
let mockUser = {
  id: "test-admin-user",
  firstName: "Test",
  lastName: "Admin",
  schoolId: "test-school-id",
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
  createInstructorSchema: {},
  createInstructorBySchoolAdminSchema: {},
  updateInstructorSchema: {},
  paginationSchema: {},
  searchSchema: {},
}));

// Mock instructors service
jest.mock("../src/services/instructors", () => ({
  createInstructorBySchoolAdmin: jest.fn(),
  deleteInstructor: jest.fn(),
  getInstructorById: jest.fn(),
  getAllInstructors: jest.fn(),
  updateInstructor: jest.fn(),
  searchInstructors: jest.fn(),
  getInstructorStats: jest.fn(),
}));

// Track mock state
let existingAuthUser: any = null;
let existingInstructor: any = null;
let instructorSchoolLink: any = null;

// Mock Supabase - this simulates the database behavior
jest.mock("../src/database/supabase", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        listUsers: jest.fn().mockImplementation(() => ({
          data: {
            users: existingAuthUser ? [existingAuthUser] : [],
          },
          error: null,
        })),
      },
    },
    from: jest.fn((table: string) => {
      if (table === "users") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockImplementation(() => ({
            data: existingInstructor,
            error: existingInstructor ? null : { message: "Not found" },
          })),
          update: jest.fn().mockReturnThis(),
        };
      }
      if (table === "instructor_schools") {
        const queryBuilder = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockImplementation(() => ({
            data: instructorSchoolLink,
            error: instructorSchoolLink ? null : { message: "Not found" },
          })),
          insert: jest.fn().mockImplementation((data: any) => {
            instructorSchoolLink = Array.isArray(data) ? { ...data[0] } : { ...data };
            if (!instructorSchoolLink.id) instructorSchoolLink.id = "new-link-id";
            return queryBuilder;
          }),
          update: jest.fn().mockImplementation((data: any) => {
            if (instructorSchoolLink) {
              Object.assign(instructorSchoolLink, data);
            }
            return queryBuilder;
          }),
        };
        return queryBuilder;
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
      };
    }),
  },
}));

// Import app after mocks
import app from "../src/index";

describe("Instructor Deactivate + Re-add Bug Reproduction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SCHOOL_ADMIN";
    mockUser.schoolId = "test-school-id";

    // Reset mock state
    existingAuthUser = null;
    existingInstructor = null;
    instructorSchoolLink = null;
  });

  describe("Scenario: Deactivate then re-add instructor to same school", () => {
    it("Should reactivate instructor when re-adding after deactivation (previously failed with error)", async () => {
      // Setup: Simulate an instructor who was previously added then deactivated
      const instructorEmail = "john.instructor@example.com";
      const instructorId = "instructor-123";
      const schoolId = "test-school-id";

      // 1. Instructor exists in auth.users
      existingAuthUser = {
        id: instructorId,
        email: instructorEmail,
      };

      // 2. Instructor exists in users table with INSTRUCTOR role
      existingInstructor = {
        id: instructorId,
        first_name: "John",
        last_name: "Instructor",
        role: "INSTRUCTOR",
        is_active: true, // User record is still active
      };

      // 3. Instructor-school link exists but is_active=false (was deactivated)
      instructorSchoolLink = {
        id: "link-123",
        instructor_id: instructorId,
        school_id: schoolId,
        is_active: false, // KEY: This was set to false by deleteInstructor
        is_primary: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Try to re-add the instructor
      const res = await request(app)
        .post("/api/instructors/school-admin")
        .send({
          firstName: "John",
          lastName: "Instructor",
          email: instructorEmail,
          specialties: ["kite"],
          languages: ["English"],
        });

      // After fix, this should return 200 with success and reactivation message
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("reactivated");
      expect(instructorSchoolLink.is_active).toBe(true);
    });

  });

  describe("Scenario: Adding instructor with no prior link", () => {
    it("Should successfully add instructor when no prior link exists", async () => {
      const instructorEmail = "new.instructor@example.com";
      const instructorId = "instructor-456";

      existingAuthUser = {
        id: instructorId,
        email: instructorEmail,
      };

      existingInstructor = {
        id: instructorId,
        first_name: "New",
        last_name: "Instructor",
        role: "INSTRUCTOR",
        is_active: true,
      };

      // No existing link
      instructorSchoolLink = null;

      // Try to add the instructor
      const res = await request(app)
        .post("/api/instructors/school-admin")
        .send({
          firstName: "New",
          lastName: "Instructor",
          email: instructorEmail,
          specialties: ["surf"],
          languages: ["Spanish"],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(instructorSchoolLink).not.toBeNull();
      expect(instructorSchoolLink.instructor_id).toBe(instructorId);
      expect(instructorSchoolLink.is_active).toBe(true);
    });
  });
});

/**
 * This test verifies that re-adding a deactivated instructor to a school
 * correctly reactivates their existing instructor_schools link.
 *
 * The relevant implementation logic in src/routes/instructors.ts should
 * check for existing links and set is_active: true if an inactive link is found,
 * rather than returning an error.
 */
