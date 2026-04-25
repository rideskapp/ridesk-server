import { Router } from "express";
import Joi from "joi";
import { validate } from "../middleware/validation";
import { AppError } from "../types";
import {
  getStudentFormByToken,
  submitStudentForm,
} from "../services/studentForm";

const router = Router();

const submitStudentFormSchema = Joi.object({
  token: Joi.string().trim().required(),
  firstName: Joi.string().trim().min(2).max(50).required().messages({
    "string.min": "First name must be at least 2 characters long",
    "string.max": "First name must not exceed 50 characters",
    "any.required": "First name is required",
  }),
  lastName: Joi.string().trim().min(2).max(50).required().messages({
    "string.min": "Last name must be at least 2 characters long",
    "string.max": "Last name must not exceed 50 characters",
    "any.required": "Last name is required",
  }),
  phone: Joi.string().min(10).max(20).allow("", null).optional(),
  whatsappNumber: Joi.string().trim().min(10).max(20).required().messages({
    "string.min": "WhatsApp number must be at least 10 characters long",
    "string.max": "WhatsApp number must not exceed 20 characters",
    "any.required": "WhatsApp number is required",
  }),
  dateOfBirth: Joi.string().isoDate().allow("", null).optional(),
  emergencyContact: Joi.string().max(100).allow("", null).optional(),
  emergencyPhone: Joi.string().min(10).max(20).allow("", null).optional(),
  medicalConditions: Joi.string().max(1000).allow("", null).optional(),
  skillLevel: Joi.string().trim().min(1).max(50).required().messages({
    "string.min": "Skill level must be at least 1 character long",
    "string.max": "Skill level must not exceed 50 characters",
    "any.required": "Skill level is required",
  }),
  preferredDisciplines: Joi.array()
    .items(Joi.string())
    .min(1)
    .required()
    .messages({
      "array.min": "At least one preferred discipline must be selected",
      "any.required": "Preferred disciplines are required",
    }),
  nationality: Joi.string().max(100).optional().allow(null, ""),
  weight: Joi.number().min(20).max(200).optional().allow(null),
  height: Joi.number().min(50).max(250).optional().allow(null),
  canSwim: Joi.boolean().optional().allow(null),
  primarySport: Joi.string()
    .valid("surf", "kitesurf", "wingfoil", "foil")
    .optional()
    .allow(null, ""),
  ridingBackground: Joi.string().max(1000).optional().allow(null, ""),
  preferredDays: Joi.array()
    .items(
      Joi.string().valid(
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ),
    )
    .optional()
    .allow(null),
  preferredTimeSlots: Joi.array()
    .items(Joi.string().valid("morning", "afternoon"))
    .optional()
    .allow(null),
  preferredLessonTypes: Joi.array()
    .items(Joi.string().valid("private", "semi-private", "group"))
    .optional()
    .allow(null),
  preferredLanguage: Joi.array()
    .items(Joi.string().min(1).max(50))
    .min(1)
    .required()
    .messages({
      "array.min": "Preferred language is required",
      "any.required": "Preferred language is required",
    }),
  arrivalDate: Joi.string().isoDate().optional().allow(null, "").messages({
    "string.isoDate": "Arrival date must be a valid date",
  }),
  departureDate: Joi.string()
    .isoDate()
    .optional()
    .allow(null, "")
    .custom((value, helpers) => {
      const { arrivalDate } = helpers.state.ancestors[0];
      if (value && arrivalDate && value.trim() && arrivalDate.trim()) {
        const arrival = new Date(arrivalDate);
        const departure = new Date(value);
        if (arrival > departure) {
          return helpers.error("any.custom", {
            message: "Departure date must be after arrival date",
          });
        }
      }
      return value;
    })
    .messages({
      "string.isoDate": "Departure date must be a valid date",
      "any.custom": "Departure date must be after arrival date",
    }),
  stayNotes: Joi.string().max(1000).optional().allow(null, ""),
  notes: Joi.string().max(1000).optional().allow(null, ""),
  consentPhysicalCondition: Joi.boolean().optional().default(true),
  consentTermsConditions: Joi.boolean().optional().default(true),
  consentGdpr: Joi.boolean().optional().default(true),
  consentPhotosVideos: Joi.boolean().optional().default(false),
  consentMarketing: Joi.boolean().optional().default(false),
  consentCustom1: Joi.boolean().optional().allow(null),
  consentCustom2: Joi.boolean().optional().allow(null),
});

