/**
 * @fileoverview User invitation service for Ridesk Server
 * @description Handles user invitations
 * @author Ridesk Team
 * @version 1.0.0
 */

import { supabaseAdmin } from "../database/supabase";
import { UserInvitation, AppError, NotFoundError } from "../types";
import { env } from "../config/env";
import { getRoleDisplayName } from "../utils/roleUtils";
import { emailService } from "./email";
import { getSchoolById } from "./schools";

export interface InvitationsListResponse {
  invitations: UserInvitation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Get invitation by token
 * @param token - Invitation token
 * @returns Invitation data
 */
export const getInvitationByToken = async (
  token: string,
): Promise<UserInvitation> => {
  const { data, error } = await supabaseAdmin
    .from("user_invitations")
    .select(
      `
      id,
      email,
      first_name,
      last_name,
      role,
      school_id,
      invited_by,
      invited_by_name,
      invitation_token,
      expires_at,
      is_used,
      user_id,
      created_at,
      updated_at
    `,
    )
    .eq("invitation_token", token)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new NotFoundError("Invitation not found");
    }
    throw new AppError("Failed to get invitation", 500);
  }

  // Check if invitation is expired
  if (new Date(data.expires_at) < new Date()) {
    throw new AppError("Invitation has expired", 400);
  }

  // Check if invitation is already used
  if (data.is_used) {
    throw new AppError("Invitation has already been used", 400);
  }

  return {
    id: data.id,
    email: data.email,
    firstName: data.first_name,
    lastName: data.last_name,
    role: data.role,
    schoolId: data.school_id,
    invitedBy: data.invited_by,
    invitedByName: data.invited_by_name,
    invitationToken: data.invitation_token,
    expiresAt: data.expires_at,
    isUsed: data.is_used,
    userId: data.user_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
};

/**
 * Accept invitation and activate user account
 * @param token - Invitation token
 * @param password - User password
 * @returns Activated user data
 */
