/**
 * @fileoverview Authentication service for Ridesk Server
 * @description Handles user authentication, JWT tokens, and session management
 * @author Ridesk Team
 * @version 1.0.0
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "../database/supabase";
import {
  AuthUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RefreshTokenRequest,
  JWTPayload,
  AuthenticationError,
  ConflictError,
  NotFoundError,
  AppError,
} from "../types";
import { getPermissionsForRole } from "./permissions";
import { env } from "../config/env";
import emailService from "./email";
import {
  findAuthUserByEmail,
  normalizeAuthEmail,
} from "../utils/authUserLookup";

// JWT configuration
const JWT_SECRET = env.JWT_SECRET;
const REFRESH_TOKEN_EXPIRES_IN = "30d";

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

/**
 * Compare a password with its hash
 * @param password - Plain text password
 * @param hash - Hashed password
 * @returns boolean
 */
export const comparePassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Generate JWT access token
 * @param payload - JWT payload
 * @returns JWT token
 */
export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d",
    issuer: "ridesk-server",
    audience: "ridesk-client",
  });
};

/**
 * Generate JWT refresh token
 * @param payload - JWT payload
 * @returns JWT refresh token
 */
export const generateRefreshToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    issuer: "ridesk-server",
    audience: "ridesk-client",
  });
};

/**
 * Verify JWT token
 * @param token - JWT token
 * @returns Decoded payload
 */
export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: "ridesk-server",
      audience: "ridesk-client",
    }) as JWTPayload;
  } catch (error) {
    throw new AuthenticationError("Invalid or expired token");
  }
};

/**
 * Create user in database
 * @param userData - User registration data
 * @returns Created user
 */
export const createUser = async (
  userData: RegisterRequest,
): Promise<AuthUser> => {
  try {
    console.log("Creating user with data:", {
      email: userData.email,
      role: userData.role,
      schoolId: userData.schoolId,
    });

    // Check if user already exists in auth.users
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    const existingUser = existingUsers.users.find(
      (user) => user.email === userData.email,
    );
    if (existingUser) {
      throw new ConflictError("User with this email already exists");
    }

    // Validate school exists if school_id is provided
    if (userData.schoolId) {
      const { data: school } = await supabaseAdmin
        .from("schools")
        .select("id")
        .eq("id", userData.schoolId)
        .single();

      if (!school) {
        console.error("School not found:", userData.schoolId);
        throw new NotFoundError("School not found");
      }
    } else {
      console.log(
        "No school_id provided, user will be created without school association",
      );
    }

    // Create user in auth.users using Supabase Auth
    // Generate a temporary password if none provided (for admin-created users)
    const passwordToUse =
      userData.password && userData.password.length >= 6
        ? userData.password
        : `Temp-${Math.random().toString(36).slice(2, 8)}-${Date.now()
            .toString()
            .slice(-4)}`;

    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: passwordToUse,
        email_confirm: true, // Auto-confirm email
      });

    if (authError || !authUser.user) {
      throw new AppError(
        `Failed to create auth user: ${authError?.message || "Unknown error"}`,
        500,
      );
    }

    // Create corresponding record in public.users using service role
    // We need to bypass RLS by using the admin client with explicit service role
    const userRecord = {
      id: authUser.user.id,
      role: userData.role || "USER",
      school_id:
        userData.role === "INSTRUCTOR" ? null : userData.schoolId || null, // Instructors use instructor_schools table
      first_name: userData.firstName,
      last_name: userData.lastName,
      is_active: true,
    };

    const { data: newUser, error: publicUserError } = await supabaseAdmin
      .from("users")
      .insert(userRecord)
      .select()
      .single();

    if (publicUserError) {
      console.error("Error creating public user profile:", publicUserError);
      // If public user creation fails, clean up the auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw new AppError(
        `Failed to create user profile: ${publicUserError.message}`,
        500,
      );
    }

    // If user is instructor and has schoolId, create instructor_schools relationship
    if (userData.role === "INSTRUCTOR" && userData.schoolId) {
      const { error: instructorSchoolError } = await supabaseAdmin
        .from("instructor_schools")
        .insert({
          instructor_id: newUser.id,
          school_id: userData.schoolId,
          is_active: true,
        });

      if (instructorSchoolError) {
        console.error(
          "Error creating instructor-school relationship:",
          instructorSchoolError,
        );
        // Clean up if instructor_schools creation fails
        await supabaseAdmin.from("users").delete().eq("id", newUser.id);
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        throw new AppError(
          `Failed to link instructor to school: ${instructorSchoolError.message}`,
          500,
        );
      }
    }

    console.log("Successfully created user:", newUser);

    // Get permissions for the role
    const permissions = getPermissionsForRole(userData.role);

    return {
      id: newUser.id,
      email: authUser.user.email!,
      firstName: newUser.first_name || "",
      lastName: newUser.last_name || "",
      role: newUser.role,
      schoolId: newUser.school_id || undefined,
      ...(newUser.avatar && { avatar: newUser.avatar }),
      permissions,
      createdAt: newUser.created_at,
      updatedAt: newUser.updated_at,
    };
  } catch (error) {
    if (
      error instanceof AppError ||
      error instanceof ConflictError ||
      error instanceof NotFoundError
    ) {
      throw error;
    }
    throw new AppError("Failed to create user", 500);
  }
};

