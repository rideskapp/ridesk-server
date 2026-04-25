/**
 * @fileoverview Authentication and authorization middleware
 * @description Middleware for JWT token validation and role-based access control
 * @author Ridesk Team
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/auth";
import {
  AuthenticationError,
  AuthorizationError,
  AppError,
  AuthenticatedRequest,
  UserRole,
  UserPermissions,
} from "../types";
import { getPermissionsForRole, hasPermission } from "../services/permissions";

/**
 * Extract JWT token from Authorization header
 * @param req - Express request
 * @returns JWT token or null
 */
export const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Check for Bearer token format
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1] || null;
};

/**
 * Authentication middleware - validates JWT token
 * @param req - Express request
 * @param res - Express response
 * @param next - Next function
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new AuthenticationError("No token provided");
    }

    // Verify token
    const payload = verifyToken(token);

    const { getUserById } = await import("../services/auth");
    const currentUser = await getUserById(payload.userId);

    (req as unknown as AuthenticatedRequest).user = {
      id: currentUser.id,
      email: currentUser.email,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      role: currentUser.role,
      schoolId: currentUser.schoolId,
      permissions: getPermissionsForRole(currentUser.role),
      createdAt: currentUser.createdAt,
      updatedAt: currentUser.updatedAt,
    };

    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      res.status(401).json({
        success: false,
        error: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: "Authentication failed",
    });
  }
};

/**
 * Authorization middleware - checks if user has required permission
 * @param permission - Required permission
 * @returns Middleware function
 */
export const authorize = (permission: keyof UserPermissions) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;

      if (!authReq.user) {
        throw new AuthenticationError("User not authenticated");
      }

      if (!hasPermission(authReq.user.role, permission)) {
        throw new AuthorizationError(
          `Insufficient permissions: ${permission} required`,
        );
      }

      next();
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof AuthorizationError
      ) {
        res.status(error instanceof AuthenticationError ? 401 : 403).json({
          success: false,
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: "Authorization failed",
      });
    }
  };
};

/**
 * Role-based authorization middleware
 * @param allowedRoles - Array of allowed roles
 * @returns Middleware function
 */
export const authorizeRoles = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;

      if (!authReq.user) {
        throw new AuthenticationError("User not authenticated");
      }

      if (!allowedRoles.includes(authReq.user.role)) {
        throw new AuthorizationError(
          `Access denied. Required roles: ${allowedRoles.join(", ")}`,
        );
      }

      next();
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof AuthorizationError
      ) {
        res.status(error instanceof AuthenticationError ? 401 : 403).json({
          success: false,
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: "Authorization failed",
      });
    }
  };
};

/**
 * School access middleware - ensures user can access school data
 * @param req - Express request
 * @param res - Express response
 * @param next - Next function
 */
export const authorizeSchoolAccess = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;

    if (!authReq.user) {
      throw new AuthenticationError("User not authenticated");
    }

    // SUPER_ADMIN can access all schools
    if (authReq.user.role === "SUPER_ADMIN") {
      next();
      return;
    }

    // Get school ID from params or body
    const schoolId =
      req.params["schoolId"] ||
      req.body["schoolId"] ||
      authReq.user["schoolId"];

    if (!schoolId) {
      throw new AuthorizationError("School ID required");
    }

    // INSTRUCTOR: Check instructor_schools association
    if (authReq.user.role === "INSTRUCTOR") {
      const { supabaseAdmin } = await import("../database/supabase");
      const { data: association, error } = await supabaseAdmin
        .from("instructor_schools")
        .select("school_id")
        .eq("instructor_id", authReq.user.id)
        .eq("school_id", schoolId)
        .maybeSingle();

      if (error || !association) {
        throw new AuthorizationError("Access denied to this school");
      }

      // Add school ID to request for convenience
      authReq.schoolId = schoolId;
      next();
      return;
    }

    // SCHOOL_ADMIN and others: Check user.schoolId
    if (authReq.user.schoolId !== schoolId) {
      throw new AuthorizationError("Access denied to this school");
    }

    // Add school ID to request for convenience
    authReq.schoolId = schoolId;

    next();
  } catch (error) {
    if (
      error instanceof AuthenticationError ||
      error instanceof AuthorizationError
    ) {
      res.status(error instanceof AuthenticationError ? 401 : 403).json({
        success: false,
        error: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: "School access authorization failed",
    });
  }
};

/**
 * Optional authentication middleware - validates token if present
 * @param req - Express request
 * @param res - Express response
 * @param next - Next function
 */
export const optionalAuth = (
  _req: Request,
  _res: Response,
  _next: NextFunction,
): void => {
  try {
    const token = extractToken(_req);

    if (token) {
      // Verify token and add user info
      const payload = verifyToken(token);
      (_req as unknown as AuthenticatedRequest).user = {
        id: payload.userId,
        email: payload.email,
        firstName: "", // Will be populated by getUserById if needed
        lastName: "", // Will be populated by getUserById if needed
        role: payload.role,
        schoolId: payload.schoolId,
        permissions: getPermissionsForRole(payload.role),
        createdAt: "",
        updatedAt: "",
      };
    }

    _next();
  } catch (error) {
    // For optional auth, we don't fail on invalid tokens
    _next();
  }
};

/**
 * Rate limiting middleware (placeholder - implement with express-rate-limit)
 * @param req - Express request
 * @param res - Express response
 * @param next - Next function
 */
export const rateLimit = (
  _req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  // This is a placeholder - implement with express-rate-limit
  // For now, just pass through
  next();
};

/**
 * Error handling middleware
 * @param error - Error object
 * @param req - Express request
 * @param res - Express response
 * @param next - Next function
 */
export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  console.error("=== ERROR HANDLER ===");
  console.error("Error type:", error.constructor.name);
  console.error("Error message:", error.message);
  console.error("Error stack:", error.stack);

  if (error instanceof AppError) {
    console.error("AppError - Status Code:", error.statusCode);
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
    });
    return;
  }

  // Default error response
  console.error("Unknown error type, returning 500");
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
};

/**
 * Not found middleware
 * @param req - Express request
 * @param res - Express response
 * @param next - Next function
 */
export const notFound = (
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
};
