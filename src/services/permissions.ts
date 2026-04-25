/**
 * @fileoverview Role-based permission system for Ridesk
 * @description Defines and manages user roles, permissions, and access control
 * @author Ridesk Team
 * @version 1.0.0
 */

import { UserRole, UserPermissions } from "../types";

/**
 * Permission definitions for each role
 * Based on the proposal requirements for SUPER_ADMIN, SCHOOL_ADMIN, INSTRUCTOR, USER
 */
export const ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  SUPER_ADMIN: {
    canManageSchools: true,
    canManageInstructors: true,
    canManageStudents: true,
    canManageLessons: true,
    canViewCompensations: true,
    canManageProducts: true,
    canManageSettings: true,
    canViewReports: true,
    canCreateUsers: true,
    canInviteUsers: true,
  },
  SCHOOL_ADMIN: {
    canManageSchools: false, // Can only manage their own school
    canManageInstructors: true,
    canManageStudents: true,
    canManageLessons: true,
    canViewCompensations: true,
    canManageProducts: true,
    canManageSettings: true,
    canViewReports: true,
    canCreateUsers: true, // NEW: Can create users for their school
    canInviteUsers: true, // NEW: Can send user invitations
  },
  INSTRUCTOR: {
    canManageSchools: false,
    canManageInstructors: false,
    canManageStudents: false,
    canManageLessons: true, // Can manage their own lessons
    canViewCompensations: true, // Can view their own compensations
    canManageProducts: false,
    canManageSettings: false,
    canViewReports: false,
    canCreateUsers: false,
    canInviteUsers: false,
  },
  USER: {
    canManageSchools: false,
    canManageInstructors: false,
    canManageStudents: false,
    canManageLessons: false,
    canViewCompensations: false,
    canManageProducts: false,
    canManageSettings: false,
    canViewReports: false,
    canCreateUsers: false,
    canInviteUsers: false,
  },
};

/**
 * Get permissions for a specific role
 * @param role - User role
 * @returns UserPermissions object
 */
export const getPermissionsForRole = (role: UserRole): UserPermissions => {
  return ROLE_PERMISSIONS[role];
};

/**
 * Check if a role has a specific permission
 * @param role - User role
 * @param permission - Permission key
 * @returns boolean
 */
export const hasPermission = (
  role: UserRole,
  permission: keyof UserPermissions,
): boolean => {
  const permissions = getPermissionsForRole(role);
  return permissions[permission];
};

/**
 * Check if a user can access a specific school's data
 * @param userRole - User's role
 * @param userSchoolId - User's school ID
 * @param targetSchoolId - Target school ID
 * @returns boolean
 */
export const canAccessSchool = (
  userRole: UserRole,
  userSchoolId: string | undefined,
  targetSchoolId: string,
): boolean => {
  // SUPER_ADMIN can access all schools
  if (userRole === "SUPER_ADMIN") {
    return true;
  }

  // Other roles can only access their own school
  return userSchoolId === targetSchoolId;
};

/**
 * Check if a user can manage a specific instructor
 * @param userRole - User's role
 * @param userSchoolId - User's school ID
 * @param instructorSchoolId - Instructor's school ID
 * @returns boolean
 */
export const canManageInstructor = (
  userRole: UserRole,
  userSchoolId: string | undefined,
  instructorSchoolId: string,
): boolean => {
  // Check if user has permission to manage instructors
  if (!hasPermission(userRole, "canManageInstructors")) {
    return false;
  }

  // Check if user can access the instructor's school
  return canAccessSchool(userRole, userSchoolId, instructorSchoolId);
};

/**
 * Check if a user can manage a specific student
 * @param userRole - User's role
 * @param userSchoolId - User's school ID
 * @param studentSchoolId - Student's school ID
 * @returns boolean
 */
export const canManageStudent = (
  userRole: UserRole,
  userSchoolId: string | undefined,
  studentSchoolId: string,
): boolean => {
  // Check if user has permission to manage students
  if (!hasPermission(userRole, "canManageStudents")) {
    return false;
  }

  // Check if user can access the student's school
  return canAccessSchool(userRole, userSchoolId, studentSchoolId);
};

/**
 * Check if a user can manage a specific lesson
 * @param userRole - User's role
 * @param userSchoolId - User's school ID
 * @param lessonSchoolId - Lesson's school ID
 * @param instructorId - Lesson's instructor ID (for instructor role)
 * @param userInstructorId - User's instructor ID (if user is instructor)
 * @returns boolean
 */
export const canManageLesson = (
  userRole: UserRole,
  userSchoolId: string | undefined,
  lessonSchoolId: string,
  instructorId?: string,
  userInstructorId?: string,
): boolean => {
  // Check if user has permission to manage lessons
  if (!hasPermission(userRole, "canManageLessons")) {
    return false;
  }

  // Check if user can access the lesson's school
  if (!canAccessSchool(userRole, userSchoolId, lessonSchoolId)) {
    return false;
  }

  // If user is instructor, they can only manage their own lessons
  if (userRole === "INSTRUCTOR" && instructorId && userInstructorId) {
    return instructorId === userInstructorId;
  }

  return true;
};

/**
 * Check if a user can view compensations
 * @param userRole - User's role
 * @param userSchoolId - User's school ID
 * @param targetSchoolId - Target school ID
 * @returns boolean
 */
export const canViewCompensations = (
  userRole: UserRole,
  userSchoolId: string | undefined,
  targetSchoolId: string,
): boolean => {
  // Check if user has permission to view compensations
  if (!hasPermission(userRole, "canViewCompensations")) {
    return false;
  }

  // Check if user can access the school's data
  return canAccessSchool(userRole, userSchoolId, targetSchoolId);
};

/**
 * Get all roles that can perform a specific action
 * @param permission - Permission key
 * @returns Array of roles that have the permission
 */
export const getRolesWithPermission = (
  permission: keyof UserPermissions,
): UserRole[] => {
  return Object.entries(ROLE_PERMISSIONS)
    .filter(([_, permissions]) => permissions[permission])
    .map(([role]) => role as UserRole);
};

/**
 * Validate if a role transition is allowed
 * @param fromRole - Current role
 * @param toRole - Target role
 * @param currentUserRole - Role of user making the change
 * @returns boolean
 */
export const canChangeRole = (
  fromRole: UserRole,
  _toRole: UserRole,
  currentUserRole: UserRole,
): boolean => {
  // Only SUPER_ADMIN can change roles
  if (currentUserRole !== "SUPER_ADMIN") {
    return false;
  }

  // SUPER_ADMIN cannot change their own role
  if (fromRole === "SUPER_ADMIN") {
    return false;
  }

  // All other role changes are allowed for SUPER_ADMIN
  return true;
};

/**
 * Get the hierarchy level of a role (higher number = more privileges)
 * @param role - User role
 * @returns Hierarchy level
 */
export const getRoleHierarchy = (role: UserRole): number => {
  const hierarchy: Record<UserRole, number> = {
    SUPER_ADMIN: 4,
    SCHOOL_ADMIN: 3,
    INSTRUCTOR: 2,
    USER: 1,
  };
  return hierarchy[role];
};

/**
 * Check if one role is higher than another
 * @param role1 - First role
 * @param role2 - Second role
 * @returns boolean
 */
export const isRoleHigher = (role1: UserRole, role2: UserRole): boolean => {
  return getRoleHierarchy(role1) > getRoleHierarchy(role2);
};
