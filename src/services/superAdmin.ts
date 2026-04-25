/**
 * @fileoverview Super Admin initialization service
 * @description Handles SUPER_ADMIN user creation and management
 * @author Ridesk Team
 * @version 1.0.0
 */

import { supabaseAdmin } from "../database/supabase";
import { AppError } from "../types";

const SUPER_ADMIN_EMAIL = "superadmin@ridesk.com";
const SUPER_ADMIN_PASSWORD = "SuperAdmin123!";
const SUPER_ADMIN_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Initialize SUPER_ADMIN user
 * Creates both auth.users and public.users entries
 * @returns SUPER_ADMIN user info
 */
export const initializeSuperAdmin = async () => {
  try {
    console.log("Initializing SUPER_ADMIN user...");

    // Check if SUPER_ADMIN already exists in auth.users
    const { data: existingAuthUser } =
      await supabaseAdmin.auth.admin.getUserById(SUPER_ADMIN_ID);

    if (existingAuthUser.user) {
      console.log("SUPER_ADMIN already exists in auth.users");
      return {
        id: SUPER_ADMIN_ID,
        email: SUPER_ADMIN_EMAIL,
        message: "SUPER_ADMIN already exists",
      };
    }

    // Create SUPER_ADMIN in auth.users
    const { data: _authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        id: SUPER_ADMIN_ID,
        email: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
          first_name: "Super",
          last_name: "Admin",
          role: "SUPER_ADMIN",
        },
      });

    if (authError) {
      throw new AppError(
        `Failed to create SUPER_ADMIN in auth: ${authError.message}`,
        500,
      );
    }

    // Create SUPER_ADMIN in public.users
    const { data: _publicUser, error: publicError } = await supabaseAdmin
      .from("users")
      .insert({
        id: SUPER_ADMIN_ID,
        first_name: "Super",
        last_name: "Admin",
        role: "SUPER_ADMIN",
        school_id: null,
        is_active: true,
      })
      .select()
      .single();

    if (publicError) {
      // If public user creation fails, clean up auth user
      await supabaseAdmin.auth.admin.deleteUser(SUPER_ADMIN_ID);
      throw new AppError(
        `Failed to create SUPER_ADMIN in public.users: ${publicError.message}`,
        500,
      );
    }

    console.log("SUPER_ADMIN created successfully");
    return {
      id: SUPER_ADMIN_ID,
      email: SUPER_ADMIN_EMAIL,
      password: SUPER_ADMIN_PASSWORD,
      message: "SUPER_ADMIN created successfully",
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to initialize SUPER_ADMIN", 500);
  }
};

/**
 * Get SUPER_ADMIN credentials for initial setup
 * @returns SUPER_ADMIN login credentials
 */
export const getSuperAdminCredentials = () => {
  return {
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
    message: "Use these credentials to login as SUPER_ADMIN",
  };
};

/**
 * Check if SUPER_ADMIN exists
 * @returns boolean indicating if SUPER_ADMIN exists
 */
export const checkSuperAdminExists = async (): Promise<boolean> => {
  try {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
      SUPER_ADMIN_ID,
    );
    return !!authUser.user;
  } catch (error) {
    return false;
  }
};
