/**
 * @fileoverview Role display name utilities
 * @description Centralized role-to-display-name mapping
 * @author Ridesk Team
 * @version 1.0.0
 */

/**
 * Role display name mapping for UI and emails
 */
export const ROLE_DISPLAY_NAMES: Record<string, string> = {
    INSTRUCTOR: "Instructor",
    USER: "Student",
    SCHOOL_ADMIN: "School Admin",
    SUPER_ADMIN: "Super Admin",
};

/**
 * Get the display name for a role
 * @param role - The role code (e.g., "INSTRUCTOR", "USER")
 * @returns The display name (e.g., "Instructor", "Student")
 */
export const getRoleDisplayName = (role: string): string => {
    return ROLE_DISPLAY_NAMES[role] || role;
};

/**
 * UUID validation regex pattern
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate if a string is a valid UUID
 * @param value - The string to validate
 * @returns true if valid UUID, false otherwise
 */
export const isValidUuid = (value: string): boolean => {
    return UUID_REGEX.test(value);
};