export const acceptInvitation = async (
  token: string,
  password: string,
): Promise<any> => {
  console.log("Starting invitation acceptance process for token:", token);

  // Add timeout wrapper to prevent hanging
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new AppError("Invitation acceptance timed out", 408));
    }, 30000); // 30 second timeout
  });

  const processInvitation = async () => {
    // Get invitation data
    const invitation = await getInvitationByToken(token);
    console.log("Invitation found:", {
      email: invitation.email,
      role: invitation.role,
      userId: invitation.userId,
    });

    // Check if user already exists in auth system
    // Use a more efficient approach - check if user exists by trying to get them by ID from invitation
    let existingUser = null;
    let existingPublicUser = null;

    // First, check if there's a user_id in the invitation (new flow)
    if (invitation.userId) {
      try {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
          invitation.userId,
        );
        existingUser = authUser.user;

        // Get the public user record
        const { data: publicUser } = await supabaseAdmin
          .from("users")
          .select("*")
          .eq("id", invitation.userId)
          .single();
        existingPublicUser = publicUser;
      } catch (error) {
        console.log("User not found by ID:", invitation.userId);
      }
    } else {
      // Fallback: try to find user by email (less efficient but necessary for old invitations)
      try {
        const { data: existingUsers } =
          await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 100, // Small limit to avoid timeout
          });
        existingUser = existingUsers.users.find(
          (u) => u.email === invitation.email,
        );

        if (existingUser) {
          const { data: publicUser } = await supabaseAdmin
            .from("users")
            .select("*")
            .eq("id", existingUser.id)
            .single();
          existingPublicUser = publicUser;
        }
      } catch (error) {
        console.log("Error checking for existing user:", error);
      }
    }

    // If user exists, always update password & confirm email, then handle activation/linking
    if (existingUser && existingPublicUser && !existingPublicUser.is_active) {
      // Update the user's password and confirm their email
      const { error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          password: password,
          email_confirm: true, // Confirm the email so user can login
        });

      if (updateError) {
        console.error("Failed to set password and confirm email:", updateError);
        console.error("Error details:", {
          message: updateError.message,
          status: updateError.status,
        });
        throw new AppError("Failed to set password", 500);
      }

      console.log(
        "Successfully updated password and confirmed email for user:",
        existingUser.id,
      );

      // Activate the user
      console.log("Activating user in database:", existingUser.id);
      const { data: user, error: userError } = await supabaseAdmin
        .from("users")
        .update({ is_active: true })
        .eq("id", existingUser.id)
        .select()
        .single();

      if (userError || !user) {
        console.error("Failed to activate user:", userError);
        throw new AppError("Failed to activate user", 500);
      }

      console.log("Successfully activated user:", user.id, "Role:", user.role);

      // For instructors, ensure they're linked to the school via instructor_schools table
      if (user.role === "INSTRUCTOR" && invitation.schoolId) {
        const { error: linkError } = await supabaseAdmin
          .from("instructor_schools")
          .upsert({
            instructor_id: user.id,
            school_id: invitation.schoolId,
            is_primary: true,
          });

        if (linkError) {
          console.error("Failed to link instructor to school:", linkError);
        }
      }

      // Mark invitation as used
      await supabaseAdmin
        .from("user_invitations")
        .update({ is_used: true })
        .eq("invitation_token", token);

      return user;
    }

    // If user exists and is already active, update password & just link to school
    if (existingUser && existingPublicUser && existingPublicUser.is_active) {
      // Update the user's password and confirm their email
      const { error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          password: password,
          email_confirm: true,
        });

      if (updateError) {
        console.error("Failed to set password for active user:", updateError);
        console.error("Error details:", {
          message: updateError.message,
          status: updateError.status,
        });
        throw new AppError("Failed to set password", 500);
      }

      // For instructors, link via instructor_schools table
      if (existingPublicUser.role === "INSTRUCTOR" && invitation.schoolId) {

        // Check if they already have a primary school
        const { data: existingPrimary } = await supabaseAdmin
          .from("instructor_schools")
          .select("is_primary")
          .eq("instructor_id", existingUser.id)
          .eq("is_primary", true)
          .single();

        // If they have no primary school, this one becomes primary. 
        // If they DO have one, this one is just an additional school (not primary).
        const isPrimary = !existingPrimary;

        const { error: linkError } = await supabaseAdmin
          .from("instructor_schools")
          .upsert({
            instructor_id: existingUser.id,
            school_id: invitation.schoolId,
            is_primary: isPrimary,
            is_active: true
          });

        if (linkError) {
          console.error("Failed to link instructor to school:", linkError);
        }
      } else if (existingPublicUser.role === "USER" && invitation.schoolId) {
        const { data: existingPrimary } = await (supabaseAdmin as any)
          .from("student_schools")
          .select("id")
          .eq("student_id", existingUser.id)
          .eq("is_primary", true)
          .maybeSingle();

        const { error: linkError } = await (supabaseAdmin as any)
          .from("student_schools")
          .upsert(
            {
              student_id: existingUser.id,
              school_id: invitation.schoolId,
              is_primary: !existingPrimary,
              is_active: true,
            },
            { onConflict: "student_id,school_id" },
          );

        if (linkError) {
          throw new AppError(
            `Failed to link student ${existingUser.id} to school ${invitation.schoolId}: ${linkError.message}`,
            500,
          );
        }

        const { data: existingSchool } = await supabaseAdmin
          .from("users")
          .select("school_id")
          .eq("id", existingUser.id)
          .maybeSingle();

        if (!existingSchool?.school_id) {
          const { error: updateError } = await supabaseAdmin
            .from("users")
            .update({ school_id: invitation.schoolId })
            .eq("id", existingUser.id);

          if (updateError) {
            throw new AppError(
              `Failed to update primary school for user ${existingUser.id} and school ${invitation.schoolId}: ${updateError.message}`,
              500,
            );
          }
        }
      }

      // Mark invitation as used
      await supabaseAdmin
        .from("user_invitations")
        .update({ is_used: true })
        .eq("invitation_token", token);

      return existingPublicUser;
    }

    // This should not happen in the new system
    throw new AppError("User not found in system", 500);
  };

  // Race the invitation process against the timeout
  return Promise.race([processInvitation(), timeoutPromise]);
};

/**
 * Resend an invitation email
 * @param invitationId - Invitation ID
 * @param schoolId - Optional school ID for authorization (required for SCHOOL_ADMIN)
 * @returns Success status
 */
