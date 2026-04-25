
import { createUploadthing, type FileRouter } from "uploadthing/express";
import { UploadThingError } from "uploadthing/server";
import { extractToken } from "./middleware/auth";
import { verifyToken } from "./services/auth";
import { env } from "./config/env";

const f = createUploadthing();

if (env.UPLOADTHING_TOKEN) {
  console.log("uploadThing token loaded");
} else {
  console.warn("UPLOADTHING_TOKEN not set");
}

export const uploadRouter = {
  schoolLogo: f({
    image: {
      maxFileSize: "1MB",
      maxFileCount: 1,
    },
  })
    .middleware(async ({ req }) => {
      const endpoint = "schoolLogo";
      try {
        const token = extractToken(req as any);
        if (!token) {
          const method = (req as any).method || "UNKNOWN";
          const url = (req as any).url || (req as any).originalUrl || "UNKNOWN";
          console.warn(
            `[UploadThing ${endpoint}] Missing token - Method: ${method}, URL: ${url}`
          );
          throw new UploadThingError("Unauthorized: No token provided");
        }

        const payload = verifyToken(token);
        const { getUserById } = await import("./services/auth");
        const user = await getUserById(payload.userId);

        if (user.role !== "SCHOOL_ADMIN" && user.role !== "SUPER_ADMIN") {
          throw new UploadThingError("Unauthorized: Insufficient permissions");
        }

        return {
          uploadedBy: user.id,
          userRole: user.role,
          schoolId: user.schoolId,
        };
      } catch (error) {
        // Only log unexpected errors, not UploadThingError which are already handled
        if (error instanceof UploadThingError) {
          throw error;
        }
        console.error(`[UploadThing ${endpoint}] Unexpected error:`, error);
        throw new UploadThingError("Authentication failed");
      }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("School logo uploaded by:", metadata.uploadedBy);
      const fileUrl = (file as any).ufsUrl || file.url;
      console.log("File URL:", fileUrl);
    }),
  instructorProfilePic: f({
    image: {
      maxFileSize: "1MB",
      maxFileCount: 1,
    },
  })
    .middleware(async ({ req }) => {
      const endpoint = "instructorProfilePic";
      try {
        const token = extractToken(req as any);
        if (!token) {
          const method = (req as any).method || "UNKNOWN";
          const url = (req as any).url || (req as any).originalUrl || "UNKNOWN";
          console.warn(
            `[UploadThing ${endpoint}] Missing token - Method: ${method}, URL: ${url}`
          );
          throw new UploadThingError("Unauthorized: No token provided");
        }

        const payload = verifyToken(token);
        const { getUserById } = await import("./services/auth");
        const user = await getUserById(payload.userId);

        const allowedRoles = ["SCHOOL_ADMIN", "SUPER_ADMIN", "INSTRUCTOR"];
        if (!allowedRoles.includes(user.role)) {
          throw new UploadThingError("Unauthorized: Insufficient permissions");
        }

        return {
          uploadedBy: user.id,
          userRole: user.role,
          schoolId: user.schoolId,
        };
      } catch (error) {
        // Only log unexpected errors, not UploadThingError which are already handled
        if (error instanceof UploadThingError) {
          throw error;
        }
        console.error(`[UploadThing ${endpoint}] Unexpected error:`, error);
        throw new UploadThingError("Authentication failed");
      }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Instructor profile picture uploaded by:", metadata.uploadedBy);
      const fileUrl = (file as any).ufsUrl || file.url;
      console.log("File URL:", fileUrl);
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;