/**
 * Authenticate user login
 * @param loginData - Login credentials
 * @returns Login response with tokens
 */
export const authenticateUser = async (
  loginData: LoginRequest,
): Promise<LoginResponse> => {
  try {
    console.log("=== LOGIN ATTEMPT ===");
    console.log("Email:", loginData.email);
    console.log("Password length:", loginData.password.length);

    // Authenticate with Supabase Auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

    console.log("Supabase Auth Response:");
    console.log("- Error:", authError);
    console.log("- User ID:", authData.user?.id);
    console.log("- User Email:", authData.user?.email);

    if (authError) {
      console.error("Supabase Auth Error:", authError.message);
      throw new AuthenticationError("Invalid email or password");
    }

    if (!authData.user) {
      console.error("No user returned from Supabase Auth");
      throw new AuthenticationError("Invalid email or password");
    }

    // Get user profile from public.users
    console.log(
      "Fetching user profile from public.users for ID:",
      authData.user.id,
    );

    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", authData.user.id)
      .eq("is_active", true)
      .single();

    console.log("Public.users query result:");
    console.log("- Error:", userError);
    console.log("- User data:", user);

    if (userError) {
      console.error("Database error fetching user profile:", {
        message: userError.message,
        details: userError.details,
        hint: userError.hint,
        code: userError.code,
      });
      throw new AuthenticationError("User profile not found");
    }

    if (!user) {
      console.error("No user profile found for auth user:", authData.user.id);
      console.log(
        "This means the user exists in auth.users but not in public.users",
      );
      throw new AuthenticationError("User profile not found");
    }

    console.log("User profile found:", {
      id: user.id,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      school_id: user.school_id,
      is_active: user.is_active,
    });

    // Get permissions for the role
    console.log("Getting permissions for role:", user.role);
    const permissions = getPermissionsForRole(user.role);
    console.log("Permissions:", permissions);

    // Create JWT payload
    const payload: JWTPayload = {
      userId: user.id,
      email: authData.user.email!,
      role: user.role,
      schoolId: user.school_id || undefined,
    };

    console.log("JWT Payload:", payload);

    // Generate tokens
    console.log("Generating tokens...");
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    console.log("Tokens generated successfully");
    console.log("Access token length:", accessToken.length);
    console.log("Refresh token length:", refreshToken.length);

    // Create auth user object
    const authUser: AuthUser = {
      id: user.id,
      email: authData.user.email!,
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      role: user.role,
      schoolId: user.school_id || undefined,
      ...(user.avatar && { avatar: user.avatar }),
      permissions,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };

    console.log("Auth user object created:", {
      id: authUser.id,
      email: authUser.email,
      role: authUser.role,
      schoolId: authUser.schoolId,
    });

    const response = {
      success: true,
      user: authUser,
      token: accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
    };

    console.log("=== LOGIN SUCCESS ===");
    console.log("Response prepared successfully");

    return response;
  } catch (error) {
    console.error("=== LOGIN ERROR ===");
    console.error(
      "Error type:",
      error instanceof Error ? error.constructor.name : typeof error,
    );
    console.error(
      "Error message:",
      error instanceof Error ? error.message : String(error),
    );
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace",
    );

    if (error instanceof AuthenticationError) {
      console.error("Authentication error thrown");
      throw error;
    }

    console.error("Unknown error, throwing generic AppError");
    throw new AppError("Authentication failed", 500);
  }
};

