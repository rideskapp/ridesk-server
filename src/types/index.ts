/**
 * @fileoverview Core type definitions for Ridesk Server
 * @description Defines all TypeScript interfaces and types used throughout the server
 * @author Ridesk Team
 * @version 1.0.0
 */

// ============================================================================
// USER ROLES & PERMISSIONS
// ============================================================================

export const ALL_SCHOOLS_ID = "ALL";

export type UserRole = "SUPER_ADMIN" | "SCHOOL_ADMIN" | "INSTRUCTOR" | "USER";

export interface UserPermissions {
  canManageSchools: boolean;
  canManageInstructors: boolean;
  canManageStudents: boolean;
  canManageLessons: boolean;
  canViewCompensations: boolean;
  canManageProducts: boolean;
  canManageSettings: boolean;
  canViewReports: boolean;
  canCreateUsers: boolean;
  canInviteUsers: boolean;
}

// ============================================================================
// AUTHENTICATION & AUTHORIZATION
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  schoolId?: string | null | undefined;
  isActive?: boolean;
  avatar?: string;
  permissions: UserPermissions;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user: AuthUser;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  schoolId?: string;
}

export interface InviteUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  role: "INSTRUCTOR" | "USER";
  // All user data is now passed separately to user creation
  // This interface is kept minimal for backward compatibility
}

