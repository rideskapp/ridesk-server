/**
 * @fileoverview Vercel serverless function entry point
 * @description This file serves as the entry point for Vercel serverless functions
 * @author Ridesk Team
 * @version 1.0.0
 */

// Import the built Express app from the dist directory
const app = require("../dist/index.js").default;

// Export the Express app as a Vercel serverless function
module.exports = (req, res) => {
  
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-uploadthing-package, x-uploadthing-version, x-uploadthing-behavior, traceparent, b3');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Expose-Headers', 'x-uploadthing-package, x-uploadthing-version');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Handle the request with the Express app
  app(req, res);
};
