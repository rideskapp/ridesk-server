import request from "supertest";

const mockRegisterOrLinkStudentPublic = jest.fn();
const mockSubmitStudentForm = jest.fn();

jest.mock("../src/services/studentRegistration", () => ({
  getStudentRegistrationContext: jest.fn(),
  registerOrLinkStudentPublic: (...args: any[]) =>
    mockRegisterOrLinkStudentPublic(...args),
}));

jest.mock("../src/services/studentForm", () => ({
  getStudentFormByToken: jest.fn(),
  submitStudentForm: (...args: any[]) => mockSubmitStudentForm(...args),
}));

import app from "../src/index";

describe("Public student routes validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects whitespace firstName in student registration", async () => {
    const res = await request(app).post("/api/student-registration/demo-school").send({
      email: "student@example.com",
      firstName: "   ",
      lastName: "Doe",
      whatsappNumber: "+12345678901",
      skillLevel: "beginner",
      preferredDisciplines: ["kite"],
      preferredLanguage: ["en"],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Validation failed");
  });

  it("rejects whitespace firstName in student form submit", async () => {
    const res = await request(app).post("/api/student-form/submit").send({
      token: "token-123",
      firstName: "   ",
      lastName: "Doe",
      whatsappNumber: "+12345678901",
      skillLevel: "beginner",
      preferredDisciplines: ["kite"],
      preferredLanguage: ["en"],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Validation failed");
  });
});
