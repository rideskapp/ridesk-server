/**
 * @fileoverview Request validation middleware
 * @description Joi-based validation for API endpoints
 * @author Ridesk Team
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { ValidationError } from "../types";

/**
 * Generic validation middleware factory
 * @param schema - Joi schema
 * @param property - Request property to validate (body, query, params)
 * @returns Middleware function
 */
export const validate = (
  schema: Joi.ObjectSchema,
  property: "body" | "query" | "params" = "body",
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[property];
      if (data && typeof data === "object") {
        const processedData = { ...data };
        if (processedData.weight === "") {
          processedData.weight = null;
        }
        if (processedData.height === "") {
          processedData.height = null;
        }
        if (
          processedData.canSwim === "" ||
          processedData.canSwim === null ||
          processedData.canSwim === undefined ||
          typeof processedData.canSwim !== "boolean"
        ) {
          delete processedData.canSwim; //remove canSwim unless it is a proper boolean
        }
        req[property] = processedData;
      }

      const { error, value } = schema.validate(req[property], {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const errors: Record<string, string[]> = {};

        error.details.forEach((detail) => {
          const field = detail.path.join(".");
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(detail.message);
        });

        throw new ValidationError("Validation failed", errors);
      }

      // Replace the original property with validated and sanitized data
      req[property] = value;
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: error.message,
          errors: error.errors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: "Validation failed",
      });
    }
  };
};

// ============================================================================
// AUTHENTICATION VALIDATION SCHEMAS
// ============================================================================

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  password: Joi.string().min(6).required().messages({
    "string.min": "Password must be at least 6 characters long",
    "any.required": "Password is required",
  }),
});

export const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  // Optional: if omitted, server will generate a temporary password
  password: Joi.string().min(6).optional().messages({
    "string.min": "Password must be at least 6 characters long",
  }),
  firstName: Joi.string().min(2).max(50).required().messages({
    "string.min": "First name must be at least 2 characters long",
    "string.max": "First name must not exceed 50 characters",
    "any.required": "First name is required",
  }),
  lastName: Joi.string().min(2).max(50).required().messages({
    "string.min": "Last name must be at least 2 characters long",
    "string.max": "Last name must not exceed 50 characters",
    "any.required": "Last name is required",
  }),
  role: Joi.string()
    .valid("SUPER_ADMIN", "SCHOOL_ADMIN", "INSTRUCTOR", "USER")
    .required()
    .messages({
      "any.only":
        "Role must be one of: SUPER_ADMIN, SCHOOL_ADMIN, INSTRUCTOR, USER",
      "any.required": "Role is required",
    }),
  schoolId: Joi.string().uuid().optional().messages({
    "string.guid": "School ID must be a valid UUID",
  }),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    "any.required": "Refresh token is required",
  }),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    "any.required": "Current password is required",
  }),
  newPassword: Joi.string().min(6).required().messages({
    "string.min": "New password must be at least 6 characters long",
    "any.required": "New password is required",
  }),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
});

export const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  otp: Joi.string()
    .length(6)
    .pattern(/^[0-9]{6}$/)
    .required()
    .messages({
      "string.length": "OTP must be exactly 6 digits",
      "string.pattern.base": "OTP must contain only numbers",
      "any.required": "OTP is required",
    }),
  newPassword: Joi.string().min(6).required().messages({
    "string.min": "New password must be at least 6 characters long",
    "any.required": "New password is required",
  }),
  confirmPassword: Joi.string()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({
      "any.only": "Passwords do not match",
      "any.required": "Please confirm your password",
    }),
});

// ============================================================================
// SCHOOL VALIDATION SCHEMAS
// ============================================================================

