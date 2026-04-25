/**
 * @fileoverview Supabase database client configuration
 * @description Centralized Supabase client setup with proper error handling and connection management
 * @author Ridesk Team
 * @version 1.0.0
 */

import { createClient } from "@supabase/supabase-js";
import { Database } from "./types";
import { env } from "../config/env";

// Create Supabase clients
export const supabase = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    db: {
      schema: "public",
    },
  },
);

// Service role client for admin operations
export const supabaseAdmin = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: "public",
    },
    global: {
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  },
);

// Database connection health check
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from("schools").select("id").limit(1);

    if (error) {
      console.error("Database connection failed:", error);
      return false;
    }

    console.log("✅ Database connection successful");
    return true;
  } catch (error) {
    console.error("Database connection error:", error);
    return false;
  }
};

// Test admin connection
export const checkAdminConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabaseAdmin.from("schools").select("id").limit(1);

    if (error) {
      console.error("Admin database connection failed:", error);
      return false;
    }

    console.log("✅ Admin database connection successful");
    return true;
  } catch (error) {
    console.error("Admin database connection error:", error);
    return false;
  }
};

export default supabase;