/**
 * Refresh access token using refresh token
 * @param refreshData - Refresh token data
 * @returns New access token
 */
export const refreshAccessToken = async (
  refreshData: RefreshTokenRequest,
): Promise<{ token: string; expiresIn: number }> => {
  try {
    // Verify refresh token
    const payload = verifyToken(refreshData.refreshToken);

    // Get user from database to ensure they still exist and are active
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("id, role, school_id, is_active")
      .eq("id", payload.userId)
      .eq("is_active", true)
      .single();

    if (error || !user) {
      throw new AuthenticationError("User not found or inactive");
    }

    // Get user email from auth.users
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
      payload.userId,
    );
    if (!authUser.user) {
      throw new AuthenticationError("User not found in auth system");
    }

    // Create new JWT payload
    const newPayload: JWTPayload = {
      userId: user.id,
      email: authUser.user.email!,
      role: user.role,
      schoolId: user.school_id || undefined,
    };

    // Generate new access token
    const accessToken = generateAccessToken(newPayload);

    return {
      token: accessToken,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AppError("Token refresh failed", 500);
  }
};

/**
 * Get user by ID
 * @param userId - User ID
 * @returns User data
 */
export const getUserById = async (userId: string): Promise<AuthUser> => {
  try {
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", userId)
      .eq("is_active", true)
      .single();

    if (error || !user) {
      throw new NotFoundError("User not found");
    }

    // Get user email from auth.users
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
      userId,
    );
    if (!authUser.user) {
      throw new NotFoundError("User not found in auth system");
    }

    // Get permissions for the role
    const permissions = getPermissionsForRole(user.role);

    return {
      id: user.id,
      email: authUser.user.email!,
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      role: user.role,
      schoolId: user.school_id || undefined,
      ...(user.avatar && { avatar: user.avatar }),
      permissions,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new AppError("Failed to get user", 500);
  }
};

/**
 * Update user password
 * @param userId - User ID
 * @param currentPassword - Current password
 * @param newPassword - New password
 * @returns Success status
 */
export const updateUserPassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean }> => {
  try {
    // Get user email from auth.users
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
      userId,
    );
    if (!authUser.user) {
      throw new NotFoundError("User not found");
    }

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: authUser.user.email!,
      password: currentPassword,
    });

    if (signInError) {
      throw new AuthenticationError("Current password is incorrect");
    }

    // Update password using Supabase Auth
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

    if (updateError) {
      throw new AppError("Failed to update password", 500);
    }

    return { success: true };
  } catch (error) {
    if (
      error instanceof AuthenticationError ||
      error instanceof NotFoundError
    ) {
      throw error;
    }
    throw new AppError("Password update failed", 500);
  }
};

/**
 * Update user's school assignment
 * @param userId - User ID to update
 * @param schoolId - School ID to assign
 * @returns Updated user
 */
