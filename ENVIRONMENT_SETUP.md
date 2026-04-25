# Environment Setup Guide

## Overview

This guide explains how to properly set up environment variables for the Ridesk Server. The server uses a centralized environment configuration system that validates all required variables at startup.

## Quick Start

1. **Copy the example environment file:**

   ```bash
   cp env.example .env
   ```

2. **Edit the `.env` file with your actual values:**

   ```bash
   nano .env
   ```

3. **Test your environment setup:**

   ```bash
   npm run test:env
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

## Environment Variables

### Required Variables

| Variable                    | Description               | Example                                   |
| --------------------------- | ------------------------- | ----------------------------------------- |
| `SUPABASE_URL`              | Your Supabase project URL | `https://your-project.supabase.co`        |
| `SUPABASE_ANON_KEY`         | Supabase anonymous key    | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `JWT_SECRET`                | Secret key for JWT tokens | `your-super-secret-jwt-key-here`          |

### Optional Variables

| Variable                  | Description             | Default                 | Example                  |
| ------------------------- | ----------------------- | ----------------------- | ------------------------ |
| `NODE_ENV`                | Environment mode        | `development`           | `production`             |
| `PORT`                    | Server port             | `3001`                  | `8080`                   |
| `CORS_ORIGIN`             | Allowed CORS origin     | `http://localhost:3000` | `https://app.ridesk.com` |
| `JWT_EXPIRES_IN`          | JWT token expiration    | `7d`                    | `24h`                    |
| `RATE_LIMIT_WINDOW_MS`    | Rate limit window       | `900000` (15 min)       | `3600000` (1 hour)       |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100`                   | `1000`                   |
| `DB_POOL_SIZE`            | Database pool size      | `10`                    | `20`                     |
| `DB_CONNECTION_TIMEOUT`   | DB connection timeout   | `30000`                 | `60000`                  |

## Environment File Structure

Create a `.env` file in the root directory with the following structure:

```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Database Configuration
DB_POOL_SIZE=10
DB_CONNECTION_TIMEOUT=30000
```

## Getting Supabase Credentials

1. **Go to your Supabase project dashboard:**

   - Visit [supabase.com](https://supabase.com)
   - Sign in to your account
   - Select your project

2. **Get your project URL:**

   - Go to Settings → API
   - Copy the "Project URL"

3. **Get your API keys:**
   - Go to Settings → API
   - Copy the "anon public" key
   - Copy the "service_role" key (keep this secret!)

## Environment Variable Access

The server uses a centralized environment configuration system located in `src/config/env.ts`. This system:

- ✅ Validates all required environment variables at startup
- ✅ Provides type-safe access to environment variables
- ✅ Uses bracket notation for dynamic property access
- ✅ Provides helpful error messages for missing variables
- ✅ Logs environment status in development mode

### Accessing Environment Variables

```typescript
// ✅ Correct - Using centralized config
import { env } from "./config/env";
const port = env.PORT;

// ✅ Correct - Direct access with bracket notation
const port = process.env["PORT"];

// ✅ Correct - Direct access with dot notation
const port = process.env.PORT;

// ❌ Avoid - Direct access without validation
const port = process.env.PORT || 3001; // No validation
```

## Troubleshooting

### Common Issues

1. **"Missing required environment variable" error:**

   - Make sure your `.env` file exists in the root directory
   - Check that all required variables are set
   - Verify there are no typos in variable names

2. **Environment variables not loading:**

   - Ensure `.env` file is in the correct location (root directory)
   - Check that there are no spaces around the `=` sign
   - Make sure there are no quotes around values unless needed

3. **Supabase connection errors:**
   - Verify your Supabase URL is correct
   - Check that your API keys are valid
   - Ensure your Supabase project is active

### Testing Environment Setup

Run the environment test script to verify your setup:

```bash
npm run test:env
```

This will show you:

- ✅ Which variables are properly loaded
- ❌ Which variables are missing
- 🔍 Test both dot notation and bracket notation access

### Debug Mode

In development mode, the server will log environment configuration:

```
🔧 Environment Configuration:
   NODE_ENV: development
   PORT: 3001
   CORS_ORIGIN: http://localhost:3000
   RATE_LIMIT: 100 requests per 900000ms
   SUPABASE_URL: ✅ Set
   JWT_SECRET: ✅ Set
```

## Security Best Practices

1. **Never commit `.env` files to version control:**

   - The `.env` file is already in `.gitignore`
   - Use `.env.example` for documentation

2. **Use strong JWT secrets:**

   - Generate a random string at least 32 characters long
   - Use a password manager to generate secure secrets

3. **Keep service role keys secret:**

   - Never expose service role keys in client-side code
   - Only use service role keys on the server

4. **Use different secrets for different environments:**
   - Use different JWT secrets for development and production
   - Use different Supabase projects for different environments

## Production Deployment

For production deployment:

1. **Set environment variables in your hosting platform:**

   - Heroku: Use `heroku config:set`
   - Vercel: Use the dashboard or `vercel env add`
   - Railway: Use the dashboard or CLI

2. **Use production-ready values:**

   - Set `NODE_ENV=production`
   - Use a strong JWT secret
   - Set appropriate CORS origins
   - Configure proper rate limiting

3. **Monitor environment status:**
   - Check the health endpoints
   - Monitor logs for environment-related errors
   - Use the environment test script in CI/CD

## Example Production Environment

```bash
# Production Environment
NODE_ENV=production
PORT=8080
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_ANON_KEY=your_prod_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_prod_service_role_key
JWT_SECRET=your-super-secure-production-jwt-secret
JWT_EXPIRES_IN=24h
CORS_ORIGIN=https://app.ridesk.com
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=1000
DB_POOL_SIZE=20
DB_CONNECTION_TIMEOUT=60000
```

## Support

If you're still having issues with environment setup:

1. Run `npm run test:env` and check the output
2. Verify your `.env` file format
3. Check the server logs for specific error messages
4. Ensure all required variables are set

For additional help, check the main API documentation or contact the development team.