export const createSchoolSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    "string.min": "School name must be at least 2 characters long",
    "string.max": "School name must not exceed 100 characters",
    "any.required": "School name is required",
  }),
  slug: Joi.alternatives()
    .try(
      Joi.string()
        .min(2)
        .max(50)
        .pattern(/^[a-z0-9-]+$/),
      Joi.string().allow("", null),
      Joi.allow(null),
    )
    .optional()
    .messages({
      "string.min": "Slug must be at least 2 characters long",
      "string.max": "Slug must not exceed 50 characters",
      "string.pattern.base":
        "Slug can only contain lowercase letters, numbers, and hyphens",
      "alternatives.match": "Slug must be a valid string or empty",
    }),
  logo: Joi.string().uri().optional().messages({
    "string.uri": "Logo must be a valid URL",
  }),
  email: Joi.string().email().optional().messages({
    "string.email": "Please provide a valid email address",
  }),
  phone: Joi.string().min(10).max(20).optional().messages({
    "string.min": "Phone number must be at least 10 characters long",
    "string.max": "Phone number must not exceed 20 characters",
  }),
  address: Joi.string().max(500).optional().messages({
    "string.max": "Address must not exceed 500 characters",
  }),
  website: Joi.string().uri().optional().messages({
    "string.uri": "Website must be a valid URL",
  }),
  spotName: Joi.string().max(100).optional().messages({
    "string.max": "Spot name must not exceed 100 characters",
  }),
  windguruUrl: Joi.string().uri().optional().messages({
    "string.uri": "Windguru URL must be a valid URL",
  }),
  disciplines: Joi.array().items(Joi.string()).optional().allow(null),
  openHoursStart: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)
    .optional()
    .messages({
      "string.pattern.base":
        "Open hours start must be in HH:MM or HH:MM:SS format",
    }),
  openHoursEnd: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)
    .optional()
    .messages({
      "string.pattern.base":
        "Open hours end must be in HH:MM or HH:MM:SS format",
    }),
});

export const updateSchoolSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional().allow(""),
  slug: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[a-z0-9-]+$/)
    .optional()
    .allow(""),
  logo: Joi.string().uri().optional().allow(null, ""),
  email: Joi.string().email().optional().allow(null, ""),
  phone: Joi.string().min(10).max(20).optional().allow(null, ""),
  address: Joi.string().max(500).optional().allow(null, ""),
  website: Joi.string().uri().optional().allow(null, ""),
  spotName: Joi.string().max(100).optional().allow(null, ""),
  windguruUrl: Joi.string().uri().optional().allow(null, ""),
  disciplines: Joi.array().items(Joi.string()).optional().allow(null),
  openHoursStart: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)
    .optional()
    .allow(null, "")
    .messages({
      "string.pattern.base":
        "Open hours start must be in HH:MM or HH:MM:SS format",
    }),
  openHoursEnd: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)
    .optional()
    .allow(null)
    .messages({
      "string.pattern.base":
        "Open hours end must be in HH:MM or HH:MM:SS format",
    }),
  defaultLessonStatusId: Joi.string().uuid().optional().allow(null, ""),
  defaultPaymentStatusId: Joi.string().uuid().optional().allow(null, ""),
});

// ============================================================================
// SCHOOL SETTINGS VALIDATION SCHEMAS
// ============================================================================

export const updateSchoolSettingsSchema = Joi.object({
  lessonColorScheme: Joi.string()
    .valid("discipline", "student_level", "category")
    .optional()
    .messages({
      "any.only":
        "Lesson color scheme must be one of: discipline, student_level, category",
    }),
  customColorOverrides: Joi.object().optional().allow(null),
  compensationMode: Joi.string()
    .valid("fixed", "variable")
    .optional()
    .messages({
      "any.only": "Compensation mode must be one of: fixed, variable",
    }),
  defaultCurrency: Joi.string()
    .valid(
      "EUR",
      "USD",
      "GBP",
      "AUD",
      "CAD",
      "CHF",
      "BRL",
      "MXN",
      "ZAR",
      "MAD",
      "AED",
      "TRY",
      "NOK",
      "SEK",
      "DKK",
      "PLN",
      "CZK",
      "HUF",
      "IDR",
      "THB",
      "PHP",
      "VND",
      "LKR",
      "CRC",
      "DOP",
    )
    .optional()
    .messages({
      "any.only": "Default currency is not supported",
    }),
  // Consent settings
  termsConditionsUrl: Joi.string().optional().allow(null, ""),
  termsConditionsLabel: Joi.object().optional().allow(null),
  customCheckbox1Enabled: Joi.boolean().optional(),
  customCheckbox1Label: Joi.object().optional().allow(null),
  customCheckbox1Url: Joi.string().optional().allow(null, ""),
  customCheckbox1Mandatory: Joi.boolean().optional(),
  customCheckbox2Enabled: Joi.boolean().optional(),
  customCheckbox2Label: Joi.object().optional().allow(null),
  customCheckbox2Url: Joi.string().optional().allow(null, ""),
  customCheckbox2Mandatory: Joi.boolean().optional(),
});

// ============================================================================
// INSTRUCTOR VALIDATION SCHEMAS
// ============================================================================

