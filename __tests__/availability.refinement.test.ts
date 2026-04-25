
import { addInstructorAvailability, addBatchInstructorAvailability } from "../src/services/availability";
import { supabaseAdmin } from "../src/database/supabase";

// Mock supabaseAdmin
jest.mock("../src/database/supabase", () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

describe("Availability Service Refinements", () => {
  let mockBuilder: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockBuilder = {
      select: jest.fn().mockImplementation((columns?: string) => {
        // Intermediate select calls return the builder
        if (columns) return mockBuilder;
        // Terminal select() calls return a promise
        return Promise.resolve({ data: [{ id: "new-id" }], error: null });
      }),
      insert: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
    };

    (supabaseAdmin.from as jest.Mock).mockReturnValue(mockBuilder);
  });

  describe("addInstructorAvailability Error Handling", () => {
    it("should throw AppError if initial check fails", async () => {
      const instructorId = "instructor-123";
      
      // Mock initial check failure
      mockBuilder.limit.mockResolvedValueOnce({ 
        data: null, 
        error: { message: "Database connection failed" } 
      });

      await expect(addInstructorAvailability(instructorId, "2024-02-10", "09:00", "10:00"))
        .rejects.toThrow("Failed to checking existing availability: Database connection failed");
    });

    it("should throw AppError if retry check fails", async () => {
      const instructorId = "instructor-123";
      
      // Mock initial check success (no existing)
      mockBuilder.limit.mockResolvedValueOnce({ data: [], error: null });
      
      // Mock insert failure (race condition)
      // Terminal select() in the insert chain will use the specific mock here
      mockBuilder.select.mockImplementation((columns?: string) => {
        if (columns) return mockBuilder;
        return Promise.resolve({ 
          data: null, 
          error: { code: '23505', message: 'Unique violation' } 
        });
      });
      
      // Mock retry check failure
      mockBuilder.limit.mockResolvedValueOnce({ 
        data: null, 
        error: { message: "Retry constraint check failed" } 
      });

      await expect(addInstructorAvailability(instructorId, "2024-02-10", "09:00", "10:00"))
        .rejects.toThrow("Failed to fetch availability on retry: Retry constraint check failed");
    });
  });

  describe("addBatchInstructorAvailability Deduplication", () => {
    it("should deduplicate slots before upserting but return mapped IDs", async () => {
      const instructorId = "instructor-123";
      const duplicateSlots = [
        { date: "2024-02-10", timeStart: "10:00", timeEnd: "11:00" },
        { date: "2024-02-10", timeStart: "10:00:00", timeEnd: "11:00:00" }, // Same normalized values
      ];

      // Mock upsert success
      mockBuilder.upsert.mockResolvedValueOnce({ error: null });
      
      // Mock fetch IDs success
      mockBuilder.in.mockResolvedValueOnce({
        data: [{ id: "deduped-id", date: "2024-02-10", time_start: "10:00:00", time_end: "11:00:00" }],
        error: null
      });

      const ids = await addBatchInstructorAvailability(instructorId, duplicateSlots);

      // Expect duplicate IDs because input had duplicate slots, even though DB operation was deduplicated
      expect(ids).toEqual(["deduped-id", "deduped-id"]);
      
      // Verify upsert was called with only one record (deduplication check)
      const upsertCalls = mockBuilder.upsert.mock.calls;
      expect(upsertCalls[0][0]).toHaveLength(1);
      
      expect(mockBuilder.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            date: "2024-02-10",
            time_start: "10:00:00",
            active: true
          })
        ]),
        expect.objectContaining({ ignoreDuplicates: false })
      );
    });
  });
});