export interface UserInvitation {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "INSTRUCTOR" | "USER";
  schoolId: string;
  invitedBy: string;
  invitedByName: string;
  invitationToken: string;
  expiresAt: string;
  isUsed: boolean;
  userId?: string | null; // Link to created user (new flow)
  formSubmittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  // All user data is now stored directly in users table
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ============================================================================
// SCHOOL MANAGEMENT
// ============================================================================

export interface School {
  id: string;
  name: string;
  slug: string;
  logo?: string | null | undefined;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  address?: string | null | undefined;
  website?: string | null | undefined;
  spotName?: string | null | undefined;
  windguruUrl?: string | null | undefined;
  disciplines: string[];
  openHoursStart?: string | null | undefined;
  openHoursEnd?: string | null | undefined;
  defaultLessonStatusId?: string | null | undefined;
  defaultPaymentStatusId?: string | null | undefined;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSchoolRequest {
  name: string;
  slug?: string;
  logo?: string;
  email?: string;
  phone?: string;
  address?: string;
  spotName?: string;
  windguruUrl?: string;
  disciplines?: string[];
  openHoursStart?: string;
  openHoursEnd?: string;
  defaultLessonStatusId?: string;
  defaultPaymentStatusId?: string;
}

export interface UpdateSchoolRequest extends Partial<CreateSchoolRequest> {
  id: string;
}

// ============================================================================
// SCHOOL SETTINGS
// ============================================================================

export interface MultilingualText {
  en?: string;
  it?: string;
  [key: string]: string | undefined;
}

export interface SchoolSettings {
  id: string;
  schoolId: string;
  lessonColorScheme: "discipline" | "student_level" | "category";
  customColorOverrides: Record<string, any>;
  compensationMode: "fixed" | "variable";
  defaultCurrency: string;
  // Consent settings
  termsConditionsUrl?: string | null;
  termsConditionsLabel?: MultilingualText | null;
  customCheckbox1Enabled: boolean;
  customCheckbox1Label?: MultilingualText | null;
  customCheckbox1Url?: string | null;
  customCheckbox1Mandatory: boolean;
  customCheckbox2Enabled: boolean;
  customCheckbox2Label?: MultilingualText | null;
  customCheckbox2Url?: string | null;
  customCheckbox2Mandatory: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateSchoolSettingsRequest {
  lessonColorScheme?: "discipline" | "student_level" | "category";
  customColorOverrides?: Record<string, any>;
  compensationMode?: "fixed" | "variable";
  defaultCurrency?: string;
  // Consent settings
  termsConditionsUrl?: string | null;
  termsConditionsLabel?: MultilingualText | null;
  customCheckbox1Enabled?: boolean;
  customCheckbox1Label?: MultilingualText | null;
  customCheckbox1Url?: string | null;
  customCheckbox1Mandatory?: boolean;
  customCheckbox2Enabled?: boolean;
  customCheckbox2Label?: MultilingualText | null;
  customCheckbox2Url?: string | null;
  customCheckbox2Mandatory?: boolean;
}

// ============================================================================
// INSTRUCTOR MANAGEMENT
// ============================================================================

export interface Instructor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  avatar?: string;
  specialties: string[];
  languages: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstructorSchoolAssignment {
  id: string;
  instructorId: string;
  schoolId: string | null;
  schoolName: string;
  schoolSlug: string;
  isPrimary: boolean | null;
  hourlyRate?: number | null;
  commissionRate?: number | null;
  isActive: boolean;
  compensationMode?: "fixed" | "variable";
  createdAt: string;
  updatedAt: string;
}

export interface CreateInstructorRequest {
  schoolId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  avatar?: string;
  specialties: string[];
  languages: string[];
  notes?: string;
}

export interface UpdateInstructorRequest
  extends Partial<CreateInstructorRequest> {
  id: string;
}

export interface AssignInstructorToSchoolRequest {
  instructorId: string;
  schoolId: string;
  isPrimary?: boolean;
  hourlyRate?: number;
  commissionRate?: number;
}

export interface UpdateInstructorSchoolAssignmentRequest {
  isPrimary?: boolean;
  hourlyRate?: number;
  commissionRate?: number;
  isActive?: boolean;
}

// ============================================================================
// STUDENT MANAGEMENT
// ============================================================================

export interface Student {
  id: string;
  schoolId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  avatar?: string;
  studentLevelId: string;
  preferredLanguage?: string[];
  secondaryLanguage?: string;
  specialNeeds?: string[];
  specialNeedsOther?: string;
  notes?: string;
  arrivalDate?: string;
  departureDate?: string;
  stayNotes?: string;
  height?: number;
  weight?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudentRequest {
  schoolId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  avatar?: string;
  studentLevelId: string;
  preferredLanguage?: string[];
  secondaryLanguage?: string;
  specialNeeds?: string[];
  specialNeedsOther?: string;
  notes?: string;
  arrivalDate?: string;
  departureDate?: string;
  stayNotes?: string;
  height?: number;
  weight?: number;
  isActive?: boolean;
}

export interface UpdateStudentRequest extends Partial<CreateStudentRequest> {
  id: string;
}

// ============================================================================
// LESSON MANAGEMENT
// ============================================================================

export interface Lesson {
  id: string;
  schoolId: string;
  instructorId: string;
  productId?: string;
  discipline: string;
  date: string;
  time: string;
  duration: number;
  level: string;
  lessonStatusId?: string;
  paymentStatusId?: string;
  notes?: string;
  price?: number;
  source: "manual" | "web";
  participants: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLessonRequest {
  schoolId: string;
  instructorId: string;
  productId?: string;
  discipline: string;
  date: string;
  time: string;
  duration: number;
  level: string;
  lessonStatusId?: string;
  paymentStatusId?: string;
  notes?: string;
  price?: number;
  source?: "manual" | "web";
  participants: string[];
}

export interface UpdateLessonRequest extends Partial<CreateLessonRequest> {
  id: string;
}

// ============================================================================
// AVAILABILITY MANAGEMENT
// ============================================================================

export interface InstructorAvailability {
  id: string;
  instructorId: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAvailabilityRequest {
  instructorId: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  active?: boolean;
}

export interface UpdateAvailabilityRequest
  extends Partial<CreateAvailabilityRequest> {
  id: string;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface DatabaseUser {
  id: string;
  email: string;
  encrypted_password: string;
  role: UserRole;
  school_id?: string;
  first_name: string;
  last_name: string;
  created_at: string;
  updated_at: string;
}

/**
 * Database user interface for student records (users table with role=USER)
 * Represents the full schema of student user records in the database
 */
export interface DbUser {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
  whatsapp_number?: string | null;
  date_of_birth?: string | null;
  emergency_contact?: string | null;
  emergency_phone?: string | null;
  medical_conditions?: string | null;
  skill_level?: string | null;
  preferred_disciplines?: string[] | null;
  nationality?: string | null;
  weight?: number | null;
  height?: number | null;
  can_swim?: boolean | null;
  primary_sport?: string | null;
  riding_background?: string | null;
  preferred_days?: string[] | null;
  preferred_time_slots?: string[] | null;
  preferred_lesson_types?: string[] | null;
  // During migration the Supabase generated types may still treat this as string.
  // Allow both shapes here and normalize to string[] at service layer.
  preferred_language?: string | string[] | null;
  consent_physical_condition?: boolean | null;
  consent_terms_conditions?: boolean | null;
  consent_gdpr?: boolean | null;
  consent_photos_videos?: boolean | null;
  consent_marketing?: boolean | null;
  consent_custom_1?: boolean | null;
  consent_custom_2?: boolean | null;
  arrival_date?: string | null;
  departure_date?: string | null;
  stay_notes?: string | null;
  notes?: string | null;
  school_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSchool {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  spot_name?: string;
  windguru_url?: string;
  disciplines: string[];
  open_hours_start?: string;
  open_hours_end?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// MIDDLEWARE TYPES
// ============================================================================

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
  schoolId: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  schoolId?: string | null | undefined;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public errors?: Record<string, string[]> | undefined;

  constructor(message: string, errors?: Record<string, string[]>) {
    super(message, 400);
    this.name = "ValidationError";
    this.errors = errors;
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, 401);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Insufficient permissions") {
    super(message, 403);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
    this.name = "ConflictError";
  }
}