/**
 * @swagger
 * /api/student-form/validate/{token}:
 *   get:
 *     summary: Validate student form token
 *     description: Check if a student form token is valid and get student data. This is a public endpoint that does not require authentication.
 *     tags: [Student Form]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Form token from invitation
 *         example: "abc123def456ghi789"
 *     responses:
 *       200:
 *         description: Token is valid and student data returned
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         student:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                               format: uuid
 *                             email:
 *                               type: string
 *                             first_name:
 *                               type: string
 *                             last_name:
 *                               type: string
 *                         formSubmitted:
 *                           type: boolean
 *                           description: "Whether the form has already been submitted"
 *                         formSubmittedAt:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                           description: "Timestamp when form was submitted (null if not submitted)"
 *             example:
 *               success: true
 *               data:
 *                 student:
 *                   id: "123e4567-e89b-12d3-a456-426614174000"
 *                   email: "student@example.com"
 *                   first_name: "John"
 *                   last_name: "Doe"
 *                 formSubmitted: false
 *                 formSubmittedAt: null
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/validate/:token", async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token) {
      throw new AppError("Token is required", 400);
    }

    const result = await getStudentFormByToken(token);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/student-form/submit:
 *   post:
 *     summary: Submit student form
 *     description: Submit the student information form. Can only be submitted once per token. This is a public endpoint that does not require authentication.
 *     tags: [Student Form]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, firstName, lastName, whatsappNumber, skillLevel, preferredDisciplines, preferredLanguage]
 *             properties:
 *               token:
 *                 type: string
 *                 example: "abc123def456"
 *                 description: "Form token from invitation"
 *               firstName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: "Doe"
 *               phone:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 20
 *                 nullable: true
 *                 example: "+1234567890"
 *               whatsappNumber:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 20
 *                 example: "+1234567890"
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 example: "1990-01-01"
 *               emergencyContact:
 *                 type: string
 *                 maxLength: 100
 *                 nullable: true
 *                 example: "Jane Doe"
 *               emergencyPhone:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 20
 *                 nullable: true
 *                 example: "+1234567891"
 *               medicalConditions:
 *                 type: string
 *                 maxLength: 1000
 *                 nullable: true
 *                 example: "None"
 *               skillLevel:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 example: "beginner"
 *               preferredDisciplines:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                 example: ["kite", "surf"]
 *               nationality:
 *                 type: string
 *                 maxLength: 100
 *                 nullable: true
 *                 example: "US"
 *               weight:
 *                 type: number
 *                 minimum: 20
 *                 maximum: 200
 *                 nullable: true
 *                 example: 75
 *               height:
 *                 type: number
 *                 minimum: 50
 *                 maximum: 250
 *                 nullable: true
 *                 example: 180
 *               canSwim:
 *                 type: boolean
 *                 nullable: true
 *                 example: true
 *               primarySport:
 *                 type: string
 *                 enum: ["surf", "kitesurf", "wingfoil", "foil"]
 *                 nullable: true
 *                 example: "kitesurf"
 *               ridingBackground:
 *                 type: string
 *                 maxLength: 1000
 *                 nullable: true
 *                 example: "5 years of experience"
 *               preferredDays:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
 *                 nullable: true
 *                 example: ["monday", "wednesday", "friday"]
 *               preferredTimeSlots:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: ["morning", "afternoon"]
 *                 nullable: true
 *                 example: ["morning"]
 *               preferredLessonTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: ["private", "semi-private", "group"]
 *                 nullable: true
 *                 example: ["private"]
 *               preferredLanguage:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                 example: ["English", "Italian"]
 *               arrivalDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 example: "2024-06-01"
 *               departureDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 example: "2024-06-15"
 *                 description: "Must be after arrivalDate if both are provided"
 *               stayNotes:
 *                 type: string
 *                 maxLength: 1000
 *                 nullable: true
 *                 example: "Staying at hotel near beach"
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 nullable: true
 *                 example: "Additional notes"
 *               consentPhysicalCondition:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *               consentTermsConditions:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *               consentGdpr:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *               consentPhotosVideos:
 *                 type: boolean
 *                 default: false
 *                 example: false
 *               consentMarketing:
 *                 type: boolean
 *                 default: false
 *                 example: false
 *           example:
 *             token: "abc123def456"
 *             firstName: "John"
 *             lastName: "Doe"
 *             whatsappNumber: "+1234567890"
 *             dateOfBirth: "1990-01-01"
 *             skillLevel: "beginner"
 *             preferredDisciplines: ["kite", "surf"]
 *             preferredLanguage: ["English", "Italian"]
 *     responses:
 *       200:
 *         description: Form submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Student'
 *                     message:
 *                       type: string
 *                       example: "Student information updated successfully"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: Form has already been submitted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/submit",
  validate(submitStudentFormSchema),
  async (req, res, next) => {
    try {
      const { token, ...formData } = req.body;

      if (!token) {
        throw new AppError("Token is required", 400);
      }

      const updatedStudent = await submitStudentForm(token, formData);

      res.json({
        success: true,
        data: updatedStudent,
        message: "Student information updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