export const createInstructorSchema = Joi.object({
  schoolId: Joi.string().uuid().required().messages({
    "string.guid": "School ID must be a valid UUID",
    "any.required": "School ID is required",
  }),
  firstName: Joi.string().min(2).max(50).required().messages({
    "string.min": "First name must be at least 2 characters long",
    "string.max": "First name must not exceed 50 characters",
    "any.required": "First name is required",
  }),
  lastName: Joi.string().min(2).max(50).required().messages({
    "string.min": "Last name must be at least 2 characters long",
    "string.max": "Last name must not exceed 50 characters",
    "any.required": "Last name is required",
  }),
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  whatsappNumber: Joi.string()
    .min(10)
    .max(20)
    .optional()
    .allow("", null)
    .messages({
      "string.min": "WhatsApp number must be at least 10 characters long",
      "string.max": "WhatsApp number must not exceed 20 characters",
    }),
  avatar: Joi.string().uri().optional().messages({
    "string.uri": "Avatar must be a valid URL",
  }),
  specialties: Joi.array().items(Joi.string()).min(1).required().messages({
    "array.min": "At least one specialty must be selected",
    "any.required": "Specialties are required",
  }),
  languages: Joi.array()
    .items(Joi.string().min(2).max(50))
    .min(1)
    .required()
    .messages({
      "array.min": "At least one language must be selected",
      "any.required": "Languages are required",
    }),
  notes: Joi.string().max(1000).allow("").optional().messages({
    "string.max": "Notes must not exceed 1000 characters",
  }),
});

export const createInstructorBySchoolAdminSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required().messages({
    "string.min": "First name must be at least 2 characters long",
    "string.max": "First name must not exceed 50 characters",
    "any.required": "First name is required",
  }),
  lastName: Joi.string().min(2).max(50).required().messages({
    "string.min": "Last name must be at least 2 characters long",
    "string.max": "Last name must not exceed 50 characters",
    "any.required": "Last name is required",
  }),
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  whatsappNumber: Joi.string()
    .min(10)
    .max(20)
    .optional()
    .allow("", null)
    .messages({
      "string.min": "WhatsApp number must be at least 10 characters long",
      "string.max": "WhatsApp number must not exceed 20 characters",
    }),
  avatar: Joi.string().uri().optional().messages({
    "string.uri": "Avatar must be a valid URL",
  }),
  specialties: Joi.array().items(Joi.string()).min(1).required().messages({
    "array.min": "At least one specialty must be selected",
    "any.required": "Specialties are required",
  }),
  certifications: Joi.array()
    .items(Joi.string().min(2).max(100))
    .optional()
    .messages({
      "string.min": "Certification must be at least 2 characters long",
      "string.max": "Certification must not exceed 100 characters",
    }),
  languages: Joi.array()
    .items(Joi.string().min(2).max(50))
    .min(1)
    .required()
    .messages({
      "array.min": "At least one language must be selected",
      "any.required": "Languages are required",
    }),
  notes: Joi.string().max(1000).allow("").optional().messages({
    "string.max": "Notes must not exceed 1000 characters",
  }),
  isPrimary: Joi.boolean().optional(),
});

export const updateInstructorProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required().messages({
    "string.min": "First name must be at least 2 characters long",
    "string.max": "First name must not exceed 50 characters",
    "any.required": "First name is required",
  }),
  lastName: Joi.string().min(2).max(50).required().messages({
    "string.min": "Last name must be at least 2 characters long",
    "string.max": "Last name must not exceed 50 characters",
    "any.required": "Last name is required",
  }),
  whatsappNumber: Joi.string()
    .min(10)
    .max(20)
    .optional()
    .allow("", null)
    .messages({
      "string.min": "WhatsApp number must be at least 10 characters long",
      "string.max": "WhatsApp number must not exceed 20 characters",
    }),
  avatar: Joi.string().uri().optional().allow("", null).messages({
    "string.uri": "Avatar must be a valid URL",
  }),
  specialties: Joi.array().items(Joi.string()).optional().allow(null),
  certifications: Joi.array().items(Joi.string()).optional().allow(null),
  languages: Joi.array()
    .items(Joi.string().min(2).max(50))
    .optional()
    .allow(null),
  notes: Joi.string().max(1000).optional().allow(null, ""),
  isActive: Joi.boolean().optional(),
});

export const updateInstructorSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional().allow(""),
  lastName: Joi.string().min(2).max(50).optional().allow(""),
  email: Joi.string().email().optional().allow(""),
  whatsappNumber: Joi.string().min(10).max(20).optional().allow("").messages({
    "string.min": "WhatsApp number must be at least 10 characters long",
    "string.max": "WhatsApp number must not exceed 20 characters",
  }),
  avatar: Joi.string().uri().optional().allow("", null).messages({
    "string.uri": "Avatar must be a valid URL",
  }),
  specialties: Joi.array().items(Joi.string()).optional().allow(null),
  certifications: Joi.array().items(Joi.string()).optional().allow(null),
  languages: Joi.array()
    .items(Joi.string().min(2).max(50))
    .optional()
    .allow(null),
  hourlyRate: Joi.number().min(0).optional().allow(null),
  commissionRate: Joi.number().min(0).max(100).optional().allow(null),
  isPrimary: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
});