export const updateUserSchool = async (
  userId: string,
  schoolId: string,
): Promise<AuthUser> => {
  try {
    // Verify school exists
    const { data: school, error: schoolError } = await supabaseAdmin
      .from("schools")
      .select("id")
      .eq("id", schoolId)
      .single();

    if (schoolError || !school) {
      throw new NotFoundError("School not found");
    }

    // Update user's school_id
    const { data: updatedUser, error: userError } = await supabaseAdmin
      .from("users")
      .update({ school_id: schoolId })
      .eq("id", userId)
      .select("*")
      .single();

    if (userError || !updatedUser) {
      throw new AppError("Failed to update user school", 500);
    }

    // Get user email from auth.users
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
      userId,
    );
    if (!authUser.user) {
      throw new AppError("User not found in auth system", 404);
    }

    // Get permissions for the role
    const permissions = getPermissionsForRole(updatedUser.role);

    return {
      id: updatedUser.id,
      email: authUser.user.email!,
      firstName: updatedUser.first_name || "",
      lastName: updatedUser.last_name || "",
      role: updatedUser.role,
      schoolId: updatedUser.school_id || undefined,
      ...(updatedUser.avatar && { avatar: updatedUser.avatar }),
      permissions,
      createdAt: updatedUser.created_at,
      updatedAt: updatedUser.updated_at,
    };
  } catch (error) {
    if (error instanceof AppError || error instanceof NotFoundError) {
      throw error;
    }
    throw new AppError("Failed to update user school", 500);
  }
};

/**
 * Update user information
 * @param userId - User ID
 * @param updateData - User update data
 * @returns Updated user
 */
export const updateUser = async (
  userId: string,
  updateData: {
    firstName?: string;
    lastName?: string;
    email?: string;
    schoolId?: string;
    isActive?: boolean;
  },
): Promise<AuthUser> => {
  try {
    // Check if user exists
    const { data: existingUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError || !existingUser) {
      throw new NotFoundError("User not found");
    }

    const updateObject: any = {
      first_name: updateData.firstName || existingUser.first_name,
      last_name: updateData.lastName || existingUser.last_name,
      school_id:
        updateData.schoolId !== undefined
          ? updateData.schoolId
          : existingUser.school_id,
      updated_at: new Date().toISOString(),
    };

    if (updateData.isActive !== undefined) {
      updateObject.is_active = updateData.isActive;
    }

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from("users")
      .update(updateObject)
      .eq("id", userId)
      .select()
      .single();

    if (updateError || !updatedUser) {
      throw new AppError("Failed to update user", 500);
    }

    // Keep instructor_schools aligned when deactivating/reactivating instructors globally.
    if (existingUser.role === "INSTRUCTOR" && updateData.isActive !== undefined) {
      if (updateData.isActive === false) {
        const { error: deactivateLinksError } = await supabaseAdmin
          .from("instructor_schools")
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq("instructor_id", userId);

        if (deactivateLinksError) {
          throw new AppError("Failed to sync instructor school status", 500);
        }
      } else {
        // Global user reactivation should restore existing school links.
        const { error: reactivateLinksError } = await supabaseAdmin
          .from("instructor_schools")
          .update({
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("instructor_id", userId);

        if (reactivateLinksError) {
          throw new AppError("Failed to sync instructor school status", 500);
        }
      }
    }

    // Update email in auth.users if provided
    if (updateData.email) {
      const { error: authUpdateError } =
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          email: updateData.email,
        });

      if (authUpdateError) {
        throw new AppError("Failed to update user email", 500);
      }
    }

    // Get user email from auth.users
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
      userId,
    );
    if (!authUser.user) {
      throw new AppError("User not found in auth system", 404);
    }

    // Get permissions for the role
    const permissions = getPermissionsForRole(updatedUser.role);

    return {
      id: updatedUser.id,
      email: authUser.user.email!,
      firstName: updatedUser.first_name || "",
      lastName: updatedUser.last_name || "",
      role: updatedUser.role,
      schoolId: updatedUser.school_id || undefined,
      isActive: updatedUser.is_active,
      ...(updatedUser.avatar && { avatar: updatedUser.avatar }),
      permissions,
      createdAt: updatedUser.created_at,
      updatedAt: updatedUser.updated_at,
    };
  } catch (error) {
    if (error instanceof AppError || error instanceof NotFoundError) {
      throw error;
    }
    throw new AppError("Failed to update user", 500);
  }
};

