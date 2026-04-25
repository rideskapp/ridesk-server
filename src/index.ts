/**
 * @fileoverview Main server entry point for Ridesk Server
 * @description Express server setup with all middleware, routes, and error handling
 * @author Ridesk Team
 * @version 1.0.0
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
// import rateLimit from "express-rate-limit"; // Temporarily disabled
// import swaggerUi from "swagger-ui-express"; // Using CDN-based Swagger UI
import { swaggerSpec } from "./config/swagger";
import { env, validateEnv } from "./config/env";

// Import middleware
import { errorHandler, notFound } from "./middleware/auth";

// Import routes
import authRoutes from "./routes/auth";
import schoolRoutes from "./routes/schools";
import instructorSchoolRoutes from "./routes/instructorSchools";
import studentRoutes from "./routes/students";
import instructorRoutes from "./routes/instructors";
import instructorProfileRoutes from "./routes/instructor-profile";
import instructorRegistrationRoutes from "./routes/instructorRegistration";
import studentRegistrationRoutes from "./routes/studentRegistration";
import studentProfileRoutes from "./routes/student-profile";
import userInvitationRoutes from "./routes/userInvitations";
import studentFormRoutes from "./routes/studentForm";
import availabilityRoutes from "./routes/availability";
import lessonRoutes from "./routes/lessons";
import disciplinesRoutes from "./routes/disciplines";
import schoolCalendarRoutes from "./routes/schoolCalendar";
import studentLevelsRoutes from "./routes/studentLevels";
import productCategoriesRoutes from "./routes/productCategories";
import productsRoutes from "./routes/products";
import bookingsRoutes from "./routes/bookings";
import systemConfigRoutes from "./routes/systemConfig";
import lessonStatusesRoutes from "./routes/lessonStatuses";
import paymentStatusesRoutes from "./routes/paymentStatuses";
import schoolSettingsRoutes from "./routes/schoolSettings";
import compensationRoutes from "./routes/compensation";
import reportingRoutes from "./routes/reporting";
import instructorLessonPermissionRoutes from "./routes/instructorLessonPermissions";
import { createRouteHandler } from "uploadthing/express";
import { uploadRouter } from "./uploadthing";

// Import database connection
import {
  checkDatabaseConnection,
  checkAdminConnection,
} from "./database/supabase";

// Validate environment variables
validateEnv();

const app = express();
const PORT = env.PORT;

// Trust proxy for Vercel serverless environment
// Vercel sets VERCEL=1 when running on their platform
const isVercel = process.env["VERCEL"] === "1";
app.set("trust proxy", isVercel ? 1 : false);

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

if (process.env["NODE_ENV"] === "development") {
  // CORS configuration for local development
  app.use(
    cors({
      origin: [
        "http://localhost:3000", // React dev server
        "http://localhost:5173", // Vite dev server
        "http://localhost:4173", // Vite preview
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:4173",
      ],
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "x-uploadthing-package",
        "x-uploadthing-version",
        "x-uploadthing-behavior",
        "traceparent",
        "b3",
      ],
    }),
  );
}

app.use(
  "/api/uploadthing",
  createRouteHandler({
    router: uploadRouter,
  }),
);

app.use(compression());

// Request logging
app.use(morgan("combined"));

// Rate limiting - Temporarily disabled
// const limiter = rateLimit({
//   windowMs: env.RATE_LIMIT_WINDOW_MS, // 15 minutes
//   max: env.RATE_LIMIT_MAX_REQUESTS, // limit each IP to 100 requests per windowMs
//   message: {
//     success: false,
//     error: "Too many requests from this IP, please try again later.",
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// app.use((req, res, next) => {
//   if (req.path.startsWith("/api/uploadthing")) {
//     return next(); 
//   }
//   return limiter(req, res, next);
// });

// Body parsing middleware (must come after UploadThing route)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ============================================================================
// HEALTH CHECK ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: Check if the server is running and healthy
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Ridesk Server is running"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-01T00:00:00.000Z"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 */
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "Ridesk Server is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

/**
 * @swagger
 * /health/database:
 *   get:
 *     summary: Database health check
 *     description: Check if the database connections are working properly
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Database is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Database health check completed"
 *                 database:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                       example: true
 *                     adminConnected:
 *                       type: boolean
 *                       example: true
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-01T00:00:00.000Z"
 *       500:
 *         description: Database connection failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Database health check failed"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-01T00:00:00.000Z"
 */
app.get("/health/database", async (_req, res) => {
  try {
    const isConnected = await checkDatabaseConnection();
    const isAdminConnected = await checkAdminConnection();

    res.json({
      success: true,
      message: "Database health check completed",
      database: {
        connected: isConnected,
        adminConnected: isAdminConnected,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Database health check failed",
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================================================
// API ROUTES
// ============================================================================

// Swagger API Documentation - CDN-based for Vercel serverless
app.get("/api/docs", (_req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ridesk API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
    <style>
        html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin:0; background: #fafafa; }
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info .title { color: #3b4151; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: '/api/docs/swagger.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                validatorUrl: null,
                onComplete: function() {
                    console.log('Swagger UI loaded successfully');
                }
            });
        };
    </script>
</body>
</html>`;
  res.send(html);
});

// Swagger JSON endpoint
app.get("/api/docs/swagger.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json(swaggerSpec);
});

// Authentication routes
app.use("/api/auth", authRoutes);

// School management routes
app.use("/api/schools", schoolRoutes);

// Instructor-School management routes
app.use("/api/instructor-schools", instructorSchoolRoutes);

// Student management routes
app.use("/api/students", studentRoutes);

// Instructor management routes
app.use("/api/instructors", instructorRoutes);

// Public instructor registration (per-school)
app.use("/api/instructor-registration", instructorRegistrationRoutes);
// Public student registration (per-school)
app.use("/api/student-registration", studentRegistrationRoutes);

// Role-specific profile routes
app.use("/api/instructor", instructorProfileRoutes);
app.use("/api/student", studentProfileRoutes);

app.use("/api/invitations", userInvitationRoutes);
app.use("/api/student-form", studentFormRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/disciplines", disciplinesRoutes);
app.use("/api/schools/:schoolId/calendar", schoolCalendarRoutes);
app.use("/api/student-levels", studentLevelsRoutes);
app.use("/api/product-categories", productCategoriesRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/compensation", compensationRoutes);
app.use("/api/system-config", systemConfigRoutes);
app.use("/api/lesson-statuses", lessonStatusesRoutes);
app.use("/api/payment-statuses", paymentStatusesRoutes);
app.use("/api/reporting", reportingRoutes);
app.use("/api/school-settings", schoolSettingsRoutes);
app.use("/api/instructor-lesson-permissions", instructorLessonPermissionRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// ============================================================================
// SERVER STARTUP
// ============================================================================

const startServer = async () => {
  try {
    // Check database connections
    console.log("🔍 Checking database connections...");
    const isConnected = await checkDatabaseConnection();
    const isAdminConnected = await checkAdminConnection();

    if (!isConnected || !isAdminConnected) {
      console.error("❌ Database connection failed");
      process.exit(1);
    }

    console.log("✅ Database connections successful");

    // Start server
    app.listen(PORT, () => {
      console.log("🚀 Ridesk Server started successfully!");
      console.log(`📡 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${env.NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(
        `📊 Database health: http://localhost:${PORT}/health/database`,
      );
      console.log("📚 API Documentation: http://localhost:${PORT}/api/docs");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught Exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully");
  process.exit(0);
});

// Start the server unless running tests
if (env.NODE_ENV !== "test") {
  startServer();
}

export default app;