// ============================================================================
// STUDENT VALIDATION SCHEMAS
// ============================================================================

export const createStudentSchema = Joi.object({
  schoolId: Joi.string().uuid().required().messages({
    "string.guid": "School ID must be a valid UUID",
    "any.required": "School ID is required",
  }),
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
  email: Joi.string().trim().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  phoneNumber: Joi.string()
    .min(10)
    .max(20)
    .optional()
    .allow("", null)
    .messages({
      "string.min": "Phone number must be at least 10 characters long",
      "string.max": "Phone number must not exceed 20 characters",
    }),
  whatsappNumber: Joi.string().trim().min(10).max(20).required().messages({
    "string.min": "WhatsApp number must be at least 10 characters long",
    "string.max": "WhatsApp number must not exceed 20 characters",
    "any.required": "WhatsApp number is required",
  }),
  avatar: Joi.string().uri().optional().messages({
    "string.uri": "Avatar must be a valid URL",
  }),
  studentLevelId: Joi.string().trim().uuid().required().messages({
    "string.guid": "Student level ID must be a valid UUID",
    "any.required": "Student level is required",
  }),
  preferredLanguage: Joi.array()
    .items(Joi.string().min(1).max(50))
    .optional(),
  secondaryLanguage: Joi.string().min(2).max(50).optional(),
  specialNeeds: Joi.array()
    .items(Joi.string().valid("child", "elderly", "disability", "other"))
    .optional(),
  specialNeedsOther: Joi.string().max(500).optional(),
  notes: Joi.string().max(1000).optional().allow(null, "").messages({
    "string.max": "Notes must not exceed 1000 characters",
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
  stayNotes: Joi.string().max(1000).optional().allow(null, "").messages({
    "string.max": "Stay notes must not exceed 1000 characters",
  }),
  height: Joi.number().min(50).max(250).optional(),
  weight: Joi.number().min(20).max(200).optional(),
});

// Schema for school admin student creation (without schoolId and studentLevelId)
export const createStudentBySchoolAdminSchema = Joi.object({
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
  email: Joi.string().trim().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  phone: Joi.string().min(10).max(20).optional().messages({
    "string.min": "Phone number must be at least 10 characters long",
    "string.max": "Phone number must not exceed 20 characters",
  }),
  whatsappNumber: Joi.string().trim().min(10).max(20).required().messages({
    "string.min": "WhatsApp number must be at least 10 characters long",
    "string.max": "WhatsApp number must not exceed 20 characters",
    "any.required": "WhatsApp number is required",
  }),
  dateOfBirth: Joi.string().isoDate().optional().messages({
    "string.isoDate": "Date of birth must be a valid date",
  }),
  emergencyContact: Joi.string().max(100).optional().messages({
    "string.max": "Emergency contact name must not exceed 100 characters",
  }),
  emergencyPhone: Joi.string().min(10).max(20).optional().messages({
    "string.min": "Emergency phone must be at least 10 characters long",
    "string.max": "Emergency phone must not exceed 20 characters",
  }),
  medicalConditions: Joi.string().max(1000).optional().messages({
    "string.max": "Medical conditions must not exceed 1000 characters",
  }),
  skillLevel: Joi.string().trim().min(1).max(50).required().messages({
    "string.min": "Skill level must be at least 1 character long",
    "string.max": "Skill level must not exceed 50 characters",
    "any.required": "Skill level is required",
    "string.empty": "Skill level cannot be empty",
  }),
  preferredDisciplines: Joi.array()
    .items(Joi.string())
    .min(1)
    .required()
    .messages({
      "array.min": "At least one preferred discipline must be selected",
      "any.required": "Preferred disciplines are required",
    }),
  nationality: Joi.string().max(100).optional().messages({
    "string.max": "Nationality must not exceed 100 characters",
  }),
  weight: Joi.number().min(20).max(200).optional().allow(null).messages({
    "number.base": "Weight must be a number",
    "number.min": "Weight must be at least 20 kg",
    "number.max": "Weight must not exceed 200 kg",
  }),
  height: Joi.number().min(50).max(250).optional().allow(null).messages({
    "number.base": "Height must be a number",
    "number.min": "Height must be at least 50 cm",
    "number.max": "Height must not exceed 250 cm",
  }),
  canSwim: Joi.boolean().optional().allow(null).messages({
    "boolean.base": "Can swim must be true or false",
  }),
  primarySport: Joi.string()
    .valid("surf", "kitesurf", "wingfoil", "foil")
    .optional()
    .messages({
      "any.only":
        "Primary sport must be one of: surf, kitesurf, wingfoil, foil",
    }),
  ridingBackground: Joi.string().max(1000).optional().messages({
    "string.max": "Riding background must not exceed 1000 characters",
  }),
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
    .optional(),
  preferredTimeSlots: Joi.array()
    .items(Joi.string().valid("morning", "afternoon"))
    .optional(),
  preferredLessonTypes: Joi.array()
    .items(Joi.string().valid("private", "semi-private", "group"))
    .optional(),
  preferredLanguage: Joi.array()
    .items(Joi.string().min(1).max(50))
    .min(1)
    .required()
    .messages({
      "array.min": "Preferred language is required",
      "any.required": "Preferred language is required",
    }),
  consentPhysicalCondition: Joi.boolean().optional().default(true),
  consentTermsConditions: Joi.boolean().optional().default(true),
  consentGdpr: Joi.boolean().optional().default(true),
  consentPhotosVideos: Joi.boolean().optional().default(true),
  consentMarketing: Joi.boolean().optional().default(true),
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
  stayNotes: Joi.string().max(1000).optional().allow(null, "").messages({
    "string.max": "Stay notes must not exceed 1000 characters",
  }),
  notes: Joi.string().max(1000).optional().allow(null, "").messages({
    "string.max": "Notes must not exceed 1000 characters",
  }),
});

export const updateStudentSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).optional(),
  lastName: Joi.string().trim().min(2).max(50).optional(),
  email: Joi.string().trim().email().optional(),
  phone: Joi.string().min(10).max(20).optional().allow(""),
  whatsappNumber: Joi.string()
    .trim()
    .min(10)
    .max(20)
    .optional()
    .allow("", null)
    .messages({
      "string.min": "WhatsApp number must be at least 10 characters long",
      "string.max": "WhatsApp number must not exceed 20 characters",
    }),
  dateOfBirth: Joi.date().optional().allow(null, ""),
  emergencyContact: Joi.string().min(2).max(100).optional().allow(null, ""),
  emergencyPhone: Joi.string().min(10).max(20).optional().allow(null, ""),
  medicalConditions: Joi.string().max(500).optional().allow(null, ""),
  skillLevel: Joi.string().min(1).max(50).optional().allow("", null).messages({
    "string.min": "Skill level must be at least 1 character long",
    "string.max": "Skill level must not exceed 50 characters",
  }),
  preferredDisciplines: Joi.array()
    .items(Joi.string())
    .min(1)
    .optional()
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
    .optional()
    .allow(null),
  consentPhysicalCondition: Joi.boolean().optional(),
  consentTermsConditions: Joi.boolean().optional(),
  consentGdpr: Joi.boolean().optional(),
  consentPhotosVideos: Joi.boolean().optional(),
  consentMarketing: Joi.boolean().optional(),
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
  stayNotes: Joi.string().max(1000).optional().allow(null, "").messages({
    "string.max": "Stay notes must not exceed 1000 characters",
  }),
  notes: Joi.string().max(1000).optional().allow(null, "").messages({
    "string.max": "Notes must not exceed 1000 characters",
  }),
  isActive: Joi.boolean().optional(),
});