/**
 * Deactivate user account
 * @param userId - User ID
 * @returns Success status
 */
export const deactivateUser = async (
  userId: string,
): Promise<{ success: boolean }> => {
  try {
    const { data: existingUser, error: existingUserError } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (existingUserError || !existingUser) {
      throw new NotFoundError("User not found");
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      throw new AppError("Failed to deactivate user", 500);
    }

    if (existingUser.role === "INSTRUCTOR") {
      const { error: deactivateLinksError } = await supabaseAdmin
        .from("instructor_schools")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("instructor_id", userId);

      if (deactivateLinksError) {
        throw new AppError("Failed to sync instructor school status", 500);
      }
    }

    return { success: true };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("User deactivation failed", 500);
  }
};

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const requestPasswordReset = async (
  email: string,
): Promise<{ success: boolean }> => {
  try {
    const authUser = await findAuthUserByEmail(email);

    if (!authUser) {
      throw new NotFoundError("User with this email");
    }

    const normalizedEmail = normalizeAuthEmail(email);
    const deliveryEmail = authUser.email ?? normalizedEmail;

    const otp = generateOTP();
    const hashedOTP = await hashPassword(otp);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    await supabaseAdmin
      .from("password_reset_otps")
      .update({ is_used: true })
      .eq("email", normalizedEmail)
      .eq("is_used", false);

    // Store the hashed OTP in database
    const { error: insertError } = await supabaseAdmin
      .from("password_reset_otps")
      .insert({
        email: normalizedEmail,
        otp: hashedOTP,
        expires_at: expiresAt.toISOString(),
        is_used: false,
      });

    if (insertError) {
      console.error("Failed to store password reset OTP:", insertError);
      throw new AppError("Failed to store password reset code", 500);
    }

    // Send OTP email (only if user exists)
    try {
     
      await emailService.sendPasswordResetOTP(deliveryEmail, otp);
    } catch (emailError: any) {
      
      throw new AppError("Failed to send password reset email", 500);
    }

    return { success: true };
  } catch (error) {
    throw error;
  }
};

export const resetPasswordWithOTP = async (
  email: string,
  otp: string,
  newPassword: string,
): Promise<{ success: boolean }> => {
  try {
    const normalizedEmail = normalizeAuthEmail(email);

    // Get the most recent unused OTP for this email
    const { data: otpRecords, error: fetchError } = await supabaseAdmin
      .from("password_reset_otps")
      .select("*")
      .eq("email", normalizedEmail)
      .eq("is_used", false)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError || !otpRecords || otpRecords.length === 0) {
      throw new AuthenticationError("Invalid or expired verification code");
    }

    const otpRecord = otpRecords[0];
    if (!otpRecord) {
      throw new AuthenticationError("Invalid or expired verification code");
    }

    const now = new Date();
    const expiresAt = new Date(otpRecord.expires_at);
    if (now > expiresAt) {
      throw new AuthenticationError("Invalid or expired verification code");
    }

    const isValidOTP = await comparePassword(otp, otpRecord.otp);
    if (!isValidOTP) {
      throw new AuthenticationError("Invalid or expired verification code");
    }

    const authUser = await findAuthUserByEmail(email);

    if (!authUser) {
      throw new NotFoundError("User");
    }

    // Update password in Supabase Auth
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        password: newPassword,
      });

    if (updateError) {
      console.error("Failed to update password:", updateError);
      throw new AppError("Failed to reset password", 500);
    }

    await supabaseAdmin
      .from("password_reset_otps")
      .update({ is_used: true })
      .eq("id", otpRecord.id);

    return { success: true };
  } catch (error) {
    if (
      error instanceof AuthenticationError ||
      error instanceof NotFoundError
    ) {
      throw error;
    }
    throw new AppError("Password reset failed", 500);
  }
};
