/**
 * @fileoverview Environment configuration for Ridesk Server
 * @description Centralized environment variable loading and validation
 * @author Ridesk Team
 * @version 1.0.0
 */

import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Environment variable validation
const requiredEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "JWT_SECRET",
] as const;

// Note: Email configuration variables are optional
// If not provided, email sending will be skipped

// Validate required environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Environment configuration object
export const env = {
  // Server Configuration
  NODE_ENV: process.env["NODE_ENV"] || "development",
  PORT: parseInt(process.env["PORT"] || "3001", 10),

  // Supabase Configuration
  SUPABASE_URL: process.env["SUPABASE_URL"]!,
  SUPABASE_ANON_KEY: process.env["SUPABASE_ANON_KEY"]!,
  SUPABASE_SERVICE_ROLE_KEY: process.env["SUPABASE_SERVICE_ROLE_KEY"]!,

  // JWT Configuration
  JWT_SECRET: process.env["JWT_SECRET"]!,
  JWT_EXPIRES_IN: process.env["JWT_EXPIRES_IN"] || "7d",

  // CORS Configuration
  CORS_ORIGIN: process.env["CORS_ORIGIN"] || "http://localhost:3000",

  // Client URL for invitation links
  CLIENT_URL: process.env["CLIENT_URL"] || "http://localhost:3000",

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(
    process.env["RATE_LIMIT_WINDOW_MS"] || "900000",
    10,
  ),
  RATE_LIMIT_MAX_REQUESTS: parseInt(
    process.env["RATE_LIMIT_MAX_REQUESTS"] || "100",
    10,
  ),

  // Database Configuration
  DB_POOL_SIZE: parseInt(process.env["DB_POOL_SIZE"] || "10", 10),
  DB_CONNECTION_TIMEOUT: parseInt(
    process.env["DB_CONNECTION_TIMEOUT"] || "30000",
    10,
  ),

  // Email Configuration (SMTP - kept as fallback)
  SMTP_HOST: process.env["SMTP_HOST"] || "smtp.gmail.com",
  SMTP_PORT: parseInt(process.env["SMTP_PORT"] || "587", 10),
  SMTP_USER: process.env["SMTP_USER"] || "",
  SMTP_PASS: process.env["SMTP_PASS"] || "",
  SMTP_FROM_EMAIL: process.env["SMTP_FROM_EMAIL"] || "",
  SMTP_FROM_NAME: process.env["SMTP_FROM_NAME"] || "Ridesk",

  // Loop Email Configuration
  LOOPS_API_KEY: process.env["LOOPS_API_KEY"] || "",
  LOOPS_TRANSACTIONAL_ID_USER_INVITATION: process.env["LOOPS_TRANSACTIONAL_ID_USER_INVITATION"] || "",
  LOOPS_TRANSACTIONAL_ID_PASSWORD_RESET: process.env["LOOPS_TRANSACTIONAL_ID_PASSWORD_RESET"] || "",
  LOOPS_TRANSACTIONAL_ID_STUDENT_FORM: process.env["LOOPS_TRANSACTIONAL_ID_STUDENT_FORM"] || "",

  UPLOADTHING_TOKEN: process.env["UPLOADTHING_TOKEN"] || "",
} as const;

// Type for environment configuration
export type EnvConfig = typeof env;

// Validation function
export const validateEnv = (): void => {
  const missingVars: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingVars.push(envVar);
    }
  }

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}\n` +
        `Please check your .env file and ensure all required variables are set.`,
    );
  }
};

// Log environment status (only in development)
if (env.NODE_ENV === "development") {
  console.log("🔧 Environment Configuration:");
  console.log(`   NODE_ENV: ${env.NODE_ENV}`);
  console.log(`   PORT: ${env.PORT}`);
  console.log(`   CORS_ORIGIN: ${env.CORS_ORIGIN}`);
  console.log(
    `   RATE_LIMIT: ${env.RATE_LIMIT_MAX_REQUESTS} requests per ${env.RATE_LIMIT_WINDOW_MS}ms`,
  );
  console.log(`   SUPABASE_URL: ${env.SUPABASE_URL ? "✅ Set" : "❌ Missing"}`);
  console.log(`   JWT_SECRET: ${env.JWT_SECRET ? "✅ Set" : "❌ Missing"}`);
  console.log(`   SMTP_HOST: ${env.SMTP_HOST}`);
  console.log(`   SMTP_USER: ${env.SMTP_USER ? "✅ Set" : "❌ Missing"}`);
  console.log(
    `   SMTP_FROM_EMAIL: ${env.SMTP_FROM_EMAIL ? "✅ Set" : "❌ Missing"}`,
  );
  console.log(
    `   LOOPS_API_KEY: ${env.LOOPS_API_KEY ? "✅ Set" : "❌ Missing"}`,
  );
  console.log(
    `   LOOPS_TRANSACTIONAL_ID_USER_INVITATION: ${env.LOOPS_TRANSACTIONAL_ID_USER_INVITATION ? "✅ Set" : "❌ Missing"}`,
  );
  console.log(
    `   LOOPS_TRANSACTIONAL_ID_PASSWORD_RESET: ${env.LOOPS_TRANSACTIONAL_ID_PASSWORD_RESET ? "✅ Set" : "❌ Missing"}`,
  );
  console.log(
    `   LOOPS_TRANSACTIONAL_ID_STUDENT_FORM: ${env.LOOPS_TRANSACTIONAL_ID_STUDENT_FORM ? "✅ Set" : "❌ Missing"}`,
  );
  console.log(
    `   UPLOADTHING_TOKEN: ${env.UPLOADTHING_TOKEN ? "✅ Set" : "❌ Missing"}`,
  );
}

if (!env.UPLOADTHING_TOKEN && env.NODE_ENV === "production") {
  console.warn("⚠️  UPLOADTHING_TOKEN not set - file uploads will fail");
}

export default env;
