/**
 * @fileoverview Swagger/OpenAPI configuration for Ridesk Server
 * @description Comprehensive API documentation setup
 */

import swaggerJsdoc from "swagger-jsdoc";
import { SwaggerDefinition } from "swagger-jsdoc";

const swaggerDefinition: SwaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Ridesk SaaS Platform API",
    version: "1.0.0",
    description: `
      Comprehensive API for the Ridesk SaaS Platform - A complete water sports school management system.
      
      ## Features
      - **Multi-tenant Architecture**: Complete data isolation between schools
      - **Role-based Access Control**: SUPER_ADMIN, SCHOOL_ADMIN, INSTRUCTOR, USER roles
      - **Comprehensive Management**: Schools, Instructors, Students, Lessons, Products
      - **Advanced Features**: Instructor compensation, availability management, lesson booking
      - **Security**: JWT authentication, input validation, rate limiting
      
      ## Authentication
      All protected endpoints require a valid JWT token in the Authorization header:
      \`Authorization: Bearer <your-jwt-token>\`
      
      ## Rate Limiting
      API requests are limited to 100 requests per 15-minute window per IP address.
      
      ## Error Handling
      All endpoints return consistent error responses with appropriate HTTP status codes.
    `,
    contact: {
      name: "Ridesk Team",
      email: "support@ridesk.com",
      url: "https://ridesk.com",
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  servers: [
    {
      url: "http://localhost:5000",
      description: "Development server",
    },
    {
      url: "https://api.ridesk.com",
      description: "Production server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT token obtained from /api/auth/login endpoint",
      },
    },
    schemas: {
      // Common Response Schemas
      SuccessResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: true,
          },
          message: {
            type: "string",
            example: "Operation completed successfully",
          },
          data: {
            type: "object",
            description: "Response data (varies by endpoint)",
          },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: false,
          },
          error: {
            type: "string",
            example: "Error message",
          },
          details: {
            type: "object",
            description: "Additional error details (optional)",
          },
        },
      },
      ValidationError: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: false,
          },
          error: {
            type: "string",
            example: "Validation failed",
          },
          details: {
            type: "object",
            additionalProperties: {
              type: "array",
              items: {
                type: "string",
              },
            },
            example: {
              email: ["Email is required"],
              password: ["Password must be at least 6 characters long"],
            },
          },
        },
      },

      // User Schemas
      User: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            example: "123e4567-e89b-12d3-a456-426614174000",
          },
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
          },
          role: {
            type: "string",
            enum: ["SUPER_ADMIN", "SCHOOL_ADMIN", "INSTRUCTOR", "USER"],
            example: "SCHOOL_ADMIN",
          },
          schoolId: {
            type: "string",
            format: "uuid",
            nullable: true,
            example: "123e4567-e89b-12d3-a456-426614174001",
          },
          firstName: {
            type: "string",
            example: "John",
          },
          lastName: {
            type: "string",
            example: "Doe",
          },
          isActive: {
            type: "boolean",
            example: true,
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-01T00:00:00.000Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-01T00:00:00.000Z",
          },
        },
      },

      // School Schemas
      School: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            example: "123e4567-e89b-12d3-a456-426614174000",
          },
          name: {
            type: "string",
            example: "Ridesk Kitesurf School",
          },
          slug: {
            type: "string",
            example: "ridesks-kitesurf-school",
          },
          logo: {
            type: "string",
            nullable: true,
            example: "https://example.com/logo.png",
          },
          email: {
            type: "string",
            format: "email",
            nullable: true,
            example: "info@ridesks.com",
          },
          phone: {
            type: "string",
            nullable: true,
            example: "+39 123 456 7890",
          },
          address: {
            type: "string",
            nullable: true,
            example: "Via del Mare 123, 00100 Roma, Italy",
          },
          spotName: {
            type: "string",
            nullable: true,
            example: "Fregene Beach",
          },
          windguruUrl: {
            type: "string",
            nullable: true,
            example: "https://www.windguru.cz/station/123",
          },
          disciplines: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["kite", "surf"],
          },
          openHoursStart: {
            type: "string",
            format: "time",
            nullable: true,
            example: "09:00",
          },
          openHoursEnd: {
            type: "string",
            format: "time",
            nullable: true,
            example: "18:00",
          },
          isActive: {
            type: "boolean",
            example: true,
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-01T00:00:00.000Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-01T00:00:00.000Z",
          },
        },
      },

      // Student Schemas
      Student: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            example: "123e4567-e89b-12d3-a456-426614174000",
          },
          firstName: {
            type: "string",
            example: "John",
          },
          lastName: {
            type: "string",
            example: "Doe",
          },
          email: {
            type: "string",
            format: "email",
            example: "john.doe@example.com",
          },
          phone: {
            type: "string",
            nullable: true,
            example: "+1234567890",
          },
          dateOfBirth: {
            type: "string",
            format: "date",
            nullable: true,
            example: "1990-01-01",
          },
          emergencyContact: {
            type: "string",
            nullable: true,
            example: "Jane Doe",
          },
          emergencyPhone: {
            type: "string",
            nullable: true,
            example: "+1234567891",
          },
          medicalConditions: {
            type: "string",
            nullable: true,
            example: "None",
          },
          skillLevel: {
            type: "string",
            enum: ["beginner", "intermediate", "advanced"],
            example: "beginner",
          },
          preferredDisciplines: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["kite", "surf"],
          },
          schoolId: {
            type: "string",
            format: "uuid",
            example: "123e4567-e89b-12d3-a456-426614174001",
          },
          isActive: {
            type: "boolean",
            example: true,
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-01T00:00:00.000Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-01T00:00:00.000Z",
          },
        },
      },
      CreateStudentRequest: {
        type: "object",
        required: [
          "firstName",
          "lastName",
          "email",
          "skillLevel",
          "preferredDisciplines",
        ],
        properties: {
          firstName: {
            type: "string",
            example: "John",
          },
          lastName: {
            type: "string",
            example: "Doe",
          },
          email: {
            type: "string",
            format: "email",
            example: "john.doe@example.com",
          },
          phone: {
            type: "string",
            nullable: true,
            example: "+1234567890",
          },
          dateOfBirth: {
            type: "string",
            format: "date",
            nullable: true,
            example: "1990-01-01",
          },
          emergencyContact: {
            type: "string",
            nullable: true,
            example: "Jane Doe",
          },
          emergencyPhone: {
            type: "string",
            nullable: true,
            example: "+1234567891",
          },
          medicalConditions: {
            type: "string",
            nullable: true,
            example: "None",
          },
          skillLevel: {
            type: "string",
            enum: ["beginner", "intermediate", "advanced"],
            example: "beginner",
          },
          preferredDisciplines: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["kite", "surf"],
          },
        },
      },
      UpdateStudentRequest: {
        type: "object",
        properties: {
          firstName: {
            type: "string",
            example: "John",
          },
          lastName: {
            type: "string",
            example: "Doe",
          },
          email: {
            type: "string",
            format: "email",
            example: "john.doe@example.com",
          },
          phone: {
            type: "string",
            nullable: true,
            example: "+1234567890",
          },
          dateOfBirth: {
            type: "string",
            format: "date",
            nullable: true,
            example: "1990-01-01",
          },
          emergencyContact: {
            type: "string",
            nullable: true,
            example: "Jane Doe",
          },
          emergencyPhone: {
            type: "string",
            nullable: true,
            example: "+1234567891",
          },
          medicalConditions: {
            type: "string",
            nullable: true,
            example: "None",
          },
          skillLevel: {
            type: "string",
            enum: ["beginner", "intermediate", "advanced"],
            example: "beginner",
          },
          preferredDisciplines: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["kite", "surf"],
          },
        },
      },

      // Instructor Schemas
      Instructor: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            example: "123e4567-e89b-12d3-a456-426614174000",
          },
          firstName: {
            type: "string",
            example: "John",
          },
          lastName: {
            type: "string",
            example: "Doe",
          },
          email: {
            type: "string",
            format: "email",
            example: "john.doe@example.com",
          },
          phone: {
            type: "string",
            nullable: true,
            example: "+1234567890",
          },
          specialties: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["kite", "surf"],
          },
          certifications: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["IKO Level 1", "VDWS Instructor"],
          },
          languages: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["English", "Italian"],
          },
          hourlyRate: {
            type: "number",
            nullable: true,
            example: 50.0,
          },
          commissionRate: {
            type: "number",
            nullable: true,
            example: 15.0,
          },
          isPrimary: {
            type: "boolean",
            example: true,
          },
          schoolId: {
            type: "string",
            format: "uuid",
            example: "123e4567-e89b-12d3-a456-426614174001",
          },
          isActive: {
            type: "boolean",
            example: true,
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-01T00:00:00.000Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-01T00:00:00.000Z",
          },
        },
      },
      CreateInstructorRequest: {
        type: "object",
        required: [
          "firstName",
          "lastName",
          "email",
          "specialties",
          "languages",
          "isPrimary",
        ],
        properties: {
          firstName: {
            type: "string",
            example: "John",
          },
          lastName: {
            type: "string",
            example: "Doe",
          },
          email: {
            type: "string",
            format: "email",
            example: "john.doe@example.com",
          },
          whatsappNumber: {
            type: "string",
            nullable: true,
            example: "+1234567890",
          },
          specialties: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["kite", "surf"],
          },
          certifications: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["IKO Level 1", "VDWS Instructor"],
          },
          languages: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["English", "Italian"],
          },
          hourlyRate: {
            type: "number",
            nullable: true,
            example: 50.0,
          },
          commissionRate: {
            type: "number",
            nullable: true,
            example: 15.0,
          },
          isPrimary: {
            type: "boolean",
            example: true,
          },
        },
      },
      UpdateInstructorRequest: {
        type: "object",
        properties: {
          firstName: {
            type: "string",
            example: "John",
          },
          lastName: {
            type: "string",
            example: "Doe",
          },
          email: {
            type: "string",
            format: "email",
            example: "john.doe@example.com",
          },
          phone: {
            type: "string",
            nullable: true,
            example: "+1234567890",
          },
          specialties: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["kite", "surf"],
          },
          certifications: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["IKO Level 1", "VDWS Instructor"],
          },
          languages: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["English", "Italian"],
          },
          hourlyRate: {
            type: "number",
            nullable: true,
            example: 50.0,
          },
          commissionRate: {
            type: "number",
            nullable: true,
            example: 15.0,
          },
          isPrimary: {
            type: "boolean",
            example: true,
          },
        },
      },

      // Auth Schemas
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
          },
          password: {
            type: "string",
            minLength: 6,
            example: "password123",
          },
        },
      },
      RegisterRequest: {
        type: "object",
        required: ["email", "password", "firstName", "lastName", "role"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
          },
          password: {
            type: "string",
            minLength: 6,
            example: "password123",
          },
          firstName: {
            type: "string",
            minLength: 2,
            maxLength: 50,
            example: "John",
          },
          lastName: {
            type: "string",
            minLength: 2,
            maxLength: 50,
            example: "Doe",
          },
          role: {
            type: "string",
            enum: ["SUPER_ADMIN", "SCHOOL_ADMIN", "INSTRUCTOR", "USER"],
            example: "SCHOOL_ADMIN",
          },
          schoolId: {
            type: "string",
            format: "uuid",
            nullable: true,
            example: "123e4567-e89b-12d3-a456-426614174001",
          },
        },
      },
      LoginResponse: {
        type: "object",
        properties: {
          user: {
            $ref: "#/components/schemas/User",
          },
          token: {
            type: "string",
            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          },
          refreshToken: {
            type: "string",
            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          },
          expiresIn: {
            type: "number",
            example: 604800,
          },
        },
      },
      UserInvitation: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            example: "123e4567-e89b-12d3-a456-426614174000",
          },
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
          },
          firstName: {
            type: "string",
            example: "John",
          },
          lastName: {
            type: "string",
            example: "Doe",
          },
          role: {
            type: "string",
            enum: ["INSTRUCTOR", "USER"],
            example: "INSTRUCTOR",
          },
          schoolId: {
            type: "string",
            format: "uuid",
            example: "123e4567-e89b-12d3-a456-426614174001",
          },
          invitedBy: {
            type: "string",
            format: "uuid",
            example: "123e4567-e89b-12d3-a456-426614174002",
          },
          invitedByName: {
            type: "string",
            example: "Jane Smith",
          },
          invitationToken: {
            type: "string",
            example: "abc123def456ghi789",
          },
          expiresAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-08T00:00:00.000Z",
          },
          isUsed: {
            type: "boolean",
            example: false,
          },
          userId: {
            type: "string",
            format: "uuid",
            nullable: true,
            example: "123e4567-e89b-12d3-a456-426614174003",
          },
          formSubmittedAt: {
            type: "string",
            format: "date-time",
            nullable: true,
            example: null,
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-01T00:00:00.000Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-01T00:00:00.000Z",
          },
        },
      },

      // Pagination Schemas
      PaginationMeta: {
        type: "object",
        properties: {
          page: {
            type: "integer",
            minimum: 1,
            example: 1,
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            example: 10,
          },
          total: {
            type: "integer",
            minimum: 0,
            example: 100,
          },
          totalPages: {
            type: "integer",
            minimum: 0,
            example: 10,
          },
          hasNext: {
            type: "boolean",
            example: true,
          },
          hasPrev: {
            type: "boolean",
            example: false,
          },
        },
      },

      // School Management Schemas
      CreateSchoolRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: {
            type: "string",
            minLength: 2,
            maxLength: 100,
            example: "Ridesk Kitesurf School",
          },
          slug: {
            type: "string",
            pattern: "^[a-z0-9-]+$",
            minLength: 2,
            maxLength: 50,
            example: "ridesks-kitesurf-school",
          },
          logo: {
            type: "string",
            format: "uri",
            nullable: true,
            example: "https://example.com/logo.png",
          },
          email: {
            type: "string",
            format: "email",
            nullable: true,
            example: "info@ridesks.com",
          },
          phone: {
            type: "string",
            minLength: 10,
            maxLength: 20,
            nullable: true,
            example: "+39 123 456 7890",
          },
          address: {
            type: "string",
            maxLength: 500,
            nullable: true,
            example: "Via del Mare 123, 00100 Roma, Italy",
          },
          spotName: {
            type: "string",
            maxLength: 100,
            nullable: true,
            example: "Fregene Beach",
          },
          windguruUrl: {
            type: "string",
            format: "uri",
            nullable: true,
            example: "https://www.windguru.cz/station/123",
          },
          disciplines: {
            type: "array",
            items: {
              type: "string",
            },
            nullable: true,
            example: ["kite", "surf"],
          },
          openHoursStart: {
            type: "string",
            pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
            nullable: true,
            example: "09:00",
          },
          openHoursEnd: {
            type: "string",
            pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
            nullable: true,
            example: "18:00",
          },
        },
      },
      UpdateSchoolRequest: {
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "string",
            format: "uuid",
            example: "123e4567-e89b-12d3-a456-426614174000",
          },
          name: {
            type: "string",
            minLength: 2,
            maxLength: 100,
            example: "Ridesk Kitesurf School",
          },
          slug: {
            type: "string",
            pattern: "^[a-z0-9-]+$",
            minLength: 2,
            maxLength: 50,
            example: "ridesks-kitesurf-school",
          },
          logo: {
            type: "string",
            format: "uri",
            nullable: true,
            example: "https://example.com/logo.png",
          },
          email: {
            type: "string",
            format: "email",
            nullable: true,
            example: "info@ridesks.com",
          },
          phone: {
            type: "string",
            minLength: 10,
            maxLength: 20,
            nullable: true,
            example: "+39 123 456 7890",
          },
          address: {
            type: "string",
            maxLength: 500,
            nullable: true,
            example: "Via del Mare 123, 00100 Roma, Italy",
          },
          spotName: {
            type: "string",
            maxLength: 100,
            nullable: true,
            example: "Fregene Beach",
          },
          windguruUrl: {
            type: "string",
            format: "uri",
            nullable: true,
            example: "https://www.windguru.cz/station/123",
          },
          disciplines: {
            type: "array",
            items: {
              type: "string",
            },
            nullable: true,
            example: ["kite", "surf"],
          },
          openHoursStart: {
            type: "string",
            pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
            nullable: true,
            example: "09:00",
          },
          openHoursEnd: {
            type: "string",
            pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
            nullable: true,
            example: "18:00",
          },
        },
      },

      // Booking Schemas
      CreateBookingRequest: {
        type: "object",
        required: ["product_id", "start_date", "end_date"],
        properties: {
          product_id: {
            type: "string",
            format: "uuid",
            example: "123e4567-e89b-12d3-a456-426614174000",
            description: "Product ID for the booking",
          },
          student_id: {
            type: "string",
            format: "uuid",
            nullable: true,
            example: "123e4567-e89b-12d3-a456-426614174001",
            description:
              "Single student ID (optional if student_ids is provided)",
          },
          student_ids: {
            type: "array",
            items: {
              type: "string",
              format: "uuid",
            },
            minItems: 1,
            nullable: true,
            example: [
              "123e4567-e89b-12d3-a456-426614174001",
              "123e4567-e89b-12d3-a456-426614174002",
            ],
            description:
              "Array of student IDs (optional if student_id is provided). Either student_id or student_ids must be provided.",
          },
          start_date: {
            type: "string",
            format: "date",
            example: "2024-01-15",
            description: "Booking start date (ISO date format)",
          },
          end_date: {
            type: "string",
            format: "date",
            example: "2024-01-20",
            description: "Booking end date (ISO date format)",
          },
          notes: {
            type: "string",
            maxLength: 1000,
            nullable: true,
            example: "Special instructions for this booking",
            description: "Optional notes for the booking",
          },
        },
      },
      Booking: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            example: "123e4567-e89b-12d3-a456-426614174000",
          },
          school_id: {
            type: "string",
            format: "uuid",
            example: "123e4567-e89b-12d3-a456-426614174001",
          },
          product_id: {
            type: "string",
            format: "uuid",
            example: "123e4567-e89b-12d3-a456-426614174002",
          },
          total_minutes: {
            type: "integer",
            example: 1800,
            description: "Total minutes allocated for this booking",
          },
          remaining_minutes: {
            type: "integer",
            example: 1800,
            description: "Remaining minutes for this booking",
          },
          start_date: {
            type: "string",
            format: "date",
            example: "2024-01-15",
          },
          end_date: {
            type: "string",
            format: "date",
            example: "2024-01-20",
          },
          status: {
            type: "string",
            enum: ["active", "completed", "cancelled"],
            example: "active",
          },
          notes: {
            type: "string",
            nullable: true,
            example: "Special instructions for this booking",
          },
          created_by: {
            type: "string",
            format: "uuid",
            example: "123e4567-e89b-12d3-a456-426614174003",
          },
          created_at: {
            type: "string",
            format: "date-time",
            example: "2024-01-01T00:00:00.000Z",
          },
          updated_at: {
            type: "string",
            format: "date-time",
            example: "2024-01-01T00:00:00.000Z",
          },
          products: {
            type: "object",
            nullable: true,
            properties: {
              id: {
                type: "string",
                format: "uuid",
              },
              title: {
                type: "string",
              },
              duration_hours: {
                type: "number",
              },
            },
          },
          participants: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  format: "uuid",
                },
                student_id: {
                  type: "string",
                  format: "uuid",
                },
                users: {
                  type: "object",
                  nullable: true,
                  properties: {
                    first_name: {
                      type: "string",
                    },
                    last_name: {
                      type: "string",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    responses: {
      UnauthorizedError: {
        description: "Authentication required",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
            example: {
              success: false,
              error: "Authentication required",
            },
          },
        },
      },
      ForbiddenError: {
        description: "Insufficient permissions",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
            example: {
              success: false,
              error: "Insufficient permissions",
            },
          },
        },
      },
      NotFoundError: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
            example: {
              success: false,
              error: "Resource not found",
            },
          },
        },
      },
      ValidationError: {
        description: "Validation failed",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ValidationError",
            },
          },
        },
      },
      ConflictError: {
        description: "Resource already exists",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
            example: {
              success: false,
              error: "Resource already exists",
            },
          },
        },
      },
      RateLimitError: {
        description: "Too many requests",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
            example: {
              success: false,
              error: "Too many requests from this IP, please try again later.",
            },
          },
        },
      },
      InternalServerError: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
            example: {
              success: false,
              error: "Internal server error",
            },
          },
        },
      },
    },
  },
  tags: [
    {
      name: "Authentication",
      description: "User authentication and authorization endpoints",
    },
    {
      name: "Schools",
      description: "School management endpoints",
    },
    {
      name: "School Calendar",
      description:
        "School calendar management - weekly availability patterns and special date exceptions (holidays, closures)",
    },
    {
      name: "Health",
      description: "System health and status endpoints",
    },
    {
      name: "Bookings",
      description:
        "Booking management endpoints - create and manage student product bookings",
    },
    {
      name: "Student Levels",
      description:
        "Student level management endpoints - create and manage student skill levels",
    },
    {
      name: "Payment Statuses",
      description: "Payment status management endpoints",
    },
    {
      name: "Lesson Statuses",
      description: "Lesson status management endpoints",
    },
    {
      name: "Reporting",
      description: "Business analytics and reporting endpoints",
    },
    {
      name: "System Configuration",
      description: "System-wide configuration endpoints",
    },
    {
      name: "Products",
      description:
        "Product management endpoints - create and manage lesson products",
    },
    {
      name: "Product Categories",
      description: "Product category management endpoints",
    },
    {
      name: "Disciplines",
      description: "Water sports discipline management endpoints",
    },
    {
      name: "School Settings",
      description: "School-specific settings and configuration endpoints",
    },
    {
      name: "Student Profile",
      description:
        "Student profile management endpoints - for students to view their own data",
    },
    {
      name: "Student Form",
      description:
        "Student information form endpoints - public endpoints for form submission",
    },
    {
      name: "Availability",
      description: "Instructor availability management endpoints",
    },
    {
      name: "Lessons",
      description: "Lesson management endpoints",
    },
    {
      name: "Compensation",
      description: "Instructor compensation management endpoints",
    },
    {
      name: "Instructors",
      description: "Instructor management endpoints",
    },
    {
      name: "Instructor Profile",
      description:
        "Instructor profile management endpoints - for instructors to view their own data",
    },
    {
      name: "Students",
      description: "Student management endpoints",
    },
    {
      name: "User Invitations",
      description: "User invitation management endpoints",
    },
    {
      name: "Instructor Schools",
      description: "Instructor-school relationship management endpoints",
    },
  ],
};

const options = {
  definition: swaggerDefinition,
  apis: ["./dist/routes/*.js", "./dist/index.js"],
};

// During tests, skip Swagger generation to avoid parsing issues from dist
export const swaggerSpec =
  process.env["NODE_ENV"] === "test" ? ({} as any) : swaggerJsdoc(options);
export default swaggerSpec;
