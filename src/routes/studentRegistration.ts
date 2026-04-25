import { Router } from "express";
import Joi from "joi";
import { validate } from "../middleware/validation";
import {
  getStudentRegistrationContext,
  registerOrLinkStudentPublic,
} from "../services/studentRegistration";

const router = Router();

const publicStudentRegistrationSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  firstName: Joi.string().trim().min(2).max(50).required(),
  lastName: Joi.string().trim().min(2).max(50).required(),
  whatsappNumber: Joi.string().trim().min(10).max(20).required(),
  dateOfBirth: Joi.string().isoDate().optional().allow("", null),
  emergencyContact: Joi.string().max(100).optional().allow("", null),
  emergencyPhone: Joi.string().min(10).max(20).optional().allow("", null),
  medicalConditions: Joi.string().max(1000).optional().allow("", null),
  skillLevel: Joi.string().trim().min(1).max(50).required(),
  preferredDisciplines: Joi.array().items(Joi.string()).min(1).required(),
  nationality: Joi.string().max(100).optional().allow("", null),
  weight: Joi.number().min(20).max(200).optional().allow(null),
  height: Joi.number().min(50).max(250).optional().allow(null),
  canSwim: Joi.boolean().optional().allow(null),
  primarySport: Joi.string()
    .valid("surf", "kitesurf", "wingfoil", "foil")
    .optional()
    .allow("", null),
  ridingBackground: Joi.string().max(1000).optional().allow("", null),
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
    .required(),
  consentPhysicalCondition: Joi.boolean().optional(),
  consentTermsConditions: Joi.boolean().optional(),
  consentGdpr: Joi.boolean().optional(),
  consentPhotosVideos: Joi.boolean().optional(),
  consentMarketing: Joi.boolean().optional(),
  consentCustom1: Joi.boolean().optional().allow(null),
  consentCustom2: Joi.boolean().optional().allow(null),
  arrivalDate: Joi.string().isoDate().optional().allow("", null),
  departureDate: Joi.string().isoDate().optional().allow("", null),
  stayNotes: Joi.string().max(1000).optional().allow("", null),
  notes: Joi.string().max(1000).optional().allow("", null),
});

router.get("/:schoolIdentifier", async (req, res, next) => {
  try {
    const context = await getStudentRegistrationContext(
      req.params["schoolIdentifier"]!,
    );
    return res.json({
      success: true,
      data: context,
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/:schoolIdentifier",
  validate(publicStudentRegistrationSchema),
  async (req, res, next) => {
    try {
      const result = await registerOrLinkStudentPublic(
        req.params["schoolIdentifier"]!,
        req.body,
      );
      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
