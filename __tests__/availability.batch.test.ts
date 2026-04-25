
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
}));

// Mock availability service
jest.mock("../src/services/availability", () => ({
  addBatchInstructorAvailability: jest.fn(),
  getBatchInstructorAvailability: jest.fn(),
}));

import { addBatchInstructorAvailability } from "../src/services/availability";

// Import app after mocks
import app from "../src/index";

describe("Batch Availability Endpoint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = "SCHOOL_ADMIN";
  });

  describe("POST /api/availability/batch", () => {
    it("Should successfully add batch availability", async () => {
      const instructorId = "instructor-123";
      const slots = [
        { date: "2024-02-10", timeStart: "09:00", timeEnd: "10:00" },
        { date: "2024-02-10", timeStart: "10:00", timeEnd: "11:00" },
      ];

      (addBatchInstructorAvailability as jest.Mock).mockResolvedValue([
        "id-1",
        "id-2",
      ]);

      const res = await request(app)
        .post("/api/availability/batch")
        .send({
          instructorId,
          slots,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ids).toHaveLength(2);
      expect(addBatchInstructorAvailability).toHaveBeenCalledWith(
        instructorId,
        slots,
      );
    });

    it("Should handle errors gracefully", async () => {
      (addBatchInstructorAvailability as jest.Mock).mockRejectedValue(
        new Error("Database error"),
      );

      const res = await request(app)
        .post("/api/availability/batch")
        .send({
          instructorId: "instructor-123",
          slots: [],
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