// ============================================================================
// PAGINATION VALIDATION SCHEMAS
// ============================================================================

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
  }),
  limit: Joi.number().integer().min(1).max(1000).default(10).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit must not exceed 1000",
  }),
  search: Joi.string().optional(),
  schoolId: Joi.string().uuid().optional(),
});

export const searchSchema = Joi.object({
  query: Joi.string().min(1).max(100).required().messages({
    "string.min": "Search query must be at least 1 character long",
    "string.max": "Search query must not exceed 100 characters",
    "any.required": "Search query is required",
  }),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

// DISCIPLINE VALIDATION SCHEMAS

export const createDisciplineSchema = Joi.object({
  name: Joi.string().min(2).max(50).required().messages({
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name must not exceed 50 characters",
    "any.required": "Name is required",
  }),
  slug: Joi.alternatives()
    .try(
      Joi.string()
        .min(2)
        .max(50)
        .pattern(/^[a-z0-9-]+$/),
      Joi.string().allow("", null),
      Joi.allow(null),
    )
    .optional()
    .messages({
      "string.min": "Slug must be at least 2 characters long",
      "string.max": "Slug must not exceed 50 characters",
      "string.pattern.base":
        "Slug can only contain lowercase letters, numbers, and hyphens",
      "alternatives.match": "Slug must be a valid string or empty",
    }),
  display_name: Joi.string()
    .min(2)
    .max(100)
    .optional()
    .allow("", null)
    .messages({
      "string.min": "Display name must be at least 2 characters long",
      "string.max": "Display name must not exceed 100 characters",
    }),
  icon: Joi.string().max(50).optional().allow("", null).messages({
    "string.max": "Icon must not exceed 50 characters",
  }),
  color: Joi.string()
    .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .optional()
    .messages({
      "string.pattern.base":
        "Color must be a valid hex color code (e.g., #3B82F6)",
    }),
  is_active: Joi.boolean().optional(),
  sort_order: Joi.number().integer().min(0).optional().messages({
    "number.base": "Sort order must be a number",
    "number.integer": "Sort order must be an integer",
    "number.min": "Sort order must be 0 or greater",
  }),
  school_id: Joi.string().uuid().optional().messages({
    "string.guid": "School ID must be a valid UUID",
  }),
});

export const updateDisciplineSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional().messages({
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name must not exceed 50 characters",
  }),
  slug: Joi.alternatives()
    .try(
      Joi.string()
        .min(2)
        .max(50)
        .pattern(/^[a-z0-9-]+$/),
      Joi.string().allow("", null),
      Joi.allow(null),
    )
    .optional()
    .messages({
      "string.min": "Slug must be at least 2 characters long",
      "string.max": "Slug must not exceed 50 characters",
      "string.pattern.base":
        "Slug can only contain lowercase letters, numbers, and hyphens",
      "alternatives.match": "Slug must be a valid string or empty",
    }),
  display_name: Joi.string().min(2).max(100).optional().messages({
    "string.min": "Display name must be at least 2 characters long",
    "string.max": "Display name must not exceed 100 characters",
  }),
  icon: Joi.string().max(50).optional().allow("", null).messages({
    "string.max": "Icon must not exceed 50 characters",
  }),
  color: Joi.string()
    .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .optional()
    .messages({
      "string.pattern.base":
        "Color must be a valid hex color code (e.g., #3B82F6)",
    }),
  is_active: Joi.boolean().optional(),
  sort_order: Joi.number().integer().min(0).optional().messages({
    "number.base": "Sort order must be a number",
    "number.integer": "Sort order must be an integer",
    "number.min": "Sort order must be 0 or greater",
  }),
});