export const resendInvitation = async (
  invitationId: string,
  schoolId?: string,
): Promise<{ success: boolean }> => {
  // Get invitation by ID
  const { data: invitation, error } = await supabaseAdmin
    .from("user_invitations")
    .select("*")
    .eq("id", invitationId)
    .single();

  if (error || !invitation) {
    throw new NotFoundError("Invitation not found");
  }

  // Authorization: If schoolId is provided, verify invitation belongs to that school
  if (schoolId && invitation.school_id !== schoolId) {
    throw new AppError("You don't have permission to resend this invitation", 403);
  }

  // Prevent resending already-accepted invitations (checked above, but also enforced atomically)
  if (invitation.is_used) {
    throw new AppError("Cannot resend an already-accepted invitation", 400);
  }

  // Update expiry to 7 days from now - use atomic update with is_used check to prevent race conditions
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data: updatedInvitation, error: updateError } = await supabaseAdmin
    .from("user_invitations")
    .update({
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .eq("is_used", false) // Atomic: only update if still unused
    .select()
    .single();

  // If no rows updated, invitation was accepted concurrently
  if (updateError || !updatedInvitation) {
    throw new AppError("Invitation was already accepted or could not be updated", 400);
  }

  // Resend email
  let schoolName = "Your School";
  try {
    if (invitation.school_id) {
      const school = await getSchoolById(invitation.school_id);
      if (school?.name) schoolName = school.name;
    }
  } catch {
    // Use default school name
  }

  const baseUrl = env.CLIENT_URL;

  await emailService.sendUserInvitation({
    to: invitation.email,
    firstName: invitation.first_name,
    lastName: invitation.last_name,
    schoolName,
    role: getRoleDisplayName(invitation.role),
    invitationToken: invitation.invitation_token,
    expiresAt: expiresAt.toISOString(),
    baseUrl,
  });

  return { success: true };
};

/**
 * Get paginated list of invitations
 * @param schoolId - Optional school ID for filtering
 * @param page - Page number (default: 1)
 * @param limit - Items per page (default: 20)
 * @param isUsed - Filter by isUsed status (default: false for pending invitations)
 * @returns Paginated list of invitations
 */
export const getInvitations = async (
  schoolId?: string,
  page: number = 1,
  limit: number = 20,
  isUsed: boolean = false,
): Promise<InvitationsListResponse> => {
  try {
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("user_invitations")
      .select(
        `
        id,
        email,
        first_name,
        last_name,
        role,
        school_id,
        invited_by,
        invited_by_name,
        invitation_token,
        expires_at,
        is_used,
        user_id,
        created_at,
        updated_at
      `,
        { count: "exact" },
      )
      .eq("is_used", isUsed);

    if (schoolId) {
      query = query.eq("school_id", schoolId);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new AppError("Failed to fetch invitations", 500);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    const invitations: UserInvitation[] = (data || []).map((inv) => ({
      id: inv.id,
      email: inv.email,
      firstName: inv.first_name,
      lastName: inv.last_name,
      role: inv.role,
      schoolId: inv.school_id,
      invitedBy: inv.invited_by,
      invitedByName: inv.invited_by_name,
      invitationToken: inv.invitation_token,
      expiresAt: inv.expires_at,
      isUsed: inv.is_used,
      userId: inv.user_id,
      createdAt: inv.created_at,
      updatedAt: inv.updated_at,
    }));

    return {
      invitations,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to fetch invitations", 500);
  }
};

/**
 * Get invitation by user ID (most recent pending invitation)
 * @param userId - User ID
 * @param schoolId - Optional school ID for filtering
 * @returns Invitation data or null if not found
 */
export const getInvitationByUserId = async (
  userId: string,
  schoolId?: string,
): Promise<UserInvitation | null> => {
  let query = supabaseAdmin
    .from("user_invitations")
    .select(
      `
      id,
      email,
      first_name,
      last_name,
      role,
      school_id,
      invited_by,
      invited_by_name,
      invitation_token,
      expires_at,
      is_used,
      user_id,
      created_at,
      updated_at
    `,
    )
    .eq("user_id", userId)
    .eq("is_used", false)
    .order("created_at", { ascending: false })
    .limit(1);

  if (schoolId) {
    query = query.eq("school_id", schoolId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // No invitation found
    }
    throw new AppError("Failed to get invitation", 500);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    firstName: data.first_name,
    lastName: data.last_name,
    role: data.role,
    schoolId: data.school_id,
    invitedBy: data.invited_by,
    invitedByName: data.invited_by_name,
    invitationToken: data.invitation_token,
    expiresAt: data.expires_at,
    isUsed: data.is_used,
    userId: data.user_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
};