// STUDENT LEVEL VALIDATION SCHEMAS

export const createStudentLevelSchema = Joi.object({
  name: Joi.string().min(2).max(50).required().messages({
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name must not exceed 50 characters",
    "any.required": "Name is required",
  }),
  slug: Joi.alternatives()
    .try(
      Joi.string()
        .min(2)
        .max(50)
        .pattern(/^[a-z0-9-]+$/),
      Joi.string().allow("", null),
      Joi.allow(null),
    )
    .optional()
    .messages({
      "string.min": "Slug must be at least 2 characters long",
      "string.max": "Slug must not exceed 50 characters",
      "string.pattern.base":
        "Slug can only contain lowercase letters, numbers, and hyphens",
      "alternatives.match": "Slug must be a valid string or empty",
    }),
  description: Joi.string().max(1000).optional().allow("", null).messages({
    "string.max": "Description must not exceed 1000 characters",
  }),
  color: Joi.string()
    .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .optional()
    .messages({
      "string.pattern.base":
        "Color must be a valid hex color code (e.g., #6B7280)",
    }),
  active: Joi.boolean().optional(),
  school_id: Joi.string().uuid().optional().messages({
    "string.guid": "School ID must be a valid UUID",
  }),
});

export const updateStudentLevelSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional().messages({
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name must not exceed 50 characters",
  }),
  slug: Joi.alternatives()
    .try(
      Joi.string()
        .min(2)
        .max(50)
        .pattern(/^[a-z0-9-]+$/),
      Joi.string().allow("", null),
      Joi.allow(null),
    )
    .optional()
    .messages({
      "string.min": "Slug must be at least 2 characters long",
      "string.max": "Slug must not exceed 50 characters",
      "string.pattern.base":
        "Slug can only contain lowercase letters, numbers, and hyphens",
      "alternatives.match": "Slug must be a valid string or empty",
    }),
  description: Joi.string().max(1000).optional().allow("", null).messages({
    "string.max": "Description must not exceed 1000 characters",
  }),
  color: Joi.string()
    .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .optional()
    .messages({
      "string.pattern.base":
        "Color must be a valid hex color code (e.g., #6B7280)",
    }),
  active: Joi.boolean().optional(),
});

// PRODUCT CATEGORY VALIDATION SCHEMAS

export const createProductCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name must not exceed 100 characters",
    "any.required": "Name is required",
  }),
  slug: Joi.alternatives()
    .try(
      Joi.string()
        .min(2)
        .max(50)
        .pattern(/^[a-z0-9-]+$/),
      Joi.string().allow("", null),
      Joi.allow(null),
    )
    .optional()
    .messages({
      "string.min": "Slug must be at least 2 characters long",
      "string.max": "Slug must not exceed 50 characters",
      "string.pattern.base":
        "Slug can only contain lowercase letters, numbers, and hyphens",
      "alternatives.match": "Slug must be a valid string or empty",
    }),
  color: Joi.string()
    .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .optional()
    .messages({
      "string.pattern.base":
        "Color must be a valid hex color code (e.g., #3B82F6)",
    }),
  default_max_participants: Joi.number().integer().min(1).optional().messages({
    "number.base": "Default max participants must be a number",
    "number.integer": "Default max participants must be an integer",
    "number.min": "Default max participants must be at least 1",
  }),
  active: Joi.boolean().optional(),
  associable_to_lessons: Joi.boolean().optional(),
  sort_order: Joi.number().integer().min(0).optional().messages({
    "number.base": "Sort order must be a number",
    "number.integer": "Sort order must be an integer",
    "number.min": "Sort order must be 0 or greater",
  }),
  order_position: Joi.number().integer().min(0).optional().messages({
    "number.base": "Order position must be a number",
    "number.integer": "Order position must be an integer",
    "number.min": "Order position must be 0 or greater",
  }),
  school_id: Joi.string().uuid().optional().messages({
    "string.guid": "School ID must be a valid UUID",
  }),
});

export const updateProductCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100).optional().messages({
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name must not exceed 100 characters",
  }),
  slug: Joi.alternatives()
    .try(
      Joi.string()
        .min(2)
        .max(50)
        .pattern(/^[a-z0-9-]+$/),
      Joi.string().allow("", null),
      Joi.allow(null),
    )
    .optional()
    .messages({
      "string.min": "Slug must be at least 2 characters long",
      "string.max": "Slug must not exceed 50 characters",
      "string.pattern.base":
        "Slug can only contain lowercase letters, numbers, and hyphens",
      "alternatives.match": "Slug must be a valid string or empty",
    }),
  color: Joi.string()
    .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .optional()
    .messages({
      "string.pattern.base":
        "Color must be a valid hex color code (e.g., #3B82F6)",
    }),
  default_max_participants: Joi.number().integer().min(1).optional().messages({
    "number.base": "Default max participants must be a number",
    "number.integer": "Default max participants must be an integer",
    "number.min": "Default max participants must be at least 1",
  }),
  active: Joi.boolean().optional(),
  associable_to_lessons: Joi.boolean().optional(),
  sort_order: Joi.number().integer().min(0).optional().messages({
    "number.base": "Sort order must be a number",
    "number.integer": "Sort order must be an integer",
    "number.min": "Sort order must be 0 or greater",
  }),
  order_position: Joi.number().integer().min(0).optional().messages({
    "number.base": "Order position must be a number",
    "number.integer": "Order position must be an integer",
    "number.min": "Order position must be 0 or greater",
  }),
});

// PRODUCT VALIDATION SCHEMAS

export const createProductSchema = Joi.object({
  title: Joi.string().min(2).max(255).required().messages({
    "string.min": "Title must be at least 2 characters long",
    "string.max": "Title must not exceed 255 characters",
    "any.required": "Title is required",
  }),
  slug: Joi.string()
    .min(2)
    .max(255)
    .pattern(/^[a-z0-9-]+$/)
    .optional()
    .messages({
      "string.min": "Slug must be at least 2 characters long",
      "string.max": "Slug must not exceed 255 characters",
      "string.pattern.base":
        "Slug can only contain lowercase letters, numbers, and hyphens",
    }),
  category_id: Joi.string().uuid().required().messages({
    "string.guid": "Category ID must be a valid UUID",
    "any.required": "Category ID is required",
  }),
  discipline_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Discipline ID must be a valid UUID",
  }),
  description_short: Joi.string().max(500).optional().allow("", null).messages({
    "string.max": "Description must not exceed 500 characters",
  }),
  price: Joi.number().min(0).required().messages({
    "number.base": "Price must be a number",
    "number.min": "Price must be 0 or greater",
    "any.required": "Price is required",
  }),
  duration_hours: Joi.number()
    .min(0)
    .precision(2)
    .optional()
    .allow(null)
    .custom((value, helpers) => {
      if (value === null || value === undefined) return value;
      const quarterSteps = Math.round(Number(value) * 4);
      const normalized = quarterSteps / 4;
      if (Math.abs(Number(value) - normalized) > 1e-9) {
        return helpers.error("number.multiple");
      }
      return value;
    })
    .messages({
      "number.base": "Duration must be a number",
      "number.min": "Duration must be 0 or greater",
      "number.multiple":
        "Duration must be in 0.25-hour increments (15 minutes)",
    }),
  max_participants: Joi.number().integer().min(1).optional().messages({
    "number.base": "Max participants must be a number",
    "number.integer": "Max participants must be an integer",
    "number.min": "Max participants must be at least 1",
  }),
  price_type: Joi.string()
    .valid("per_person", "per_couple", "fixed")
    .optional()
    .messages({
      "any.only": "Price type must be one of: per_person, per_couple, fixed",
    }),
  equipment_flag_discount: Joi.boolean().optional(),
  note: Joi.string().max(1000).optional().allow("", null).messages({
    "string.max": "Note must not exceed 1000 characters",
  }),
  active: Joi.boolean().optional(),
  featured: Joi.boolean().optional(),
  order_position: Joi.number().integer().min(0).optional().messages({
    "number.base": "Order position must be a number",
    "number.integer": "Order position must be an integer",
    "number.min": "Order position must be 0 or greater",
  }),
  school_id: Joi.string().uuid().optional().messages({
    "string.guid": "School ID must be a valid UUID",
  }),
});

export const updateProductSchema = Joi.object({
  title: Joi.string().min(2).max(255).optional().messages({
    "string.min": "Title must be at least 2 characters long",
    "string.max": "Title must not exceed 255 characters",
  }),
  slug: Joi.string()
    .min(2)
    .max(255)
    .pattern(/^[a-z0-9-]+$/)
    .optional()
    .messages({
      "string.min": "Slug must be at least 2 characters long",
      "string.max": "Slug must not exceed 255 characters",
      "string.pattern.base":
        "Slug can only contain lowercase letters, numbers, and hyphens",
    }),
  category_id: Joi.string().uuid().optional().messages({
    "string.guid": "Category ID must be a valid UUID",
  }),
  discipline_id: Joi.string().uuid().optional().allow(null).messages({
    "string.guid": "Discipline ID must be a valid UUID",
  }),
  description_short: Joi.string().max(500).optional().allow("", null).messages({
    "string.max": "Description must not exceed 500 characters",
  }),
  price: Joi.number().min(0).optional().messages({
    "number.base": "Price must be a number",
    "number.min": "Price must be 0 or greater",
  }),
  duration_hours: Joi.number()
    .min(0)
    .precision(2)
    .optional()
    .allow(null)
    .custom((value, helpers) => {
      if (value === null || value === undefined) return value;
      const quarterSteps = Math.round(Number(value) * 4);
      const normalized = quarterSteps / 4;
      if (Math.abs(Number(value) - normalized) > 1e-9) {
        return helpers.error("number.multiple");
      }
      return value;
    })
    .messages({
      "number.base": "Duration must be a number",
      "number.min": "Duration must be 0 or greater",
      "number.multiple":
        "Duration must be in 0.25-hour increments (15 minutes)",
    }),
  max_participants: Joi.number().integer().min(1).optional().messages({
    "number.base": "Max participants must be a number",
    "number.integer": "Max participants must be an integer",
    "number.min": "Max participants must be at least 1",
  }),
  price_type: Joi.string()
    .valid("per_person", "per_couple", "fixed")
    .optional()
    .messages({
      "any.only": "Price type must be one of: per_person, per_couple, fixed",
    }),
  equipment_flag_discount: Joi.boolean().optional(),
  note: Joi.string().max(1000).optional().allow("", null).messages({
    "string.max": "Note must not exceed 1000 characters",
  }),
  active: Joi.boolean().optional(),
  featured: Joi.boolean().optional(),
  order_position: Joi.number().integer().min(0).optional().messages({
    "number.base": "Order position must be a number",
    "number.integer": "Order position must be an integer",
    "number.min": "Order position must be 0 or greater",
  }),
});
